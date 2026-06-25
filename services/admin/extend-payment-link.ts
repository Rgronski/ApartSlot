import { PaymentStatus, ReservationStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

function assertReservationCanHavePaymentLinkExtended(status: ReservationStatus) {
  if (
    status === ReservationStatus.CONFIRMED ||
    status === ReservationStatus.CANCELLED ||
    status === ReservationStatus.COMPLETED ||
    status === ReservationStatus.MANUAL_BLOCK
  ) {
    throw new DomainError(
      "RESERVATION_PAYMENT_LINK_CANNOT_BE_EXTENDED",
      "Dla tej rezerwacji nie mozna juz przedluzyc linku platnosci.",
    );
  }
}

export async function extendPaymentLink(
  reservationId: string,
  db: PrismaClient = prisma,
  now: Date = new Date(),
) {
  const normalizedReservationId = reservationId.trim();

  if (!normalizedReservationId) {
    throw new DomainError("INVALID_RESERVATION_ID", "Brakuje identyfikatora rezerwacji.");
  }

  const reservation = await db.reservation.findUnique({
    where: {
      id: normalizedReservationId,
    },
    include: {
      payments: {
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!reservation) {
    throw new DomainError("RESERVATION_NOT_FOUND", "Nie znaleziono rezerwacji.");
  }

  assertReservationCanHavePaymentLinkExtended(reservation.status);

  const payment = reservation.payments[0];

  if (!payment) {
    throw new DomainError(
      "PAYMENT_NOT_FOUND",
      "Ta rezerwacja nie ma jeszcze linku platnosci.",
    );
  }

  if (payment.status === PaymentStatus.PAID || reservation.paymentStatus === PaymentStatus.PAID) {
    throw new DomainError(
      "PAYMENT_ALREADY_COMPLETED",
      "Ta rezerwacja jest juz oplacona.",
    );
  }

  const nextExpiresAt = addHours(now, 24);

  await db.$transaction([
    db.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status:
          payment.status === PaymentStatus.CANCELLED ||
          payment.status === PaymentStatus.EXPIRED ||
          payment.status === PaymentStatus.FAILED
            ? PaymentStatus.CREATED
            : payment.status,
        paymentExpiresAt: nextExpiresAt,
      },
    }),
    db.reservation.update({
      where: {
        id: reservation.id,
      },
      data: {
        status:
          reservation.status === ReservationStatus.EXPIRED
            ? ReservationStatus.PENDING_PAYMENT
            : reservation.status,
        paymentStatus:
          reservation.paymentStatus === PaymentStatus.EXPIRED ||
          reservation.paymentStatus === PaymentStatus.FAILED ||
          reservation.paymentStatus === PaymentStatus.CANCELLED
            ? PaymentStatus.CREATED
            : reservation.paymentStatus,
        holdExpiresAt: nextExpiresAt,
      },
    }),
  ]);

  return {
    reservationId: reservation.id,
    reservationNumber: reservation.reservationNumber,
    paymentToken: payment.paymentToken,
    paymentExpiresAt: nextExpiresAt,
  };
}
