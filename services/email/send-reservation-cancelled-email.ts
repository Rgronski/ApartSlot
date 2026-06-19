import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { buildReservationCancelledEmailTemplate } from "@/emails/templates/reservation-cancelled-email";

import { sendLoggedEmail } from "./send-logged-email";

type SendReservationCancelledEmailResult =
  | {
      status: "sent";
      reservationId: string;
      emailLogId: string;
      providerMessageId: string | null;
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

export async function sendReservationCancelledEmail(
  reservationId: string,
  cancellationReason: string,
  db: PrismaClient = prisma,
): Promise<SendReservationCancelledEmailResult> {
  const reservation = await db.reservation.findUnique({
    where: {
      id: reservationId,
    },
    include: {
      guest: true,
      apartment: true,
    },
  });

  if (!reservation) {
    return {
      status: "failed",
      reservationId,
      reason: "Nie znaleziono rezerwacji do wysylki maila o anulowaniu.",
    };
  }

  if (!reservation.guest.email?.trim()) {
    return {
      status: "skipped",
      reservationId,
      reason: "Brakuje adresu e-mail klienta.",
    };
  }

  const template = buildReservationCancelledEmailTemplate({
    guestFirstName: reservation.guest.firstName,
    apartmentName: reservation.apartment.name,
    checkInDate: formatDate(reservation.checkInDate),
    checkOutDate: formatDate(reservation.checkOutDate),
    reservationNumber: reservation.reservationNumber,
    cancellationReason,
    paidAmount: Number(reservation.paidAmount),
    currency: reservation.currency,
  });

  const result = await sendLoggedEmail(
    {
      reservationId: reservation.id,
      guestId: reservation.guest.id,
      type: "RESERVATION_CANCELLED",
      recipientEmail: reservation.guest.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    },
    db,
  );

  if (result.status === "failed") {
    console.error("Reservation cancelled email failed", {
      reservationId,
      reason: result.reason,
    });

    return {
      status: "failed",
      reservationId,
      reason: result.reason,
    };
  }

  return {
    status: "sent",
    reservationId,
    emailLogId: result.emailLogId,
    providerMessageId: result.providerMessageId,
  };
}
