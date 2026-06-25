import { PaymentStatus, ReservationStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

type CreateMolliePaymentResult = {
  paymentId: string;
  checkoutUrl: string;
};

type MollieCreatePaymentResponse = {
  id: string;
  status: string;
  _links?: {
    checkout?: {
      href?: string;
    };
  };
};

function getMollieApiKey() {
  const mollieApiKey = process.env.MOLLIE_API_KEY?.trim();

  if (!mollieApiKey) {
    throw new DomainError(
      "MISSING_MOLLIE_API_KEY",
      "Brakuje klucza MOLLIE_API_KEY.",
    );
  }

  return mollieApiKey;
}

function getAppBaseUrl() {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();

  if (!appBaseUrl) {
    throw new DomainError(
      "MISSING_APP_BASE_URL",
      "Brakuje adresu APP_BASE_URL potrzebnego do platnosci Mollie.",
    );
  }

  return appBaseUrl.replace(/\/$/, "");
}

function formatMollieAmount(amount: number) {
  return amount.toFixed(2);
}

function assertPaymentCanBeStarted(input: {
  paymentStatus: PaymentStatus;
  reservationStatus: ReservationStatus;
  paymentExpiresAt: Date | null;
  now: Date;
}) {
  if (
    input.paymentStatus === PaymentStatus.PAID ||
    input.reservationStatus === ReservationStatus.CONFIRMED
  ) {
    throw new DomainError(
      "PAYMENT_ALREADY_COMPLETED",
      "Ta rezerwacja jest juz oplacona.",
    );
  }

  if (
    input.paymentStatus === PaymentStatus.CANCELLED ||
    input.reservationStatus === ReservationStatus.CANCELLED
  ) {
    throw new DomainError(
      "PAYMENT_CANCELLED",
      "Ta platnosc zostala anulowana.",
    );
  }

  if (
    input.paymentStatus === PaymentStatus.EXPIRED ||
    input.reservationStatus === ReservationStatus.EXPIRED ||
    (input.paymentExpiresAt !== null && input.paymentExpiresAt < input.now)
  ) {
    throw new DomainError(
      "PAYMENT_EXPIRED",
      "Link do platnosci wygasl.",
    );
  }
}

async function createMolliePaymentRequest(input: {
  apiKey: string;
  amount: number;
  currency: string;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  metadata: Record<string, string>;
}) {
  const response = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: {
        currency: input.currency,
        value: formatMollieAmount(input.amount),
      },
      description: input.description,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      locale: "pl_PL",
      metadata: input.metadata,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | MollieCreatePaymentResponse
    | { detail?: string; title?: string }
    | null;

  if (!response.ok) {
    const detail =
      payload && "detail" in payload && payload.detail
        ? payload.detail
        : "Mollie odrzucilo utworzenie platnosci.";

    throw new DomainError("MOLLIE_PAYMENT_CREATE_FAILED", detail);
  }

  if (!payload || !("id" in payload)) {
    throw new DomainError(
      "MOLLIE_PAYMENT_RESPONSE_INVALID",
      "Mollie zwrocilo niepoprawna odpowiedz.",
    );
  }

  const checkoutUrl = payload._links?.checkout?.href;

  if (!checkoutUrl) {
    throw new DomainError(
      "MOLLIE_CHECKOUT_URL_MISSING",
      "Mollie nie zwrocilo adresu checkout.",
    );
  }

  return {
    paymentId: payload.id,
    checkoutUrl,
  };
}

export async function createMolliePayment(
  paymentToken: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<CreateMolliePaymentResult> {
  const payment = await db.payment.findUnique({
    where: {
      paymentToken,
    },
    include: {
      reservation: {
        include: {
          apartment: true,
          guest: true,
        },
      },
    },
  });

  if (!payment) {
    throw new DomainError(
      "PAYMENT_NOT_FOUND",
      "Nie znaleziono platnosci dla tego tokenu.",
    );
  }

  assertPaymentCanBeStarted({
    paymentStatus: payment.status,
    reservationStatus: payment.reservation.status,
    paymentExpiresAt: payment.paymentExpiresAt,
    now,
  });

  const appBaseUrl = getAppBaseUrl();
  const result = await createMolliePaymentRequest({
    apiKey: getMollieApiKey(),
    amount: Number(payment.amount),
    currency: payment.currency,
    description: `Rezerwacja ${payment.reservation.reservationNumber}`,
    redirectUrl: `${appBaseUrl}/pay/${paymentToken}?checkout=success`,
    webhookUrl: `${appBaseUrl}/api/webhooks/mollie`,
    metadata: {
      paymentId: payment.id,
      paymentToken,
      reservationId: payment.reservationId,
      reservationNumber: payment.reservation.reservationNumber,
      apartmentId: payment.reservation.apartmentId,
    },
  });

  await db.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      provider: "MOLLIE",
      providerPaymentId: result.paymentId,
      paymentUrl: result.checkoutUrl,
      status: PaymentStatus.PENDING,
    },
  });

  await db.reservation.update({
    where: {
      id: payment.reservationId,
    },
    data: {
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  return result;
}
