import { NextRequest, NextResponse } from "next/server";

import { DomainError } from "@/lib/errors/domain-error";
import { createOnlineReservationWithPrisma } from "@/services/reservations";

type ReservationApiRequestBody = {
  apartmentId?: unknown;
  checkInDate?: unknown;
  checkOutDate?: unknown;
  guestsCount?: unknown;
  customerNotes?: unknown;
  discountAmount?: unknown;
  onlineHoldMinutes?: unknown;
  guest?: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    phone?: unknown;
    country?: unknown;
    city?: unknown;
    language?: unknown;
    marketingConsent?: unknown;
    termsAccepted?: unknown;
    rodoAccepted?: unknown;
  };
  depositConfig?: {
    type?: unknown;
    value?: unknown;
    minimumAmount?: unknown;
  };
};

function asTrimmedString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new DomainError(
      "INVALID_REQUEST_BODY",
      `Pole ${fieldName} jest wymagane i musi byc tekstem.`,
    );
  }

  return value.trim();
}

function asOptionalTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asPositiveInteger(value: unknown, fieldName: string) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new DomainError(
      "INVALID_REQUEST_BODY",
      `Pole ${fieldName} musi byc dodatnia liczba calkowita.`,
    );
  }

  return Number(value);
}

function asOptionalNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new DomainError(
      "INVALID_REQUEST_BODY",
      `Pole ${fieldName} musi byc liczba.`,
    );
  }

  return value;
}

function asBoolean(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw new DomainError(
      "INVALID_REQUEST_BODY",
      `Pole ${fieldName} musi byc wartoscia true albo false.`,
    );
  }

  return value;
}

function parseDepositConfig(
  depositConfig: ReservationApiRequestBody["depositConfig"],
) {
  if (!depositConfig) {
    return undefined;
  }

  if (
    depositConfig.type !== "percent" &&
    depositConfig.type !== "fixed"
  ) {
    throw new DomainError(
      "INVALID_REQUEST_BODY",
      "Pole depositConfig.type musi miec wartosc percent albo fixed.",
    );
  }

  const value = asOptionalNumber(depositConfig.value, "depositConfig.value");

  if (value === undefined) {
    throw new DomainError(
      "INVALID_REQUEST_BODY",
      "Pole depositConfig.value jest wymagane.",
    );
  }

  if (depositConfig.type === "fixed") {
    return {
      type: "fixed" as const,
      value,
    };
  }

  return {
    type: "percent" as const,
    value,
    minimumAmount: asOptionalNumber(
      depositConfig.minimumAmount,
      "depositConfig.minimumAmount",
    ),
  };
}

function parseRequestBody(body: ReservationApiRequestBody) {
  if (!body.guest) {
    throw new DomainError(
      "INVALID_REQUEST_BODY",
      "Brakuje danych klienta w polu guest.",
    );
  }

  return {
    apartmentId: asTrimmedString(body.apartmentId, "apartmentId"),
    checkInDate: asTrimmedString(body.checkInDate, "checkInDate"),
    checkOutDate: asTrimmedString(body.checkOutDate, "checkOutDate"),
    guestsCount: asPositiveInteger(body.guestsCount, "guestsCount"),
    customerNotes: asOptionalTrimmedString(body.customerNotes),
    discountAmount: asOptionalNumber(body.discountAmount, "discountAmount"),
    onlineHoldMinutes: asOptionalNumber(
      body.onlineHoldMinutes,
      "onlineHoldMinutes",
    ),
    guest: {
      firstName: asTrimmedString(body.guest.firstName, "guest.firstName"),
      lastName: asTrimmedString(body.guest.lastName, "guest.lastName"),
      email: asTrimmedString(body.guest.email, "guest.email"),
      phone: asTrimmedString(body.guest.phone, "guest.phone"),
      country: asOptionalTrimmedString(body.guest.country),
      city: asOptionalTrimmedString(body.guest.city),
      language: asOptionalTrimmedString(body.guest.language),
      marketingConsent:
        body.guest.marketingConsent === undefined
          ? undefined
          : asBoolean(body.guest.marketingConsent, "guest.marketingConsent"),
      termsAccepted: asBoolean(body.guest.termsAccepted, "guest.termsAccepted"),
      rodoAccepted: asBoolean(body.guest.rodoAccepted, "guest.rodoAccepted"),
    },
    depositConfig: parseDepositConfig(body.depositConfig),
  };
}

function getPaymentBaseUrl(request: NextRequest) {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, "")}/pay`;
  }

  return `${request.nextUrl.origin}/pay`;
}

function mapErrorToStatus(error: DomainError) {
  switch (error.code) {
    case "INVALID_REQUEST_BODY":
    case "INVALID_DATE":
    case "INVALID_DATE_RANGE":
    case "INVALID_EMAIL":
    case "INVALID_PHONE":
    case "INVALID_GUESTS_COUNT":
    case "MAX_GUESTS_EXCEEDED":
    case "TERMS_NOT_ACCEPTED":
    case "RODO_NOT_ACCEPTED":
    case "MINIMUM_NIGHTS_NOT_MET":
    case "MINIMUM_NIGHTS_RULE_NOT_MET":
      return 400;
    case "APARTMENT_NOT_FOUND":
      return 404;
    case "TERM_NOT_AVAILABLE":
      return 409;
    default:
      return 422;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReservationApiRequestBody;
    const parsed = parseRequestBody(body);

    const result = await createOnlineReservationWithPrisma({
      apartmentId: parsed.apartmentId,
      checkInDate: parsed.checkInDate,
      checkOutDate: parsed.checkOutDate,
      guestsCount: parsed.guestsCount,
      customerNotes: parsed.customerNotes,
      discountAmount: parsed.discountAmount,
      onlineHoldMinutes: parsed.onlineHoldMinutes,
      depositConfig: parsed.depositConfig,
      paymentBaseUrl: getPaymentBaseUrl(request),
      guest: parsed.guest,
    });

    return NextResponse.json(
      {
        success: true,
        reservation: {
          id: result.reservationDraft.id,
          reservationNumber: result.reservationDraft.reservationNumber,
          status: result.reservationDraft.status,
          paymentStatus: result.reservationDraft.paymentStatus,
          holdExpiresAt: result.reservationDraft.holdExpiresAt,
        },
        payment: {
          id: result.paymentDraft.id,
          paymentUrl: result.paymentDraft.paymentUrl,
          paymentToken: result.paymentDraft.paymentToken,
          amount: result.paymentDraft.amount,
          currency: result.paymentDraft.currency,
          expiresAt: result.paymentDraft.paymentExpiresAt,
        },
        summary: result.summary,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: mapErrorToStatus(error),
        },
      );
    }

    console.error("POST /api/reservations failed", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udalo sie utworzyc rezerwacji.",
        },
      },
      {
        status: 500,
      },
    );
  }
}
