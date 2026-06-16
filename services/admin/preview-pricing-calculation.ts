import { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";
import { calculateReservationPrice } from "@/services/pricing";

function parseDaysOfWeek(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isInteger(item));

  return parsed.length > 0 ? parsed : null;
}

export async function previewPricingCalculation(
  apartmentId: string,
  checkInDate: string,
  checkOutDate: string,
  db: PrismaClient = prisma,
) {
  const normalizedApartmentId = apartmentId.trim();

  if (!normalizedApartmentId) {
    throw new DomainError("INVALID_PRICING_PREVIEW", "Brakuje apartamentu do podgladu ceny.");
  }

  if (!checkInDate.trim() || !checkOutDate.trim()) {
    throw new DomainError("INVALID_PRICING_PREVIEW", "Uzupelnij date przyjazdu i wyjazdu.");
  }

  const apartment = await db.apartment.findFirst({
    where: {
      id: normalizedApartmentId,
    },
  });

  if (!apartment) {
    throw new DomainError("APARTMENT_NOT_FOUND", "Nie znaleziono apartamentu do podgladu ceny.");
  }

  const pricingRules = await db.pricingRule.findMany({
    where: {
      apartmentId: apartment.id,
      isActive: true,
    },
    orderBy: {
      priority: "desc",
    },
  });

  return calculateReservationPrice({
    apartmentId: apartment.id,
    checkInDate,
    checkOutDate,
    basePricePerNight: Number(apartment.basePricePerNight),
    cleaningFee: Number(apartment.cleaningFee),
    depositAmount: Number(apartment.depositAmount),
    currency: apartment.currency,
    apartmentMinimumNights: apartment.minimumNights,
    pricingRules: pricingRules.map((rule) => ({
      id: rule.id,
      apartmentId: rule.apartmentId,
      name: rule.name,
      ruleType: rule.ruleType,
      dateFrom: rule.dateFrom,
      dateTo: rule.dateTo,
      pricePerNight: Number(rule.pricePerNight),
      minimumNights: rule.minimumNights,
      daysOfWeek: parseDaysOfWeek(rule.daysOfWeek),
      priority: rule.priority,
      isActive: rule.isActive,
    })),
  });
}
