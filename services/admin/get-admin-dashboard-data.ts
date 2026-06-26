import {
  EmailLogStatus,
  PaymentStatus,
  PricingRuleType,
  ReservationStatus,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getGoogleCalendarBusyMap } from "@/services/calendar";

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
  paymentUrl: string | null;
  paymentToken: string | null;
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
  paymentToken: string | null;
};

type DashboardEmailLog = {
  id: string;
  type: string;
  recipientEmail: string;
  subject: string;
  status: EmailLogStatus;
  reservationNumber: string | null;
  guestName: string | null;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
};

type DashboardPricingRuleRecord = {
  id: string;
  name: string;
  ruleType: PricingRuleType;
  dateFrom: Date;
  dateTo: Date;
  pricePerNight: number | { toString(): string };
  minimumNights: number | null;
  priority: number;
  isActive: boolean;
};

type DashboardApartment = {
  id: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
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
    source: "reservation" | "calendar_block" | "google_calendar";
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

type DashboardOwner = {
  id: string;
  name: string;
  username: string;
  email: string | null;
};

export type AdminDashboardData =
  | {
      state: "ready";
      metrics: DashboardMetric[];
      recentReservations: DashboardReservation[];
      recentEmailLogs: DashboardEmailLog[];
      attentionPayments: DashboardAttentionPayment[];
      apartments: DashboardApartment[];
      owners: DashboardOwner[];
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
  googleCalendarDates: {
    date: string;
    source: "google_calendar";
    label: string;
  }[] = [],
) {
  const occupancyMap = new Map<
    string,
    {
      date: string;
      source: "reservation" | "calendar_block" | "google_calendar";
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

  for (const googleDate of googleCalendarDates) {
    if (!occupancyMap.has(googleDate.date)) {
      occupancyMap.set(googleDate.date, googleDate);
    }
  }

  return Array.from(occupancyMap.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

export async function getAdminDashboardData(
  options: {
    monthStart: Date;
    monthEnd: Date;
    recentReservationsTake?: number;
    recentEmailLogsTake?: number;
    attentionPaymentsTake?: number;
  },
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
    const monthStart = options.monthStart;
    const monthEnd = options.monthEnd;
    const recentReservationsTake = options.recentReservationsTake ?? 6;
    const recentEmailLogsTake = options.recentEmailLogsTake ?? 10;
    const attentionPaymentsTake = options.attentionPaymentsTake ?? 6;

    const [apartmentCount, activeApartmentCount, apartments, owners] = await Promise.all([
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
        select: {
          id: true,
          ownerId: true,
          owner: {
            select: {
              name: true,
              username: true,
            },
          },
          name: true,
          slug: true,
          city: true,
          address: true,
          description: true,
          maxGuests: true,
          basePricePerNight: true,
          cleaningFee: true,
          depositAmount: true,
          minimumNights: true,
          defaultCheckInTime: true,
          defaultCheckOutTime: true,
          isActive: true,
          googleCalendarId: true,
        },
      }),
      db.owner.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
        },
      }),
    ]);

    const apartmentIds = apartments.map((apartment) => apartment.id);
    let googleCalendarBusyMap = new Map<
      string,
      {
        date: string;
        source: "google_calendar";
        label: string;
      }[]
    >();

    try {
      googleCalendarBusyMap = await getGoogleCalendarBusyMap({
        calendars: apartments.map((apartment) => ({
          apartmentId: apartment.id,
          calendarId: apartment.googleCalendarId,
        })),
        dateFrom: monthStart,
        dateTo: addDays(monthEnd, 1),
      });
    } catch (error) {
      console.error("Google Calendar occupancy load failed in admin", error);
    }

    const [apartmentReservations, apartmentCalendarBlocks, apartmentPricingRules] =
      apartmentIds.length === 0
        ? [[], [], []]
        : await Promise.all([
            db.reservation.findMany({
              where: {
                apartmentId: {
                  in: apartmentIds,
                },
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
                apartmentId: true,
                reservationNumber: true,
                checkInDate: true,
                checkOutDate: true,
              },
              orderBy: {
                checkInDate: "asc",
              },
            }),
            db.calendarBlock.findMany({
              where: {
                apartmentId: {
                  in: apartmentIds,
                },
                dateFrom: {
                  lte: monthEnd,
                },
                dateTo: {
                  gte: monthStart,
                },
              },
              select: {
                id: true,
                apartmentId: true,
                dateFrom: true,
                dateTo: true,
                reason: true,
              },
              orderBy: {
                dateFrom: "asc",
              },
            }),
            db.pricingRule.findMany({
              where: {
                apartmentId: {
                  in: apartmentIds,
                },
                isActive: true,
              },
              select: {
                id: true,
                apartmentId: true,
                name: true,
                ruleType: true,
                dateFrom: true,
                dateTo: true,
                pricePerNight: true,
                minimumNights: true,
                priority: true,
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
            }),
          ]);

    const reservationsByApartment = new Map<
      string,
      {
        reservationNumber: string;
        checkInDate: Date;
        checkOutDate: Date;
      }[]
    >();
    const calendarBlocksByApartment = new Map<
      string,
      {
        id: string;
        dateFrom: Date;
        dateTo: Date;
        reason: string | null;
      }[]
    >();
    const pricingRulesByApartment = new Map<
      string,
      DashboardPricingRuleRecord[]
    >();

    for (const reservation of apartmentReservations) {
      const current = reservationsByApartment.get(reservation.apartmentId) ?? [];
      current.push({
        reservationNumber: reservation.reservationNumber,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
      });
      reservationsByApartment.set(reservation.apartmentId, current);
    }

    for (const block of apartmentCalendarBlocks) {
      const current = calendarBlocksByApartment.get(block.apartmentId) ?? [];
      current.push({
        id: block.id,
        dateFrom: block.dateFrom,
        dateTo: block.dateTo,
        reason: block.reason,
      });
      calendarBlocksByApartment.set(block.apartmentId, current);
    }

    for (const rule of apartmentPricingRules) {
      const current = pricingRulesByApartment.get(rule.apartmentId) ?? [];
      current.push({
        id: rule.id,
        name: rule.name,
        ruleType: rule.ruleType,
        dateFrom: rule.dateFrom,
        dateTo: rule.dateTo,
        pricePerNight: rule.pricePerNight,
        minimumNights: rule.minimumNights,
        priority: rule.priority,
        isActive: rule.isActive,
      });
      pricingRulesByApartment.set(rule.apartmentId, current);
    }

    let pendingReservationCount = 0;
    let confirmedReservationCount = 0;
    let pendingPaymentCount = 0;
    let recentReservations: DashboardReservation[] = [];
    let recentEmailLogs: DashboardEmailLog[] = [];
    let attentionPayments: DashboardAttentionPayment[] = [];
    let warningMessage: string | undefined;

    try {
      const [
        pendingReservations,
        confirmedReservations,
        pendingPayments,
        reservations,
        emailLogs,
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
          take: recentReservationsTake,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            reservationNumber: true,
            checkInDate: true,
            checkOutDate: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            amountToPayNow: true,
            currency: true,
            createdAt: true,
            apartment: {
              select: {
                name: true,
              },
            },
            guest: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            payments: {
              take: 1,
              orderBy: {
                createdAt: "desc",
              },
              select: {
                paymentUrl: true,
                paymentToken: true,
              },
            },
          },
        }),
        db.emailLog.findMany({
          take: recentEmailLogsTake,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            type: true,
            recipientEmail: true,
            subject: true,
            status: true,
            errorMessage: true,
            createdAt: true,
            sentAt: true,
            reservation: {
              select: {
                reservationNumber: true,
              },
            },
            guest: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        db.payment.findMany({
          take: attentionPaymentsTake,
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
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paymentExpiresAt: true,
            paymentUrl: true,
            paymentToken: true,
            reservation: {
              select: {
                reservationNumber: true,
                guest: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
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
        paymentUrl: reservation.payments[0]?.paymentUrl ?? null,
        paymentToken: reservation.payments[0]?.paymentToken ?? null,
      }));
      recentEmailLogs = emailLogs.map((emailLog) => ({
        id: emailLog.id,
        type: emailLog.type,
        recipientEmail: emailLog.recipientEmail,
        subject: emailLog.subject,
        status: emailLog.status,
        reservationNumber: emailLog.reservation?.reservationNumber ?? null,
        guestName: emailLog.guest
          ? `${emailLog.guest.firstName} ${emailLog.guest.lastName}`
          : null,
        createdAt: formatDateTime(emailLog.createdAt),
        sentAt: emailLog.sentAt ? formatDateTime(emailLog.sentAt) : null,
        errorMessage: emailLog.errorMessage,
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
        paymentToken: payment.paymentToken,
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
      recentEmailLogs,
      attentionPayments,
      owners,
      apartments: apartments.map((apartment) => {
        const apartmentReservationsForCard =
          reservationsByApartment.get(apartment.id) ?? [];
        const apartmentCalendarBlocksForCard =
          calendarBlocksByApartment.get(apartment.id) ?? [];
        const apartmentPricingRulesForCard =
          pricingRulesByApartment.get(apartment.id) ?? [];
        const apartmentGoogleBusyDates =
          googleCalendarBusyMap.get(apartment.id) ?? [];

        return {
          id: apartment.id,
          ownerId: apartment.ownerId,
          ownerName: apartment.owner?.name ?? null,
          ownerUsername: apartment.owner?.username ?? null,
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
          calendarBlocks: apartmentCalendarBlocksForCard
            .slice(0, 6)
            .map((block) => ({
              id: block.id,
              dateFrom: formatDate(block.dateFrom),
              dateTo: formatDate(block.dateTo),
              reason: block.reason,
            })),
          occupancyDates: buildOccupancyDates(
            apartmentReservationsForCard,
            apartmentCalendarBlocksForCard,
            apartmentGoogleBusyDates,
          ),
          pricingRules: apartmentPricingRulesForCard.slice(0, 8).map((rule) => ({
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
        };
      }),
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
