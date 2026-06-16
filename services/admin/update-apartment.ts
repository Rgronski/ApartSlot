import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

type UpdateApartmentInput = {
  apartmentId: string;
  name: string;
  slug?: string;
  city?: string;
  address?: string;
  description?: string;
  maxGuests: number;
  basePricePerNight: number;
  cleaningFee: number;
  depositAmount: number;
  minimumNights?: number;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  googleCalendarId?: string;
  isActive: boolean;
};

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function validatePositiveNumber(value: number, fieldName: string, allowZero = false) {
  if (!Number.isFinite(value)) {
    throw new DomainError("INVALID_APARTMENT_DATA", `Pole ${fieldName} musi byc liczba.`);
  }

  if (allowZero ? value < 0 : value <= 0) {
    throw new DomainError(
      "INVALID_APARTMENT_DATA",
      `Pole ${fieldName} ma nieprawidlowa wartosc.`,
    );
  }
}

export async function updateApartment(input: UpdateApartmentInput) {
  const apartmentId = input.apartmentId.trim();
  const name = input.name.trim();

  if (!apartmentId) {
    throw new DomainError("INVALID_APARTMENT_DATA", "Brakuje identyfikatora apartamentu.");
  }

  if (!name) {
    throw new DomainError("INVALID_APARTMENT_DATA", "Nazwa apartamentu jest wymagana.");
  }

  const slug = slugify(input.slug?.trim() || name);

  if (!slug) {
    throw new DomainError(
      "INVALID_APARTMENT_DATA",
      "Nie udalo sie zbudowac poprawnego slug apartamentu.",
    );
  }

  validatePositiveNumber(input.maxGuests, "maksymalna liczba gosci");
  validatePositiveNumber(input.basePricePerNight, "cena za noc", true);
  validatePositiveNumber(input.cleaningFee, "oplata za sprzatanie", true);
  validatePositiveNumber(input.depositAmount, "kaucja", true);
  validatePositiveNumber(input.minimumNights ?? 1, "minimalna liczba nocy");

  try {
    return await prisma.apartment.update({
      where: {
        id: apartmentId,
      },
      data: {
        name,
        slug,
        city: normalizeText(input.city),
        address: normalizeText(input.address),
        description: normalizeText(input.description),
        maxGuests: Math.round(input.maxGuests),
        basePricePerNight: new Prisma.Decimal(input.basePricePerNight.toFixed(2)),
        cleaningFee: new Prisma.Decimal(input.cleaningFee.toFixed(2)),
        depositAmount: new Prisma.Decimal(input.depositAmount.toFixed(2)),
        minimumNights: Math.round(input.minimumNights ?? 1),
        defaultCheckInTime: normalizeText(input.defaultCheckInTime),
        defaultCheckOutTime: normalizeText(input.defaultCheckOutTime),
        googleCalendarId: normalizeText(input.googleCalendarId),
        isActive: input.isActive,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DomainError(
        "APARTMENT_SLUG_TAKEN",
        "Taki slug juz istnieje. Zmien slug i zapisz ponownie.",
      );
    }

    throw error;
  }
}
