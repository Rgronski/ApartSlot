import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

type CreateCalendarBlockInput = {
  apartmentId: string;
  dateFrom: string;
  dateTo: string;
  reason?: string;
};

function normalizeDate(value: string, fieldName: string) {
  const trimmed = value.trim();
  const date = new Date(trimmed);

  if (!trimmed || Number.isNaN(date.getTime())) {
    throw new DomainError("INVALID_CALENDAR_BLOCK", `Pole ${fieldName} ma niepoprawna date.`);
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export async function createCalendarBlock(input: CreateCalendarBlockInput) {
  const apartmentId = input.apartmentId.trim();

  if (!apartmentId) {
    throw new DomainError("INVALID_CALENDAR_BLOCK", "Brakuje apartamentu dla blokady.");
  }

  const dateFrom = normalizeDate(input.dateFrom, "data od");
  const dateTo = normalizeDate(input.dateTo, "data do");

  if (dateFrom > dateTo) {
    throw new DomainError("INVALID_CALENDAR_BLOCK", "Data koncowa nie moze byc wczesniejsza niz poczatkowa.");
  }

  return prisma.calendarBlock.create({
    data: {
      apartmentId,
      dateFrom,
      dateTo,
      reason: input.reason?.trim() || null,
      createdBy: "admin_panel",
    },
  });
}
