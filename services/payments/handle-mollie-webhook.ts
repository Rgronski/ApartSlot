import {
  Prisma,
  PaymentStatus,
  ReservationStatus,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";
import { syncConfirmedReservationToGoogleCalendar } from "@/services/calendar";
import { sendReservationConfirmedEmail } from "@/services/email/send-reservation-confirmed-email";

type MolliePayment = {
  id: string;
  status: "open" | "pending" | "authorized" | "paid" | "canceled" | "expired" | "failed";
  amount?: {
    currency?: string;
    value?: string;
  };
  metadata?: {
    paymentId?: string;
    paymentToken?: string;
    reservationId?: string;
    reservationNumber?: string;
  } | null;
};

type MollieWebhookResult = {
  handled: boolean;
  paymentId: string;
  status?: string;
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

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function fetchMolliePayment(molliePaymentId: string) {
  const response = await fetch(`https://api.mollie.com/v2/payments/${molliePaymentId}`, {
    headers: {
      Authorization: `Bearer ${getMollieApiKey()}`,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | MolliePayment
    | { detail?: string; title?: string }
    | null;

  if (!response.ok) {
    const detail =
      payload && "detail" in payload && payload.detail
        ? payload.detail
        : "Nie udalo sie pobrac platnosci z Mollie.";

    throw new DomainError("MOLLIE_PAYMENT_FETCH_FAILED", detail);
  }

  if (!payload || !("id" in payload)) {
    throw new DomainError(
      "MOLLIE_PAYMENT_RESPONSE_INVALID",
      "Mollie zwrocilo niepoprawna odpowiedz platnosci.",
    );
  }

  return payload;
}

async function findPaymentByMolliePayment(
  db: PrismaClient,
  molliePayment: MolliePayment,
) {
  const localPaymentId = molliePayment.metadata?.paymentId;

  if (localPaymentId) {
    const payment = await db.payment.findUnique({
      where: {
        id: localPaymentId,
      },
    });

    if (payment) {
      return payment;
    }
  }

  return db.payment.findFirst({
    where: {
      providerPaymentId: molliePayment.id,
    },
  });
}

async function markPaymentAsPaid(
  db: PrismaClient,
  molliePayment: MolliePayment,
) {
  const payment = await findPaymentByMolliePayment(db, molliePayment);

  if (!payment) {
    return false;
  }

  await db.$transaction(async (tx) => {
    const currentPayment = await tx.payment.findUnique({
      where: {
        id: payment.id,
      },
    });

    if (!currentPayment) {
      throw new DomainError(
        "PAYMENT_NOT_FOUND",
        "Platnosc zniknela w trakcie aktualizacji webhooka Mollie.",
      );
    }

    const payload = toPrismaJson(molliePayment);

    if (currentPayment.status === PaymentStatus.PAID) {
      await tx.payment.update({
        where: {
          id: currentPayment.id,
        },
        data: {
          rawWebhookPayload: payload,
        },
      });

      return;
    }

    await tx.payment.update({
      where: {
        id: currentPayment.id,
      },
      data: {
        provider: "MOLLIE",
        providerPaymentId: molliePayment.id,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        rawWebhookPayload: payload,
      },
    });

    await tx.reservation.update({
      where: {
        id: currentPayment.reservationId,
      },
      data: {
        status: ReservationStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        confirmedAt: new Date(),
        paidAmount: {
          increment: Number(currentPayment.amount),
        },
      },
    });
  });

  const calendarSyncResult = await syncConfirmedReservationToGoogleCalendar(
    payment.reservationId,
    db,
  );

  if (calendarSyncResult.status === "failed") {
    console.error("Confirmed reservation was saved but Google Calendar sync failed", {
      reservationId: payment.reservationId,
      reason: calendarSyncResult.reason,
    });
  }

  const emailResult = await sendReservationConfirmedEmail(
    payment.reservationId,
    db,
  );

  if (emailResult.status === "failed") {
    console.error("Confirmed reservation was saved but confirmation email failed", {
      reservationId: payment.reservationId,
      reason: emailResult.reason,
    });
  }

  return true;
}

async function updatePaymentOnly(input: {
  db: PrismaClient;
  molliePayment: MolliePayment;
  status: PaymentStatus;
  reservationStatus?: ReservationStatus;
  failedAt?: Date;
}) {
  const payment = await findPaymentByMolliePayment(input.db, input.molliePayment);

  if (!payment) {
    return false;
  }

  const payload = toPrismaJson(input.molliePayment);

  await input.db.$transaction(async (tx) => {
    await tx.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        provider: "MOLLIE",
        providerPaymentId: input.molliePayment.id,
        status: input.status,
        failedAt: input.failedAt,
        rawWebhookPayload: payload,
      },
    });

    await tx.reservation.update({
      where: {
        id: payment.reservationId,
      },
      data: {
        paymentStatus: input.status,
        ...(input.reservationStatus ? { status: input.reservationStatus } : {}),
      },
    });
  });

  return true;
}

export async function handleMollieWebhook(
  molliePaymentId: string,
  db: PrismaClient = prisma,
): Promise<MollieWebhookResult> {
  const molliePayment = await fetchMolliePayment(molliePaymentId);
  let handled = false;

  if (molliePayment.status === "paid" || molliePayment.status === "authorized") {
    handled = await markPaymentAsPaid(db, molliePayment);
  } else if (molliePayment.status === "failed") {
    handled = await updatePaymentOnly({
      db,
      molliePayment,
      status: PaymentStatus.FAILED,
      failedAt: new Date(),
    });
  } else if (molliePayment.status === "canceled") {
    handled = await updatePaymentOnly({
      db,
      molliePayment,
      status: PaymentStatus.CANCELLED,
    });
  } else if (molliePayment.status === "expired") {
    handled = await updatePaymentOnly({
      db,
      molliePayment,
      status: PaymentStatus.EXPIRED,
      reservationStatus: ReservationStatus.EXPIRED,
    });
  } else if (molliePayment.status === "open" || molliePayment.status === "pending") {
    handled = await updatePaymentOnly({
      db,
      molliePayment,
      status: PaymentStatus.PENDING,
    });
  }

  return {
    handled,
    paymentId: molliePayment.id,
    status: molliePayment.status,
  };
}
