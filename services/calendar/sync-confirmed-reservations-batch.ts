import { ReservationStatus, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

import { syncConfirmedReservationToGoogleCalendar } from "./sync-confirmed-reservation-to-google-calendar";

export async function syncConfirmedReservationsBatch(
  db: PrismaClient = prisma,
) {
  const reservations = await db.reservation.findMany({
    where: {
      status: ReservationStatus.CONFIRMED,
    },
    orderBy: {
      confirmedAt: "desc",
    },
    select: {
      id: true,
      reservationNumber: true,
      calendarEventId: true,
    },
    take: 100,
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const details: string[] = [];

  for (const reservation of reservations) {
    const result = await syncConfirmedReservationToGoogleCalendar(reservation.id, db);

    if (result.status === "synced") {
      synced += 1;
      continue;
    }

    if (result.status === "skipped") {
      skipped += 1;
      if (details.length < 5) {
        details.push(`${reservation.reservationNumber}: ${result.reason}`);
      }
      continue;
    }

    failed += 1;
    if (details.length < 5) {
      details.push(`${reservation.reservationNumber}: ${result.reason}`);
    }
  }

  return {
    checked: reservations.length,
    synced,
    skipped,
    failed,
    details,
  };
}
