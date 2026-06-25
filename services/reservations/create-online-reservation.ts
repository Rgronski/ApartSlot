import { randomBytes, randomUUID } from "node:crypto";

import {
  checkAvailability,
  type CalendarBlockAvailabilityRecord,
  type ReservationAvailabilityRecord,
} from "@/services/availability";
import {
  calculateReservationPrice,
  type DepositConfig,
  type PricingRuleInput,
} from "@/services/pricing";
import { DomainError } from "@/lib/errors/domain-error";

export type ApartmentReservationInput = {
  id: string;
  name: string;
  slug: string;
  maxGuests: number;
  basePricePerNight: number;
  cleaningFee: number;
  depositAmount: number;
  currency: string;
  minimumNights: number;
};

export type GuestInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country?: string;
  city?: string;
  language?: string;
  marketingConsent?: boolean;
  termsAccepted: boolean;
  rodoAccepted: boolean;
};

export type ExistingGuestRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country?: string;
  city?: string;
  language?: string;
  marketingConsent?: boolean;
  termsAccepted?: boolean;
  rodoAccepted?: boolean;
};

export type CreateOnlineReservationInput = {
  apartment: ApartmentReservationInput;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  guestsCount: number;
  guest: GuestInput;
  customerNotes?: string;
  pricingRules?: PricingRuleInput[];
  discountAmount?: number;
  depositConfig?: DepositConfig;
  onlineHoldMinutes?: number;
  paymentBaseUrl: string;
  existingGuests?: ExistingGuestRecord[];
  existingReservations?: ReservationAvailabilityRecord[];
  calendarBlocks?: CalendarBlockAvailabilityRecord[];
  googleCalendarBusy?: boolean;
  now?: Date;
};

type GuestResolution =
  | {
      action: "reused";
      guestId: string;
      guest: ExistingGuestRecord;
    }
  | {
      action: "created";
      guestId: string;
      guest: ExistingGuestRecord;
    };

export type CreateOnlineReservationResult = {
  guestResolution: GuestResolution;
  reservationDraft: {
    id: string;
    reservationNumber: string;
    apartmentId: string;
    guestId: string;
    checkInDate: Date;
    checkOutDate: Date;
    nightsCount: number;
    guestsCount: number;
    pricePerNight: number;
    accommodationAmount: number;
    cleaningFee: number;
    depositAmount: number;
    discountAmount: number;
    totalAmount: number;
    amountToPayNow: number;
    paidAmount: number;
    currency: string;
    status: "PENDING_PAYMENT";
    paymentStatus: "CREATED";
    source: "WEBSITE";
    createdByType: "customer";
    holdExpiresAt: Date;
    customerNotes?: string;
  };
  paymentDraft: {
    id: string;
    reservationId: string;
    provider: "MOLLIE";
    paymentToken: string;
    paymentUrl: string;
    amount: number;
    currency: string;
    status: "CREATED";
    paymentExpiresAt: Date;
  };
  summary: {
    apartmentName: string;
    stayLabel: string;
    totalAmount: number;
    amountToPayNow: number;
    currency: string;
  };
};

function normalizeText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new DomainError(
      "INVALID_TEXT_FIELD",
      `Pole ${fieldName} jest wymagane.`,
    );
  }

  return normalized;
}

function normalizeEmail(email: string) {
  const normalized = normalizeText(email, "email").toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new DomainError("INVALID_EMAIL", "Adres e-mail jest niepoprawny.");
  }

  return normalized;
}

function normalizePhone(phone: string) {
  const normalized = normalizeText(phone, "phone");
  const digitsOnly = normalized.replace(/[^\d+]/g, "");

  if (digitsOnly.length < 7) {
    throw new DomainError("INVALID_PHONE", "Numer telefonu jest niepoprawny.");
  }

  return normalized;
}

function buildReservationNumber(now: Date) {
  const year = now.getUTCFullYear();
  const randomSuffix = randomBytes(3).toString("hex").toUpperCase();
  return `RES-${year}-${randomSuffix}`;
}

function buildPaymentToken() {
  return randomBytes(32).toString("hex");
}

function addMinutes(date: Date, minutes: number) {
  const result = new Date(date);
  result.setUTCMinutes(result.getUTCMinutes() + minutes);
  return result;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveGuest(
  guest: GuestInput,
  existingGuests: ExistingGuestRecord[] = [],
): GuestResolution {
  const normalizedEmail = normalizeEmail(guest.email);
  const normalizedPhone = normalizePhone(guest.phone);

  const matchedGuest = existingGuests.find((existingGuest) => {
    return (
      existingGuest.email.trim().toLowerCase() === normalizedEmail ||
      existingGuest.phone.trim() === normalizedPhone
    );
  });

  if (matchedGuest) {
    return {
      action: "reused",
      guestId: matchedGuest.id,
      guest: {
        ...matchedGuest,
        marketingConsent:
          guest.marketingConsent ?? matchedGuest.marketingConsent ?? false,
        termsAccepted: guest.termsAccepted,
        rodoAccepted: guest.rodoAccepted,
      },
    };
  }

  const guestId = randomUUID();

  return {
    action: "created",
    guestId,
    guest: {
      id: guestId,
      firstName: normalizeText(guest.firstName, "firstName"),
      lastName: normalizeText(guest.lastName, "lastName"),
      email: normalizedEmail,
      phone: normalizedPhone,
      country: guest.country?.trim() || undefined,
      city: guest.city?.trim() || undefined,
      language: guest.language?.trim() || "pl",
      marketingConsent: guest.marketingConsent ?? false,
      termsAccepted: guest.termsAccepted,
      rodoAccepted: guest.rodoAccepted,
    },
  };
}

function validateGuestConsents(guest: GuestInput) {
  if (!guest.termsAccepted) {
    throw new DomainError(
      "TERMS_NOT_ACCEPTED",
      "Klient musi zaakceptowac regulamin.",
    );
  }

  if (!guest.rodoAccepted) {
    throw new DomainError(
      "RODO_NOT_ACCEPTED",
      "Klient musi zaakceptowac zasady przetwarzania danych.",
    );
  }
}

export function createOnlineReservation(
  input: CreateOnlineReservationInput,
): CreateOnlineReservationResult {
  if (!input.paymentBaseUrl?.trim()) {
    throw new DomainError(
      "MISSING_PAYMENT_BASE_URL",
      "Brakuje bazowego adresu do linku platnosci.",
    );
  }

  if (!Number.isInteger(input.guestsCount) || input.guestsCount <= 0) {
    throw new DomainError(
      "INVALID_GUESTS_COUNT",
      "Liczba gosci musi byc dodatnia liczba calkowita.",
    );
  }

  if (input.guestsCount > input.apartment.maxGuests) {
    throw new DomainError(
      "MAX_GUESTS_EXCEEDED",
      `Maksymalna liczba gosci dla apartamentu to ${input.apartment.maxGuests}.`,
    );
  }

  validateGuestConsents(input.guest);

  const availabilityResult = checkAvailability({
    apartmentId: input.apartment.id,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    reservations: input.existingReservations,
    calendarBlocks: input.calendarBlocks,
    googleCalendarBusy: input.googleCalendarBusy,
  });

  if (!availabilityResult.isAvailable) {
    throw new DomainError(
      "TERM_NOT_AVAILABLE",
      "Wybrany termin jest juz zajety.",
    );
  }

  const priceResult = calculateReservationPrice({
    apartmentId: input.apartment.id,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    basePricePerNight: input.apartment.basePricePerNight,
    cleaningFee: input.apartment.cleaningFee,
    depositAmount: input.apartment.depositAmount,
    currency: input.apartment.currency,
    apartmentMinimumNights: input.apartment.minimumNights,
    pricingRules: input.pricingRules,
    discountAmount: input.discountAmount,
    depositConfig: input.depositConfig,
  });

  const guestResolution = resolveGuest(input.guest, input.existingGuests);
  const now = input.now ? new Date(input.now) : new Date();
  const holdExpiresAt = addMinutes(now, input.onlineHoldMinutes ?? 15);
  const reservationId = randomUUID();
  const paymentId = randomUUID();
  const paymentToken = buildPaymentToken();
  const paymentUrl = `${input.paymentBaseUrl.replace(/\/$/, "")}/${paymentToken}`;
  const reservationNumber = buildReservationNumber(now);

  const reservationDraft: CreateOnlineReservationResult["reservationDraft"] = {
    id: reservationId,
    reservationNumber,
    apartmentId: input.apartment.id,
    guestId: guestResolution.guestId,
    checkInDate: availabilityResult.normalizedCheckInDate,
    checkOutDate: availabilityResult.normalizedCheckOutDate,
    nightsCount: priceResult.nightsCount,
    guestsCount: input.guestsCount,
    pricePerNight:
      priceResult.nightlyBreakdown[0]?.pricePerNight ??
      input.apartment.basePricePerNight,
    accommodationAmount: priceResult.accommodationAmount,
    cleaningFee: priceResult.cleaningFee,
    depositAmount: priceResult.depositAmount,
    discountAmount: priceResult.discountAmount,
    totalAmount: priceResult.totalAmount,
    amountToPayNow: priceResult.amountToPayNow,
    paidAmount: 0,
    currency: priceResult.currency,
    status: "PENDING_PAYMENT",
    paymentStatus: "CREATED",
    source: "WEBSITE",
    createdByType: "customer",
    holdExpiresAt,
    customerNotes: input.customerNotes?.trim() || undefined,
  };

  const paymentDraft: CreateOnlineReservationResult["paymentDraft"] = {
    id: paymentId,
    reservationId,
    provider: "MOLLIE",
    paymentToken,
    paymentUrl,
    amount: priceResult.amountToPayNow,
    currency: priceResult.currency,
    status: "CREATED",
    paymentExpiresAt: holdExpiresAt,
  };

  return {
    guestResolution,
    reservationDraft,
    paymentDraft,
    summary: {
      apartmentName: input.apartment.name,
      stayLabel: `${formatDate(availabilityResult.normalizedCheckInDate)} - ${formatDate(
        availabilityResult.normalizedCheckOutDate,
      )}`,
      totalAmount: priceResult.totalAmount,
      amountToPayNow: priceResult.amountToPayNow,
      currency: priceResult.currency,
    },
  };
}
