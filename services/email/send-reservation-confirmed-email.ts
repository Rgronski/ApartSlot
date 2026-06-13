import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { buildReservationConfirmedEmailTemplate } from "@/emails/templates/reservation-confirmed-email";
import { getResendClient, getResendFromEmail } from "@/integrations/resend/client";

type SendReservationConfirmedEmailResult =
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

export async function sendReservationConfirmedEmail(
  reservationId: string,
  db: PrismaClient = prisma,
): Promise<SendReservationConfirmedEmailResult> {
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
      reason: "Nie znaleziono rezerwacji do wysylki potwierdzenia e-mail.",
    };
  }

  if (!reservation.guest.email?.trim()) {
    return {
      status: "skipped",
      reservationId,
      reason: "Brakuje adresu e-mail klienta.",
    };
  }

  const template = buildReservationConfirmedEmailTemplate({
    guestFirstName: reservation.guest.firstName,
    apartmentName: reservation.apartment.name,
    checkInDate: formatDate(reservation.checkInDate),
    checkOutDate: formatDate(reservation.checkOutDate),
    nightsCount: reservation.nightsCount,
    guestsCount: reservation.guestsCount,
    totalAmount: Number(reservation.totalAmount),
    paidAmount: Number(reservation.paidAmount),
    currency: reservation.currency,
    reservationNumber: reservation.reservationNumber,
  });

  const emailLog = await db.emailLog.create({
    data: {
      reservationId: reservation.id,
      guestId: reservation.guest.id,
      type: "RESERVATION_CONFIRMED",
      recipientEmail: reservation.guest.email,
      subject: template.subject,
      status: "PENDING",
    },
  });

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();

    const response = await resend.emails.send({
      from,
      to: reservation.guest.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (response.error) {
      await db.emailLog.update({
        where: {
          id: emailLog.id,
        },
        data: {
          status: "FAILED",
          errorMessage: response.error.message,
        },
      });

      return {
        status: "failed",
        reservationId,
        reason: response.error.message,
      };
    }

    await db.emailLog.update({
      where: {
        id: emailLog.id,
      },
      data: {
        status: "SENT",
        providerMessageId: response.data?.id ?? null,
        sentAt: new Date(),
      },
    });

    return {
      status: "sent",
      reservationId,
      emailLogId: emailLog.id,
      providerMessageId: response.data?.id ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udalo sie wyslac e-maila potwierdzajacego.";

    await db.emailLog.update({
      where: {
        id: emailLog.id,
      },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    console.error("Reservation confirmed email failed", {
      reservationId,
      error,
    });

    return {
      status: "failed",
      reservationId,
      reason: message,
    };
  }
}
