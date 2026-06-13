import { PaymentStatus, ReservationStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PaymentPageState =
  | "active"
  | "expired"
  | "paid"
  | "cancelled"
  | "failed"
  | "not_found";

export type PaymentPageData = {
  state: PaymentPageState;
  reservationNumber?: string;
  apartmentName?: string;
  apartmentCity?: string | null;
  guestFirstName?: string;
  guestLastName?: string;
  stayLabel?: string;
  nightsCount?: number;
  guestsCount?: number;
  totalAmount?: number;
  amountToPayNow?: number;
  paidAmount?: number;
  currency?: string;
  paymentExpiresAt?: Date | null;
  paymentStatus?: PaymentStatus;
  reservationStatus?: ReservationStatus;
  customerEmail?: string;
  customerPhone?: string;
  paymentToken?: string;
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolvePaymentPageState(input: {
  paymentStatus: PaymentStatus;
  reservationStatus: ReservationStatus;
  paymentExpiresAt: Date | null;
  now: Date;
}): PaymentPageState {
  if (
    input.paymentStatus === PaymentStatus.PAID ||
    input.reservationStatus === ReservationStatus.CONFIRMED
  ) {
    return "paid";
  }

  if (
    input.reservationStatus === ReservationStatus.CANCELLED ||
    input.paymentStatus === PaymentStatus.CANCELLED
  ) {
    return "cancelled";
  }

  if (
    input.reservationStatus === ReservationStatus.EXPIRED ||
    input.paymentStatus === PaymentStatus.EXPIRED ||
    (input.paymentExpiresAt !== null && input.paymentExpiresAt < input.now)
  ) {
    return "expired";
  }

  if (input.paymentStatus === PaymentStatus.FAILED) {
    return "failed";
  }

  return "active";
}

export async function getPaymentPageData(
  paymentToken: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<PaymentPageData> {
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
    return {
      state: "not_found",
      paymentToken,
    };
  }

  const state = resolvePaymentPageState({
    paymentStatus: payment.status,
    reservationStatus: payment.reservation.status,
    paymentExpiresAt: payment.paymentExpiresAt,
    now,
  });

  return {
    state,
    reservationNumber: payment.reservation.reservationNumber,
    apartmentName: payment.reservation.apartment.name,
    apartmentCity: payment.reservation.apartment.city,
    guestFirstName: payment.reservation.guest.firstName,
    guestLastName: payment.reservation.guest.lastName,
    stayLabel: `${formatDate(payment.reservation.checkInDate)} - ${formatDate(
      payment.reservation.checkOutDate,
    )}`,
    nightsCount: payment.reservation.nightsCount,
    guestsCount: payment.reservation.guestsCount,
    totalAmount: Number(payment.reservation.totalAmount),
    amountToPayNow: Number(payment.reservation.amountToPayNow),
    paidAmount: Number(payment.reservation.paidAmount),
    currency: payment.currency,
    paymentExpiresAt: payment.paymentExpiresAt,
    paymentStatus: payment.status,
    reservationStatus: payment.reservation.status,
    customerEmail: payment.reservation.guest.email,
    customerPhone: payment.reservation.guest.phone,
    paymentToken,
  };
}
