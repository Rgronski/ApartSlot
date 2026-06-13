import { DomainError } from "@/lib/errors/domain-error";

export type PricingRuleInput = {
  id: string;
  apartmentId: string;
  name: string;
  ruleType?: "SEASONAL" | "WEEKEND" | "EVENT" | "CUSTOM";
  dateFrom: Date | string;
  dateTo: Date | string;
  pricePerNight: number;
  minimumNights?: number | null;
  daysOfWeek?: number[] | null;
  priority: number;
  isActive: boolean;
};

export type DepositConfig =
  | {
      type: "percent";
      value: number;
      minimumAmount?: number;
    }
  | {
      type: "fixed";
      value: number;
    };

export type CalculateReservationPriceInput = {
  apartmentId: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  basePricePerNight: number;
  cleaningFee: number;
  depositAmount: number;
  currency: string;
  apartmentMinimumNights?: number;
  pricingRules?: PricingRuleInput[];
  discountAmount?: number;
  depositConfig?: DepositConfig;
};

export type NightlyBreakdownItem = {
  date: string;
  pricePerNight: number;
  source: "base_price" | "pricing_rule";
  pricingRuleId?: string;
  pricingRuleName?: string;
};

export type CalculateReservationPriceResult = {
  nightsCount: number;
  nightlyBreakdown: NightlyBreakdownItem[];
  accommodationAmount: number;
  cleaningFee: number;
  depositAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountToPayNow: number;
  currency: string;
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

function assertPositiveOrZero(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError(
      "INVALID_PRICE_VALUE",
      `Pole ${fieldName} musi byc liczba wieksza lub rowna zero.`,
    );
  }
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function calculateNightsCount(checkInDate: Date, checkOutDate: Date) {
  const differenceInMs = checkOutDate.getTime() - checkInDate.getTime();
  return differenceInMs / (1000 * 60 * 60 * 24);
}

function getApplicableRule(
  apartmentId: string,
  date: Date,
  rules: PricingRuleInput[],
) {
  const dayOfWeek = date.getUTCDay();

  const applicableRules = rules.filter((rule) => {
    if (!rule.isActive || rule.apartmentId !== apartmentId) {
      return false;
    }

    const ruleStart = normalizeDateInput(rule.dateFrom, "pricingRule.dateFrom");
    const ruleEnd = normalizeDateInput(rule.dateTo, "pricingRule.dateTo");
    const isWithinDateRange = date >= ruleStart && date <= ruleEnd;

    if (!isWithinDateRange) {
      return false;
    }

    if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) {
      return true;
    }

    return rule.daysOfWeek.includes(dayOfWeek);
  });

  applicableRules.sort((left, right) => right.priority - left.priority);

  return applicableRules[0];
}

function calculateAmountToPayNow(
  totalAmount: number,
  depositConfig: DepositConfig | undefined,
) {
  if (!depositConfig) {
    return totalAmount;
  }

  if (depositConfig.type === "fixed") {
    return roundMoney(Math.min(totalAmount, depositConfig.value));
  }

  const percentAmount = (totalAmount * depositConfig.value) / 100;
  const amountWithMinimum = Math.max(
    percentAmount,
    depositConfig.minimumAmount ?? 0,
  );

  return roundMoney(Math.min(totalAmount, amountWithMinimum));
}

export function calculateReservationPrice(
  input: CalculateReservationPriceInput,
): CalculateReservationPriceResult {
  if (!input.apartmentId?.trim()) {
    throw new DomainError(
      "MISSING_APARTMENT_ID",
      "Brakuje identyfikatora apartamentu.",
    );
  }

  const checkInDate = normalizeDateInput(input.checkInDate, "checkInDate");
  const checkOutDate = normalizeDateInput(input.checkOutDate, "checkOutDate");

  assertDateRange(checkInDate, checkOutDate);

  assertPositiveOrZero(input.basePricePerNight, "basePricePerNight");
  assertPositiveOrZero(input.cleaningFee, "cleaningFee");
  assertPositiveOrZero(input.depositAmount, "depositAmount");
  assertPositiveOrZero(input.discountAmount ?? 0, "discountAmount");

  if (!input.currency?.trim()) {
    throw new DomainError("MISSING_CURRENCY", "Brakuje waluty rezerwacji.");
  }

  const nightsCount = calculateNightsCount(checkInDate, checkOutDate);

  if (!Number.isInteger(nightsCount) || nightsCount <= 0) {
    throw new DomainError(
      "INVALID_NIGHTS_COUNT",
      "Nie udalo sie poprawnie obliczyc liczby nocy.",
    );
  }

  if (
    input.apartmentMinimumNights &&
    nightsCount < input.apartmentMinimumNights
  ) {
    throw new DomainError(
      "MINIMUM_NIGHTS_NOT_MET",
      `Minimalna liczba nocy dla tego apartamentu to ${input.apartmentMinimumNights}.`,
    );
  }

  const nightlyBreakdown: NightlyBreakdownItem[] = [];

  for (let offset = 0; offset < nightsCount; offset += 1) {
    const stayDate = addDays(checkInDate, offset);
    const rule = getApplicableRule(
      input.apartmentId,
      stayDate,
      input.pricingRules ?? [],
    );

    if (rule?.minimumNights && nightsCount < rule.minimumNights) {
      throw new DomainError(
        "MINIMUM_NIGHTS_RULE_NOT_MET",
        `Regula cenowa ${rule.name} wymaga co najmniej ${rule.minimumNights} nocy.`,
      );
    }

    nightlyBreakdown.push({
      date: toIsoDate(stayDate),
      pricePerNight: roundMoney(rule?.pricePerNight ?? input.basePricePerNight),
      source: rule ? "pricing_rule" : "base_price",
      pricingRuleId: rule?.id,
      pricingRuleName: rule?.name,
    });
  }

  const accommodationAmount = roundMoney(
    nightlyBreakdown.reduce((sum, night) => sum + night.pricePerNight, 0),
  );
  const cleaningFee = roundMoney(input.cleaningFee);
  const depositAmount = roundMoney(input.depositAmount);
  const discountAmount = roundMoney(input.discountAmount ?? 0);
  const totalAmount = roundMoney(
    Math.max(0, accommodationAmount + cleaningFee + depositAmount - discountAmount),
  );
  const amountToPayNow = calculateAmountToPayNow(
    totalAmount,
    input.depositConfig,
  );

  return {
    nightsCount,
    nightlyBreakdown,
    accommodationAmount,
    cleaningFee,
    depositAmount,
    discountAmount,
    totalAmount,
    amountToPayNow,
    currency: input.currency,
  };
}
