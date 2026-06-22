import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

import { sendReservationCancelledEmail } from "./send-reservation-cancelled-email";
import { sendReservationConfirmedEmail } from "./send-reservation-confirmed-email";
import { sendReservationCreatedEmail } from "./send-reservation-created-email";
import { sendReservationManuallyConfirmedEmail } from "./send-reservation-manually-confirmed-email";

type RetryEmailLogResult =
  | {
      status: "sent";
      reservationId: string;
    }
  | {
      status: "skipped" | "failed";
      reason: string;
    };

function extractLatestCancellationReason(adminNotes: string | null) {
  if (!adminNotes?.trim()) {
    return null;
  }

  const lines = adminNotes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (line.startsWith("Powod anulowania:")) {
      return line.replace("Powod anulowania:", "").trim() || null;
    }
  }

  return null;
}

export async function retryEmailLog(
  emailLogId: string,
  db: PrismaClient = prisma,
): Promise<RetryEmailLogResult> {
  const emailLog = await db.emailLog.findUnique({
    where: {
      id: emailLogId,
    },
    select: {
      id: true,
      type: true,
      reservationId: true,
      reservation: {
        select: {
          adminNotes: true,
        },
      },
    },
  });

  if (!emailLog) {
    return {
      status: "failed",
      reason: "Nie znaleziono wpisu historii maila do ponowienia.",
    };
  }

  if (!emailLog.reservationId) {
    return {
      status: "failed",
      reason: "Brakuje powiazanej rezerwacji, wiec nie mozna ponowic tej wiadomosci.",
    };
  }

  if (emailLog.type === "RESERVATION_CREATED") {
    const result = await sendReservationCreatedEmail(emailLog.reservationId, db);

    if (result.status === "sent") {
      return {
        status: "sent",
        reservationId: result.reservationId,
      };
    }

    return {
      status: result.status,
      reason: result.reason,
    };
  }

  if (emailLog.type === "RESERVATION_CONFIRMED") {
    const result = await sendReservationConfirmedEmail(emailLog.reservationId, db);

    if (result.status === "sent") {
      return {
        status: "sent",
        reservationId: result.reservationId,
      };
    }

    return {
      status: result.status,
      reason: result.reason,
    };
  }

  if (emailLog.type === "RESERVATION_CANCELLED") {
    const cancellationReason = extractLatestCancellationReason(
      emailLog.reservation?.adminNotes ?? null,
    );

    if (!cancellationReason) {
      return {
        status: "failed",
        reason: "Brakuje zapisanego powodu anulowania, wiec nie mozna odtworzyc tresci maila.",
      };
    }

    const result = await sendReservationCancelledEmail(
      emailLog.reservationId,
      cancellationReason,
      db,
    );

    if (result.status === "sent") {
      return {
        status: "sent",
        reservationId: result.reservationId,
      };
    }

    return {
      status: result.status,
      reason: result.reason,
    };
  }

  if (emailLog.type === "RESERVATION_MANUALLY_CONFIRMED") {
    const result = await sendReservationManuallyConfirmedEmail(
      emailLog.reservationId,
      db,
    );

    if (result.status === "sent") {
      return {
        status: "sent",
        reservationId: result.reservationId,
      };
    }

    return {
      status: result.status,
      reason: result.reason,
    };
  }

  return {
    status: "failed",
    reason: `Ten typ wiadomosci nie jest jeszcze obslugiwany przez ponowna wysylke: ${emailLog.type}.`,
  };
}
