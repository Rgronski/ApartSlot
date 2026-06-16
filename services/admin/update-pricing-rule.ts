import { Prisma, PricingRuleType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

export type UpdatePricingRuleInput = {
  pricingRuleId: string;
  name: string;
  ruleType: PricingRuleType;
  dateFrom: string;
  dateTo: string;
  pricePerNight: number;
  minimumNights?: number | null;
  priority?: number;
  isActive: boolean;
};

function normalizeDate(value: string, fieldName: string) {
  const trimmed = value.trim();
  const date = new Date(trimmed);

  if (!trimmed || Number.isNaN(date.getTime())) {
    throw new DomainError("INVALID_PRICING_RULE", `Pole ${fieldName} ma niepoprawna date.`);
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export async function updatePricingRule(input: UpdatePricingRuleInput) {
  const pricingRuleId = input.pricingRuleId.trim();
  const name = input.name.trim();

  if (!pricingRuleId) {
    throw new DomainError("INVALID_PRICING_RULE", "Brakuje identyfikatora reguly cenowej.");
  }

  if (!name) {
    throw new DomainError("INVALID_PRICING_RULE", "Nazwa reguly cenowej jest wymagana.");
  }

  if (!Number.isFinite(input.pricePerNight) || input.pricePerNight < 0) {
    throw new DomainError("INVALID_PRICING_RULE", "Cena za noc musi byc liczba wieksza lub rowna zero.");
  }

  const dateFrom = normalizeDate(input.dateFrom, "data od");
  const dateTo = normalizeDate(input.dateTo, "data do");

  if (dateFrom > dateTo) {
    throw new DomainError("INVALID_PRICING_RULE", "Data koncowa nie moze byc wczesniejsza niz poczatkowa.");
  }

  if (input.minimumNights !== null && input.minimumNights !== undefined) {
    if (!Number.isFinite(input.minimumNights) || input.minimumNights <= 0) {
      throw new DomainError("INVALID_PRICING_RULE", "Minimalna liczba nocy musi byc wieksza od zera.");
    }
  }

  const priority = Number.isFinite(input.priority) ? Math.round(input.priority ?? 0) : 0;

  const daysOfWeek =
    input.ruleType === PricingRuleType.WEEKEND ? [5, 6] : Prisma.JsonNull;

  return prisma.pricingRule.update({
    where: {
      id: pricingRuleId,
    },
    data: {
      name,
      ruleType: input.ruleType,
      dateFrom,
      dateTo,
      pricePerNight: new Prisma.Decimal(input.pricePerNight.toFixed(2)),
      minimumNights:
        input.minimumNights !== null && input.minimumNights !== undefined
          ? Math.round(input.minimumNights)
          : null,
      priority,
      isActive: input.isActive,
      daysOfWeek,
    },
  });
}
