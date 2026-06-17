import { GaxiosError } from "gaxios";

import { getGoogleCalendarClient } from "@/integrations/google-calendar/client";
import { DomainError } from "@/lib/errors/domain-error";

type GoogleCalendarIntegrationInput = {
  apartments: {
    id: string;
    name: string;
    googleCalendarId: string | null;
  }[];
};

export type GoogleCalendarIntegrationStatus = {
  serviceAccountReady: boolean;
  serviceAccountEmail: string | null;
  fallbackCalendarId: string | null;
  apartments: {
    apartmentId: string;
    apartmentName: string;
    calendarId: string | null;
    status:
      | "ok"
      | "missing_calendar_id"
      | "missing_service_account"
      | "calendar_not_found"
      | "access_denied"
      | "error";
    message: string;
    resolvedCalendarName: string | null;
  }[];
};

export async function getGoogleCalendarIntegrationStatus(
  input: GoogleCalendarIntegrationInput,
): Promise<GoogleCalendarIntegrationStatus> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null;
  const fallbackCalendarId = process.env.GOOGLE_CALENDAR_FALLBACK_ID?.trim() || null;
  const serviceAccountReady = Boolean(
    serviceAccountEmail && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );

  let calendarClient: ReturnType<typeof getGoogleCalendarClient> | null = null;

  if (serviceAccountReady) {
    try {
      calendarClient = getGoogleCalendarClient();
    } catch (error) {
      if (
        error instanceof DomainError &&
        error.code === "MISSING_GOOGLE_CALENDAR_CONFIG"
      ) {
        calendarClient = null;
      } else {
        throw error;
      }
    }
  }

  const apartments = await Promise.all(
    input.apartments.map(async (apartment) => {
      const calendarId = apartment.googleCalendarId?.trim() || null;

      if (!calendarId) {
        return {
          apartmentId: apartment.id,
          apartmentName: apartment.name,
          calendarId: null,
          status: "missing_calendar_id" as const,
          message: "Brakuje Google Calendar ID w tym apartamencie.",
          resolvedCalendarName: null,
        };
      }

      if (!calendarClient) {
        return {
          apartmentId: apartment.id,
          apartmentName: apartment.name,
          calendarId,
          status: "missing_service_account" as const,
          message: "Brakuje danych konta serwisowego Google w Vercel.",
          resolvedCalendarName: null,
        };
      }

      try {
        const response = await calendarClient.calendars.get({
          calendarId,
        });

        return {
          apartmentId: apartment.id,
          apartmentName: apartment.name,
          calendarId,
          status: "ok" as const,
          message: "Polaczenie z kalendarzem dziala poprawnie.",
          resolvedCalendarName: response.data.summary ?? null,
        };
      } catch (error) {
        if (error instanceof GaxiosError) {
          if (error.response?.status === 404) {
            return {
              apartmentId: apartment.id,
              apartmentName: apartment.name,
              calendarId,
              status: "calendar_not_found" as const,
              message: "Google nie znalazl takiego kalendarza. Sprawdz Calendar ID.",
              resolvedCalendarName: null,
            };
          }

          if (error.response?.status === 403) {
            return {
              apartmentId: apartment.id,
              apartmentName: apartment.name,
              calendarId,
              status: "access_denied" as const,
              message: "Konto serwisowe nie ma jeszcze dostepu do tego kalendarza.",
              resolvedCalendarName: null,
            };
          }
        }

        return {
          apartmentId: apartment.id,
          apartmentName: apartment.name,
          calendarId,
          status: "error" as const,
          message: "Nie udalo sie sprawdzic tego kalendarza. Sprobuj ponownie pozniej.",
          resolvedCalendarName: null,
        };
      }
    }),
  );

  return {
    serviceAccountReady,
    serviceAccountEmail,
    fallbackCalendarId,
    apartments,
  };
}
