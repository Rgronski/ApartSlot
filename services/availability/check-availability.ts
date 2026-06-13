import { DomainError } from "@/lib/errors/domain-error";

export const blockingReservationStatuses = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "MANUAL_BLOCK",
] as const;

export type BlockingReservationStatus =
  (typeof blockingReservationStatuses)[number];

export type ReservationAvailabilityRecord = {
  id: string;
  apartmentId: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
};

export type CalendarBlockAvailabilityRecord = {
  id: string;
  apartmentId: string;
  dateFrom: Date;
  dateTo: Date;
  reason?: string | null;
};

export type CheckAvailabilityInput = {
  apartmentId: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  reservations?: ReservationAvailabilityRecord[];
  calendarBlocks?: CalendarBlockAvailabilityRecord[];
  googleCalendarBusy?: boolean;
};

export type AvailabilityConflict =
  | {
      source: "reservation";
      conflictId: string;
      status: string;
    }
  | {
      source: "calendar_block";
      conflictId: string;
      reason?: string | null;
    }
  | {
      source: "google_calendar";
      conflictId: "external_google_calendar";
    };

export type CheckAvailabilityResult = {
  isAvailable: boolean;
  normalizedCheckInDate: Date;
  normalizedCheckOutDate: Date;
  conflicts: AvailabilityConflict[];
};

function normalizeDateInput(value: Date | string, fieldName: string): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new DomainError(
      "INVALID_DATE",
      `Pole ${fieldName} ma niepoprawna date.`,
    );
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function assertDateRange(checkInDate: Date, checkOutDate: Date) {
  if (checkInDate.getTime() === checkOutDate.getTime()) {
    throw new DomainError(
      "INVALID_DATE_RANGE",
      "Data wyjazdu musi byc pozniejsza niz data przyjazdu.",
    );
  }

  if (checkInDate > checkOutDate) {
    throw new DomainError(
      "INVALID_DATE_RANGE",
      "Data wyjazdu nie moze byc wczesniejsza niz data przyjazdu.",
    );
  }
}

function rangesOverlap(
  existingStart: Date,
  existingEnd: Date,
  requestedStart: Date,
  requestedEnd: Date,
) {
  return existingStart < requestedEnd && existingEnd > requestedStart;
}

export function checkAvailability(
  input: CheckAvailabilityInput,
): CheckAvailabilityResult {
  const normalizedCheckInDate = normalizeDateInput(
    input.checkInDate,
    "checkInDate",
  );
  const normalizedCheckOutDate = normalizeDateInput(
    input.checkOutDate,
    "checkOutDate",
  );

  if (!input.apartmentId?.trim()) {
    throw new DomainError(
      "MISSING_APARTMENT_ID",
      "Brakuje identyfikatora apartamentu.",
    );
  }

  assertDateRange(normalizedCheckInDate, normalizedCheckOutDate);

  const conflicts: AvailabilityConflict[] = [];

  for (const reservation of input.reservations ?? []) {
    if (reservation.apartmentId !== input.apartmentId) {
      continue;
    }

    if (!blockingReservationStatuses.includes(
      reservation.status as BlockingReservationStatus,
    )) {
      continue;
    }

    const overlaps = rangesOverlap(
      normalizeDateInput(reservation.checkInDate, "reservation.checkInDate"),
      normalizeDateInput(reservation.checkOutDate, "reservation.checkOutDate"),
      normalizedCheckInDate,
      normalizedCheckOutDate,
    );

    if (overlaps) {
      conflicts.push({
        source: "reservation",
        conflictId: reservation.id,
        status: reservation.status,
      });
    }
  }

  for (const block of input.calendarBlocks ?? []) {
    if (block.apartmentId !== input.apartmentId) {
      continue;
    }

    const overlaps = rangesOverlap(
      normalizeDateInput(block.dateFrom, "calendarBlock.dateFrom"),
      normalizeDateInput(block.dateTo, "calendarBlock.dateTo"),
      normalizedCheckInDate,
      normalizedCheckOutDate,
    );

    if (overlaps) {
      conflicts.push({
        source: "calendar_block",
        conflictId: block.id,
        reason: block.reason,
      });
    }
  }

  if (input.googleCalendarBusy) {
    conflicts.push({
      source: "google_calendar",
      conflictId: "external_google_calendar",
    });
  }

  return {
    isAvailable: conflicts.length === 0,
    normalizedCheckInDate,
    normalizedCheckOutDate,
    conflicts,
  };
}
