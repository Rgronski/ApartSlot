import Stripe from "stripe";
import { PaymentStatus, ReservationStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

type CreateStripeCheckoutSessionResult = {
  checkoutSessionId: string;
  checkoutUrl: string;
};

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!stripeSecretKey) {
    throw new DomainError(
      "MISSING_STRIPE_SECRET_KEY",
      "Brakuje klucza STRIPE_SECRET_KEY.",
    );
  }

  stripeClient = new Stripe(stripeSecretKey);
  return stripeClient;
}

function getAppBaseUrl() {
  const appBaseUrl = process.env.APP_BASE_URL?.trim();

  if (!appBaseUrl) {
    throw new DomainError(
      "MISSING_APP_BASE_URL",
      "Brakuje adresu APP_BASE_URL potrzebnego do Stripe Checkout.",
    );
  }

  return appBaseUrl.replace(/\/$/, "");
}

function assertCheckoutCanBeStarted(input: {
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

export async function createStripeCheckoutSession(
  paymentToken: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<CreateStripeCheckoutSessionResult> {
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

  assertCheckoutCanBeStarted({
    paymentStatus: payment.status,
    reservationStatus: payment.reservation.status,
    paymentExpiresAt: payment.paymentExpiresAt,
    now,
  });

  const stripe = getStripeClient();
  const appBaseUrl = getAppBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appBaseUrl}/pay/${paymentToken}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl}/pay/${paymentToken}?checkout=cancelled`,
    customer_email: payment.reservation.guest.email,
    client_reference_id: payment.reservation.reservationNumber,
    metadata: {
      paymentId: payment.id,
      paymentToken,
      reservationId: payment.reservationId,
      reservationNumber: payment.reservation.reservationNumber,
      apartmentId: payment.reservation.apartmentId,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payment.currency.toLowerCase(),
          unit_amount: Math.round(Number(payment.amount) * 100),
          product_data: {
            name: `Rezerwacja ${payment.reservation.apartment.name}`,
            description: `${payment.reservation.checkInDate.toISOString().slice(0, 10)} - ${payment.reservation.checkOutDate.toISOString().slice(0, 10)} | ${payment.reservation.nightsCount} noce`,
          },
        },
      },
    ],
  });

  if (!session.url) {
    throw new DomainError(
      "STRIPE_SESSION_URL_MISSING",
      "Stripe nie zwrocil adresu checkout.",
    );
  }

  await db.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      provider: "STRIPE",
      providerPaymentId: session.id,
      paymentUrl: session.url,
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

  return {
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
  };
}
