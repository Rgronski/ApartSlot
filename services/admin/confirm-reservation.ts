import { ReservationStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

function assertReservationCanBeConfirmed(status: ReservationStatus) {
  if (status === ReservationStatus.CONFIRMED) {
    throw new DomainError(
      "RESERVATION_ALREADY_CONFIRMED",
      "Ta rezerwacja jest juz potwierdzona.",
    );
  }

  if (
    status === ReservationStatus.CANCELLED ||
    status === ReservationStatus.COMPLETED ||
    status === ReservationStatus.EXPIRED ||
    status === ReservationStatus.MANUAL_BLOCK
  ) {
    throw new DomainError(
      "RESERVATION_CANNOT_BE_CONFIRMED",
      "Tej rezerwacji nie mozna juz potwierdzic z panelu administratora.",
    );
  }
}

export async function confirmReservation(
  reservationId: string,
  operatorNote: string | null,
  db: PrismaClient = prisma,
) {
  const normalizedReservationId = reservationId.trim();
  const normalizedOperatorNote = operatorNote?.trim() || null;

  if (!normalizedReservationId) {
    throw new DomainError("INVALID_RESERVATION_ID", "Brakuje identyfikatora rezerwacji.");
  }

  const reservation = await db.reservation.findUnique({
    where: {
      id: normalizedReservationId,
    },
  });

  if (!reservation) {
    throw new DomainError("RESERVATION_NOT_FOUND", "Nie znaleziono rezerwacji do potwierdzenia.");
  }

  assertReservationCanBeConfirmed(reservation.status);

  const confirmationNoteParts = [
    `Potwierdzono recznie: ${new Date().toISOString()}`,
    normalizedOperatorNote ? `Notatka operatora: ${normalizedOperatorNote}` : null,
  ].filter(Boolean);

  const nextAdminNotes = reservation.adminNotes?.trim()
    ? `${reservation.adminNotes.trim()}\n\n${confirmationNoteParts.join("\n")}`
    : confirmationNoteParts.join("\n");

  await db.reservation.update({
    where: {
      id: reservation.id,
    },
    data: {
      status: ReservationStatus.CONFIRMED,
      confirmedAt: reservation.confirmedAt ?? new Date(),
      adminNotes: nextAdminNotes,
    },
  });

  return {
    reservationId: reservation.id,
    reservationNumber: reservation.reservationNumber,
  };
}
