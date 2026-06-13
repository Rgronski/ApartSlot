import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getGoogleCalendarClient } from "@/integrations/google-calendar/client";

type SyncConfirmedReservationResult =
  | {
      status: "synced";
      reservationId: string;
      calendarId: string;
      calendarEventId: string;
    }
  | {
      status: "skipped";
      reservationId: string;
      reason: string;
    }
  | {
      status: "failed";
      reservationId: string;
      reason: string;
    };

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildEventSummary(input: {
  firstName: string;
  lastName: string;
  nightsCount: number;
  amountToPayNow: number;
  currency: string;
}) {
  return `[POTWIERDZONA] ${input.firstName} ${input.lastName} | ${input.nightsCount} noce | ${input.amountToPayNow} ${input.currency}`;
}

function buildEventDescription(input: {
  reservationId: string;
  reservationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guestsCount: number;
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: number;
  amountToPayNow: number;
  currency: string;
  source: string;
  paymentStatus: string;
}) {
  return [
    `ID rezerwacji: ${input.reservationId}`,
    `Numer rezerwacji: ${input.reservationNumber}`,
    `Klient: ${input.firstName} ${input.lastName}`,
    `E-mail: ${input.email}`,
    `Telefon: ${input.phone}`,
    `Liczba gosci: ${input.guestsCount}`,
    `Termin: ${formatDate(input.checkInDate)} - ${formatDate(input.checkOutDate)}`,
    `Kwota calkowita: ${input.totalAmount} ${input.currency}`,
    `Kwota zaplacona teraz: ${input.amountToPayNow} ${input.currency}`,
    `Status platnosci: ${input.paymentStatus}`,
    `Zrodlo rezerwacji: ${input.source}`,
  ].join("\n");
}

function getCalendarId(reservationCalendarId: string | null) {
  return reservationCalendarId?.trim() || process.env.GOOGLE_CALENDAR_FALLBACK_ID?.trim() || null;
}

export async function syncConfirmedReservationToGoogleCalendar(
  reservationId: string,
  db: PrismaClient = prisma,
): Promise<SyncConfirmedReservationResult> {
  const reservation = await db.reservation.findUnique({
    where: {
      id: reservationId,
    },
    include: {
      apartment: true,
      guest: true,
    },
  });

  if (!reservation) {
    return {
      status: "failed",
      reservationId,
      reason: "Nie znaleziono rezerwacji do synchronizacji z Google Calendar.",
    };
  }

  const calendarId = getCalendarId(reservation.apartment.googleCalendarId);

  if (!calendarId) {
    return {
      status: "skipped",
      reservationId,
      reason: "Brakuje calendarId dla apartamentu i fallbacku Google Calendar.",
    };
  }

  try {
    const calendar = getGoogleCalendarClient();

    const eventPayload = {
      summary: buildEventSummary({
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        nightsCount: reservation.nightsCount,
        amountToPayNow: Number(reservation.amountToPayNow),
        currency: reservation.currency,
      }),
      description: buildEventDescription({
        reservationId: reservation.id,
        reservationNumber: reservation.reservationNumber,
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
        guestsCount: reservation.guestsCount,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        totalAmount: Number(reservation.totalAmount),
        amountToPayNow: Number(reservation.amountToPayNow),
        currency: reservation.currency,
        source: reservation.source,
        paymentStatus: reservation.paymentStatus,
      }),
      start: {
        date: formatDate(reservation.checkInDate),
      },
      end: {
        date: formatDate(reservation.checkOutDate),
      },
    };

    const response = reservation.calendarEventId
      ? await calendar.events.update({
          calendarId,
          eventId: reservation.calendarEventId,
          requestBody: eventPayload,
        })
      : await calendar.events.insert({
          calendarId,
          requestBody: eventPayload,
        });

    const calendarEventId = response.data.id;

    if (!calendarEventId) {
      return {
        status: "failed",
        reservationId,
        reason: "Google Calendar nie zwrocil identyfikatora wydarzenia.",
      };
    }

    if (reservation.calendarEventId !== calendarEventId) {
      await db.reservation.update({
        where: {
          id: reservation.id,
        },
        data: {
          calendarEventId,
        },
      });
    }

    return {
      status: "synced",
      reservationId,
      calendarId,
      calendarEventId,
    };
  } catch (error) {
    console.error("Google Calendar sync failed", {
      reservationId,
      error,
    });

    return {
      status: "failed",
      reservationId,
      reason: "Nie udalo sie zsynchronizowac rezerwacji z Google Calendar.",
    };
  }
}
