import { PaymentStatus, ReservationStatus, type PrismaClient } from "@prisma/client";
import { GaxiosError } from "gaxios";

import { getGoogleCalendarClient } from "@/integrations/google-calendar/client";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

function getCalendarId(reservationCalendarId: string | null) {
  return reservationCalendarId?.trim() || process.env.GOOGLE_CALENDAR_FALLBACK_ID?.trim() || null;
}

function assertReservationCanBeCancelled(status: ReservationStatus) {
  if (
    status === ReservationStatus.CANCELLED ||
    status === ReservationStatus.COMPLETED ||
    status === ReservationStatus.EXPIRED ||
    status === ReservationStatus.MANUAL_BLOCK
  ) {
    throw new DomainError(
      "RESERVATION_CANNOT_BE_CANCELLED",
      "Tej rezerwacji nie mozna juz anulowac z panelu administratora.",
    );
  }
}

async function deleteGoogleCalendarEventIfNeeded(input: {
  calendarId: string | null;
  calendarEventId: string | null;
}) {
  if (!input.calendarEventId) {
    return;
  }

  if (!input.calendarId) {
    throw new DomainError(
      "MISSING_GOOGLE_CALENDAR_ID",
      "Nie mozna anulowac tej rezerwacji automatycznie, bo brakuje Google Calendar ID dla apartamentu.",
    );
  }

  try {
    const calendar = getGoogleCalendarClient();

    await calendar.events.delete({
      calendarId: input.calendarId,
      eventId: input.calendarEventId,
    });
  } catch (error) {
    if (error instanceof GaxiosError && error.response?.status === 404) {
      return;
    }

    throw new DomainError(
      "GOOGLE_CALENDAR_DELETE_FAILED",
      "Nie udalo sie usunac wydarzenia z Google Calendar, dlatego anulowanie zostalo zatrzymane dla bezpieczenstwa.",
    );
  }
}

export async function cancelReservation(
  reservationId: string,
  db: PrismaClient = prisma,
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
      apartment: {
        select: {
          googleCalendarId: true,
        },
      },
    },
  });

  if (!reservation) {
    throw new DomainError("RESERVATION_NOT_FOUND", "Nie znaleziono rezerwacji do anulowania.");
  }

  assertReservationCanBeCancelled(reservation.status);

  await deleteGoogleCalendarEventIfNeeded({
    calendarId: getCalendarId(reservation.apartment.googleCalendarId),
    calendarEventId: reservation.calendarEventId,
  });

  const shouldCancelReservationPaymentStatus = reservation.paymentStatus !== PaymentStatus.PAID;

  await db.$transaction([
    db.payment.updateMany({
      where: {
        reservationId: reservation.id,
        status: {
          in: [PaymentStatus.CREATED, PaymentStatus.LINK_SENT, PaymentStatus.PENDING, PaymentStatus.FAILED],
        },
      },
      data: {
        status: PaymentStatus.CANCELLED,
      },
    }),
    db.reservation.update({
      where: {
        id: reservation.id,
      },
      data: {
        status: ReservationStatus.CANCELLED,
        paymentStatus: shouldCancelReservationPaymentStatus
          ? PaymentStatus.CANCELLED
          : reservation.paymentStatus,
        cancelledAt: new Date(),
        calendarEventId: null,
      },
    }),
  ]);

  return {
    reservationId: reservation.id,
    reservationNumber: reservation.reservationNumber,
  };
}
