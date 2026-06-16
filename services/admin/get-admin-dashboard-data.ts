import {
  PaymentStatus,
  PricingRuleType,
  ReservationStatus,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
};

type DashboardReservation = {
  id: string;
  reservationNumber: string;
  apartmentName: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  amountToPayNow: number;
  currency: string;
  createdAt: string;
};

type DashboardAttentionPayment = {
  id: string;
  reservationNumber: string;
  guestName: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  expiresAt: string | null;
  paymentUrl: string | null;
};

type DashboardApartment = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  description: string | null;
  maxGuests: number;
  basePricePerNight: number;
  cleaningFee: number;
  depositAmount: number;
  minimumNights: number;
  defaultCheckInTime: string | null;
  defaultCheckOutTime: string | null;
  isActive: boolean;
  googleCalendarId: string | null;
  calendarBlocks: {
    id: string;
    dateFrom: string;
    dateTo: string;
    reason: string | null;
  }[];
  occupancyDates: {
    date: string;
    source: "reservation" | "calendar_block";
    label: string;
  }[];
  pricingRules: {
    id: string;
    name: string;
    ruleType: PricingRuleType;
    dateFrom: string;
    dateTo: string;
    pricePerNight: number;
    minimumNights: number | null;
    priority: number;
    isActive: boolean;
  }[];
};

export type AdminDashboardData =
  | {
      state: "ready";
      metrics: DashboardMetric[];
      recentReservations: DashboardReservation[];
      attentionPayments: DashboardAttentionPayment[];
      apartments: DashboardApartment[];
      warningMessage?: string;
    }
  | {
      state: "missing_database";
      message: string;
    }
  | {
      state: "error";
      message: string;
    };

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatMoney(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildOccupancyDates(
  reservations: {
    checkInDate: Date;
    checkOutDate: Date;
    reservationNumber: string;
  }[],
  calendarBlocks: {
    dateFrom: Date;
    dateTo: Date;
    reason: string | null;
  }[],
) {
  const occupancyMap = new Map<
    string,
    {
      date: string;
      source: "reservation" | "calendar_block";
      label: string;
    }
  >();

  for (const reservation of reservations) {
    for (
      let cursor = new Date(reservation.checkInDate);
      cursor < reservation.checkOutDate;
      cursor = addDays(cursor, 1)
    ) {
      const isoDate = formatDate(cursor);
      occupancyMap.set(isoDate, {
        date: isoDate,
        source: "reservation",
        label: `Rezerwacja ${reservation.reservationNumber}`,
      });
    }
  }

  for (const block of calendarBlocks) {
    for (
      let cursor = new Date(block.dateFrom);
      cursor <= block.dateTo;
      cursor = addDays(cursor, 1)
    ) {
      const isoDate = formatDate(cursor);
      occupancyMap.set(isoDate, {
        date: isoDate,
        source: "calendar_block",
        label: block.reason ?? "Blokada reczna",
      });
    }
  }

  return Array.from(occupancyMap.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export async function getAdminDashboardData(
  db: PrismaClient = prisma,
): Promise<AdminDashboardData> {
  if (!process.env.DATABASE_URL) {
    return {
      state: "missing_database",
      message:
        "Baza danych nie jest jeszcze podlaczona. Dodaj DATABASE_URL i DIRECT_URL, aby panel mogl pobierac rezerwacje oraz platnosci.",
    };
  }

  try {
    const today = new Date();
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );

    const [apartmentCount, activeApartmentCount, apartments] = await Promise.all([
      db.apartment.count(),
      db.apartment.count({
        where: {
          isActive: true,
        },
      }),
      db.apartment.findMany({
        take: 6,
        orderBy: {
          createdAt: "asc",
        },
        include: {
          reservations: {
            where: {
              status: {
                in: [
                  ReservationStatus.PENDING_PAYMENT,
                  ReservationStatus.CONFIRMED,
                  ReservationStatus.MANUAL_BLOCK,
                ],
              },
              checkInDate: {
                lte: monthEnd,
              },
              checkOutDate: {
                gt: monthStart,
              },
            },
            select: {
              reservationNumber: true,
              checkInDate: true,
              checkOutDate: true,
            },
          },
          calendarBlocks: {
            where: {
              dateFrom: {
                lte: monthEnd,
              },
              dateTo: {
                gte: monthStart,
              },
            },
            orderBy: {
              dateFrom: "asc",
            },
            take: 6,
          },
          pricingRules: {
            where: {
              isActive: true,
            },
            orderBy: [
              {
                priority: "desc",
              },
              {
                dateFrom: "asc",
              },
            ],
            take: 8,
          },
        },
      }),
    ]);

    let pendingReservationCount = 0;
    let confirmedReservationCount = 0;
    let pendingPaymentCount = 0;
    let recentReservations: DashboardReservation[] = [];
    let attentionPayments: DashboardAttentionPayment[] = [];
    let warningMessage: string | undefined;

    try {
      const [
        pendingReservations,
        confirmedReservations,
        pendingPayments,
        reservations,
        payments,
      ] = await Promise.all([
        db.reservation.count({
          where: {
            status: ReservationStatus.PENDING_PAYMENT,
          },
        }),
        db.reservation.count({
          where: {
            status: ReservationStatus.CONFIRMED,
          },
        }),
        db.payment.count({
          where: {
            status: {
              in: [PaymentStatus.CREATED, PaymentStatus.LINK_SENT, PaymentStatus.PENDING],
            },
          },
        }),
        db.reservation.findMany({
          take: 6,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            apartment: true,
            guest: true,
          },
        }),
        db.payment.findMany({
          take: 6,
          orderBy: [
            {
              paymentExpiresAt: "asc",
            },
            {
              createdAt: "desc",
            },
          ],
          where: {
            status: {
              in: [PaymentStatus.CREATED, PaymentStatus.LINK_SENT, PaymentStatus.PENDING],
            },
          },
          include: {
            reservation: {
              include: {
                guest: true,
              },
            },
          },
        }),
      ]);

      pendingReservationCount = pendingReservations;
      confirmedReservationCount = confirmedReservations;
      pendingPaymentCount = pendingPayments;
      recentReservations = reservations.map((reservation) => ({
        id: reservation.id,
        reservationNumber: reservation.reservationNumber,
        apartmentName: reservation.apartment.name,
        guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
        checkInDate: formatDate(reservation.checkInDate),
        checkOutDate: formatDate(reservation.checkOutDate),
        status: reservation.status,
        paymentStatus: reservation.paymentStatus,
        totalAmount: Number(reservation.totalAmount),
        amountToPayNow: Number(reservation.amountToPayNow),
        currency: reservation.currency,
        createdAt: formatDateTime(reservation.createdAt),
      }));
      attentionPayments = payments.map((payment) => ({
        id: payment.id,
        reservationNumber: payment.reservation.reservationNumber,
        guestName: `${payment.reservation.guest.firstName} ${payment.reservation.guest.lastName}`,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        expiresAt: payment.paymentExpiresAt ? formatDateTime(payment.paymentExpiresAt) : null,
        paymentUrl: payment.paymentUrl,
      }));
    } catch {
      warningMessage =
        "Czesc dashboardu dotyczaca rezerwacji i platnosci jest jeszcze w konfiguracji. Apartamenty dzialaja poprawnie.";
    }

    return {
      state: "ready",
      metrics: [
        {
          label: "Apartamenty",
          value: String(apartmentCount),
          hint: `${activeApartmentCount} aktywne do sprzedazy`,
        },
        {
          label: "Rezerwacje oczekujace",
          value: String(pendingReservationCount),
          hint: warningMessage
            ? "Sekcja czasowo niedostepna podczas konfiguracji dashboardu"
            : "Klienci czekaja na platnosc lub jej potwierdzenie",
        },
        {
          label: "Rezerwacje potwierdzone",
          value: String(confirmedReservationCount),
          hint: warningMessage
            ? "Sekcja czasowo niedostepna podczas konfiguracji dashboardu"
            : "Te pobyty sa juz zamkniete po stronie sprzedazy",
        },
        {
          label: "Platnosci do dopilnowania",
          value: String(pendingPaymentCount),
          hint: warningMessage
            ? "Sekcja czasowo niedostepna podczas konfiguracji dashboardu"
            : "Link wyslany lub platnosc nadal w toku",
        },
      ],
      recentReservations,
      attentionPayments,
      apartments: apartments.map((apartment) => ({
        id: apartment.id,
        name: apartment.name,
        slug: apartment.slug,
        city: apartment.city,
        address: apartment.address,
        description: apartment.description,
        maxGuests: apartment.maxGuests,
        basePricePerNight: Number(apartment.basePricePerNight),
        cleaningFee: Number(apartment.cleaningFee),
        depositAmount: Number(apartment.depositAmount),
        minimumNights: apartment.minimumNights,
        defaultCheckInTime: apartment.defaultCheckInTime,
        defaultCheckOutTime: apartment.defaultCheckOutTime,
        isActive: apartment.isActive,
        googleCalendarId: apartment.googleCalendarId,
        calendarBlocks: apartment.calendarBlocks.map((block) => ({
          id: block.id,
          dateFrom: formatDate(block.dateFrom),
          dateTo: formatDate(block.dateTo),
          reason: block.reason,
        })),
        occupancyDates: buildOccupancyDates(
          apartment.reservations,
          apartment.calendarBlocks,
        ),
        pricingRules: apartment.pricingRules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          ruleType: rule.ruleType,
          dateFrom: formatDate(rule.dateFrom),
          dateTo: formatDate(rule.dateTo),
          pricePerNight: Number(rule.pricePerNight),
          minimumNights: rule.minimumNights,
          priority: rule.priority,
          isActive: rule.isActive,
        })),
      })),
      warningMessage,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udalo sie pobrac danych do panelu administratora.";

    return {
      state: "error",
      message,
    };
  }
}

export function formatDashboardMoney(value: number, currency: string) {
  return formatMoney(value, currency);
}
