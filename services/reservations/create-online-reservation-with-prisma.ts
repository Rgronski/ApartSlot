import {
  Prisma,
  PrismaClient,
  type CalendarBlock,
  type Guest,
  type PricingRule,
  type Reservation,
} from "@prisma/client";

import { DomainError } from "@/lib/errors/domain-error";
import { prisma } from "@/lib/db/prisma";
import { getGoogleCalendarBusyMap } from "@/services/calendar";
import { createOnlineReservation, type CreateOnlineReservationResult, type GuestInput } from "@/services/reservations/create-online-reservation";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export type CreateOnlineReservationWithPrismaInput = {
  apartmentId: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  guestsCount: number;
  guest: GuestInput;
  customerNotes?: string;
  discountAmount?: number;
  depositConfig?: {
    type: "percent" | "fixed";
    value: number;
    minimumAmount?: number;
  };
  onlineHoldMinutes?: number;
  paymentBaseUrl: string;
  googleCalendarBusy?: boolean;
  now?: Date;
};

export type CreateOnlineReservationWithPrismaResult =
  CreateOnlineReservationResult & {
    persistedGuest: Guest;
  };

function normalizeDateInput(value: Date | string): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new DomainError("INVALID_DATE", "Przekazano niepoprawna date.");
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function parseDaysOfWeek(value: Prisma.JsonValue | null): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isInteger(item));

  return parsed.length > 0 ? parsed : null;
}

function mapPricingRule(rule: PricingRule) {
  return {
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
  } as const;
}

function mapReservationForAvailability(reservation: Reservation) {
  return {
    id: reservation.id,
    apartmentId: reservation.apartmentId,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    status: reservation.status,
  };
}

function mapCalendarBlockForAvailability(calendarBlock: CalendarBlock) {
  return {
    id: calendarBlock.id,
    apartmentId: calendarBlock.apartmentId,
    dateFrom: calendarBlock.dateFrom,
    dateTo: calendarBlock.dateTo,
    reason: calendarBlock.reason,
  };
}

function mapGuestForResolution(guest: Guest) {
  return {
    id: guest.id,
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email,
    phone: guest.phone,
    country: guest.country ?? undefined,
    city: guest.city ?? undefined,
    language: guest.language ?? undefined,
    marketingConsent: guest.marketingConsent,
    termsAccepted: guest.termsAccepted,
    rodoAccepted: guest.rodoAccepted,
  };
}

async function loadApartmentOrThrow(
  tx: PrismaDbClient,
  apartmentId: string,
) {
  const apartment = await tx.apartment.findFirst({
    where: {
      id: apartmentId,
      isActive: true,
    },
  });

  if (!apartment) {
    throw new DomainError(
      "APARTMENT_NOT_FOUND",
      "Nie znaleziono aktywnego apartamentu.",
    );
  }

  return apartment;
}

async function loadAvailabilityContext(
  tx: PrismaDbClient,
  apartmentId: string,
  checkInDate: Date,
  checkOutDate: Date,
) {
  const [reservations, calendarBlocks] = await Promise.all([
    tx.reservation.findMany({
      where: {
        apartmentId,
        status: {
          in: ["PENDING_PAYMENT", "CONFIRMED", "MANUAL_BLOCK"],
        },
        checkInDate: {
          lt: checkOutDate,
        },
        checkOutDate: {
          gt: checkInDate,
        },
      },
    }),
    tx.calendarBlock.findMany({
      where: {
        apartmentId,
        dateFrom: {
          lt: checkOutDate,
        },
        dateTo: {
          gt: checkInDate,
        },
      },
    }),
  ]);

  return {
    reservations: reservations.map(mapReservationForAvailability),
    calendarBlocks: calendarBlocks.map(mapCalendarBlockForAvailability),
  };
}

async function loadExistingGuests(tx: PrismaDbClient, guest: GuestInput) {
  return tx.guest.findMany({
    where: {
      OR: [
        {
          email: {
            equals: guest.email.trim().toLowerCase(),
            mode: "insensitive",
          },
        },
        {
          phone: guest.phone.trim(),
        },
      ],
    },
    take: 5,
  });
}

async function loadPricingRules(tx: PrismaDbClient, apartmentId: string) {
  const pricingRules = await tx.pricingRule.findMany({
    where: {
      apartmentId,
      isActive: true,
    },
    orderBy: {
      priority: "desc",
    },
  });

  return pricingRules.map(mapPricingRule);
}

async function loadGoogleCalendarBusy(input: {
  apartmentId: string;
  googleCalendarId: string | null;
  checkInDate: Date;
  checkOutDate: Date;
}) {
  if (!input.googleCalendarId?.trim()) {
    return false;
  }

  const busyMap = await getGoogleCalendarBusyMap({
    calendars: [
      {
        apartmentId: input.apartmentId,
        calendarId: input.googleCalendarId,
      },
    ],
    dateFrom: input.checkInDate,
    dateTo: input.checkOutDate,
  });

  return (busyMap.get(input.apartmentId)?.length ?? 0) > 0;
}

async function persistGuest(
  tx: PrismaDbClient,
  result: CreateOnlineReservationResult,
) {
  const guestData = result.guestResolution.guest;

  if (result.guestResolution.action === "reused") {
    return tx.guest.update({
      where: {
        id: result.guestResolution.guestId,
      },
      data: {
        firstName: guestData.firstName,
        lastName: guestData.lastName,
        email: guestData.email,
        phone: guestData.phone,
        country: guestData.country,
        city: guestData.city,
        language: guestData.language,
        marketingConsent: guestData.marketingConsent ?? false,
        termsAccepted: guestData.termsAccepted ?? true,
        rodoAccepted: guestData.rodoAccepted ?? true,
      },
    });
  }

  return tx.guest.create({
    data: {
      id: guestData.id,
      firstName: guestData.firstName,
      lastName: guestData.lastName,
      email: guestData.email,
      phone: guestData.phone,
      country: guestData.country,
      city: guestData.city,
      language: guestData.language,
      marketingConsent: guestData.marketingConsent ?? false,
      termsAccepted: guestData.termsAccepted ?? true,
      rodoAccepted: guestData.rodoAccepted ?? true,
    },
  });
}

export async function createOnlineReservationWithPrisma(
  input: CreateOnlineReservationWithPrismaInput,
  db: PrismaClient = prisma,
): Promise<CreateOnlineReservationWithPrismaResult> {
  const normalizedCheckInDate = normalizeDateInput(input.checkInDate);
  const normalizedCheckOutDate = normalizeDateInput(input.checkOutDate);
  const apartment = await loadApartmentOrThrow(db, input.apartmentId);
  const googleCalendarBusy = await loadGoogleCalendarBusy({
    apartmentId: apartment.id,
    googleCalendarId: apartment.googleCalendarId,
    checkInDate: normalizedCheckInDate,
    checkOutDate: normalizedCheckOutDate,
  });

  return db.$transaction(
    async (tx) => {
      const pricingRules = await loadPricingRules(tx, apartment.id);
      const { reservations, calendarBlocks } = await loadAvailabilityContext(
        tx,
        apartment.id,
        normalizedCheckInDate,
        normalizedCheckOutDate,
      );
      const existingGuests = await loadExistingGuests(tx, input.guest);

      const result = createOnlineReservation({
        apartment: {
          id: apartment.id,
          name: apartment.name,
          slug: apartment.slug,
          maxGuests: apartment.maxGuests,
          basePricePerNight: Number(apartment.basePricePerNight),
          cleaningFee: Number(apartment.cleaningFee),
          depositAmount: Number(apartment.depositAmount),
          currency: apartment.currency,
          minimumNights: apartment.minimumNights,
        },
        checkInDate: normalizedCheckInDate,
        checkOutDate: normalizedCheckOutDate,
        guestsCount: input.guestsCount,
        guest: input.guest,
        customerNotes: input.customerNotes,
        pricingRules,
        discountAmount: input.discountAmount,
        depositConfig: input.depositConfig,
        onlineHoldMinutes: input.onlineHoldMinutes,
        paymentBaseUrl: input.paymentBaseUrl,
        existingGuests: existingGuests.map(mapGuestForResolution),
        existingReservations: reservations,
        calendarBlocks,
        googleCalendarBusy: input.googleCalendarBusy ?? googleCalendarBusy,
        now: input.now,
      });

      const persistedGuest = await persistGuest(tx, result);

      await tx.reservation.create({
        data: {
          id: result.reservationDraft.id,
          reservationNumber: result.reservationDraft.reservationNumber,
          apartmentId: result.reservationDraft.apartmentId,
          guestId: persistedGuest.id,
          checkInDate: result.reservationDraft.checkInDate,
          checkOutDate: result.reservationDraft.checkOutDate,
          nightsCount: result.reservationDraft.nightsCount,
          guestsCount: result.reservationDraft.guestsCount,
          pricePerNight: result.reservationDraft.pricePerNight,
          accommodationAmount: result.reservationDraft.accommodationAmount,
          cleaningFee: result.reservationDraft.cleaningFee,
          depositAmount: result.reservationDraft.depositAmount,
          discountAmount: result.reservationDraft.discountAmount,
          totalAmount: result.reservationDraft.totalAmount,
          amountToPayNow: result.reservationDraft.amountToPayNow,
          paidAmount: result.reservationDraft.paidAmount,
          currency: result.reservationDraft.currency,
          status: result.reservationDraft.status,
          paymentStatus: result.reservationDraft.paymentStatus,
          source: result.reservationDraft.source,
          createdByType: result.reservationDraft.createdByType,
          holdExpiresAt: result.reservationDraft.holdExpiresAt,
          customerNotes: result.reservationDraft.customerNotes,
        },
      });

      await tx.payment.create({
        data: {
          id: result.paymentDraft.id,
          reservationId: result.paymentDraft.reservationId,
          provider: result.paymentDraft.provider,
          paymentToken: result.paymentDraft.paymentToken,
          paymentUrl: result.paymentDraft.paymentUrl,
          amount: result.paymentDraft.amount,
          currency: result.paymentDraft.currency,
          status: result.paymentDraft.status,
          paymentExpiresAt: result.paymentDraft.paymentExpiresAt,
        },
      });

      return {
        ...result,
        reservationDraft: {
          ...result.reservationDraft,
          guestId: persistedGuest.id,
        },
        persistedGuest,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
