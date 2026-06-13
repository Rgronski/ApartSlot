import Stripe from "stripe";
import { PaymentStatus, ReservationStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { syncConfirmedReservationToGoogleCalendar } from "@/services/calendar";
import { sendReservationConfirmedEmail } from "@/services/email/send-reservation-confirmed-email";
import { DomainError } from "@/lib/errors/domain-error";

type StripeWebhookResult = {
  handled: boolean;
  eventId: string;
  eventType: string;
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

function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    throw new DomainError(
      "MISSING_STRIPE_WEBHOOK_SECRET",
      "Brakuje sekretu STRIPE_WEBHOOK_SECRET.",
    );
  }

  return webhookSecret;
}

function buildStoredWebhookPayload(event: Stripe.Event) {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    object: event.data.object,
  };
}

async function findPaymentBySession(
  db: PrismaClient,
  session: Stripe.Checkout.Session,
) {
  const paymentId = session.metadata?.paymentId;

  if (paymentId) {
    const payment = await db.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (payment) {
      return payment;
    }
  }

  return db.payment.findFirst({
    where: {
      providerPaymentId: session.id,
    },
  });
}

async function markPaymentAsPaid(
  db: PrismaClient,
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  const payment = await findPaymentBySession(db, session);

  if (!payment) {
    throw new DomainError(
      "PAYMENT_NOT_FOUND",
      "Nie znaleziono platnosci powiazanej z checkout session Stripe.",
    );
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
        "Platnosc zniknela w trakcie aktualizacji webhooka.",
      );
    }

    const payload = buildStoredWebhookPayload(event);

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
        provider: "STRIPE",
        providerPaymentId: session.id,
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
}

async function markPaymentAsFailed(
  db: PrismaClient,
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  const payment = await findPaymentBySession(db, session);

  if (!payment) {
    throw new DomainError(
      "PAYMENT_NOT_FOUND",
      "Nie znaleziono platnosci powiazanej z checkout session Stripe.",
    );
  }

  const payload = buildStoredWebhookPayload(event);

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        provider: "STRIPE",
        providerPaymentId: session.id,
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        rawWebhookPayload: payload,
      },
    });

    await tx.reservation.update({
      where: {
        id: payment.reservationId,
      },
      data: {
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  });
}

async function markPaymentAsExpired(
  db: PrismaClient,
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  const payment = await findPaymentBySession(db, session);

  if (!payment) {
    throw new DomainError(
      "PAYMENT_NOT_FOUND",
      "Nie znaleziono platnosci powiazanej z checkout session Stripe.",
    );
  }

  const payload = buildStoredWebhookPayload(event);

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        provider: "STRIPE",
        providerPaymentId: session.id,
        status: PaymentStatus.EXPIRED,
        rawWebhookPayload: payload,
      },
    });

    await tx.reservation.update({
      where: {
        id: payment.reservationId,
      },
      data: {
        status: ReservationStatus.EXPIRED,
        paymentStatus: PaymentStatus.EXPIRED,
      },
    });
  });
}

export function constructStripeEvent(payload: string, signature: string) {
  return getStripeClient().webhooks.constructEvent(
    payload,
    signature,
    getStripeWebhookSecret(),
  );
}

export async function handleStripeWebhook(
  payload: string,
  signature: string,
  db: PrismaClient = prisma,
): Promise<StripeWebhookResult> {
  const event = constructStripeEvent(payload, signature);

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await markPaymentAsPaid(db, event.data.object as Stripe.Checkout.Session, event);

    return {
      handled: true,
      eventId: event.id,
      eventType: event.type,
    };
  }

  if (event.type === "checkout.session.async_payment_failed") {
    await markPaymentAsFailed(db, event.data.object as Stripe.Checkout.Session, event);

    return {
      handled: true,
      eventId: event.id,
      eventType: event.type,
    };
  }

  if (event.type === "checkout.session.expired") {
    await markPaymentAsExpired(db, event.data.object as Stripe.Checkout.Session, event);

    return {
      handled: true,
      eventId: event.id,
      eventType: event.type,
    };
  }

  return {
    handled: false,
    eventId: event.id,
    eventType: event.type,
  };
}
