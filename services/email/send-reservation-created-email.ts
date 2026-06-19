import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { buildReservationCreatedEmailTemplate } from "@/emails/templates/reservation-created-email";

import { sendLoggedEmail } from "./send-logged-email";

type SendReservationCreatedEmailResult =
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

export async function sendReservationCreatedEmail(
  reservationId: string,
  db: PrismaClient = prisma,
): Promise<SendReservationCreatedEmailResult> {
  const reservation = await db.reservation.findUnique({
    where: {
      id: reservationId,
    },
    include: {
      guest: true,
      apartment: true,
      payments: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!reservation) {
    return {
      status: "failed",
      reservationId,
      reason: "Nie znaleziono rezerwacji do wysylki maila startowego.",
    };
  }

  if (!reservation.guest.email?.trim()) {
    return {
      status: "skipped",
      reservationId,
      reason: "Brakuje adresu e-mail klienta.",
    };
  }

  const latestPayment = reservation.payments[0] ?? null;
  const template = buildReservationCreatedEmailTemplate({
    guestFirstName: reservation.guest.firstName,
    apartmentName: reservation.apartment.name,
    checkInDate: formatDate(reservation.checkInDate),
    checkOutDate: formatDate(reservation.checkOutDate),
    nightsCount: reservation.nightsCount,
    guestsCount: reservation.guestsCount,
    amountToPayNow: Number(reservation.amountToPayNow),
    totalAmount: Number(reservation.totalAmount),
    currency: reservation.currency,
    reservationNumber: reservation.reservationNumber,
    paymentUrl: latestPayment?.paymentUrl ?? null,
    holdExpiresAt: reservation.holdExpiresAt
      ? reservation.holdExpiresAt.toISOString().replace("T", " ").slice(0, 16)
      : null,
  });

  const result = await sendLoggedEmail(
    {
      reservationId: reservation.id,
      guestId: reservation.guest.id,
      type: "RESERVATION_CREATED",
      recipientEmail: reservation.guest.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    },
    db,
  );

  if (result.status === "failed") {
    console.error("Reservation created email failed", {
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
