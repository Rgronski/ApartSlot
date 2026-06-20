import { GaxiosError } from "gaxios";

import { getGoogleCalendarClient } from "@/integrations/google-calendar/client";
import { DomainError } from "@/lib/errors/domain-error";

type RunGoogleCalendarWriteTestInput = {
  calendarId: string;
  apartmentName: string;
};

export async function runGoogleCalendarWriteTest(
  input: RunGoogleCalendarWriteTestInput,
) {
  const calendarId = input.calendarId.trim();

  if (!calendarId) {
    throw new DomainError(
      "MISSING_GOOGLE_CALENDAR_ID",
      "Brakuje Google Calendar ID dla wybranego apartamentu.",
    );
  }

  const calendar = getGoogleCalendarClient();
  const startDate = new Date(Date.now() + 60_000);
  const endDate = new Date(startDate.getTime() + 10 * 60_000);

  try {
    const createdEvent = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `[TEST] ApartSlot | ${input.apartmentName}`,
        description:
          "To jest techniczny test zapisu z panelu administracyjnego ApartSlot. Wydarzenie zostanie od razu usuniete.",
        start: {
          dateTime: startDate.toISOString(),
        },
        end: {
          dateTime: endDate.toISOString(),
        },
      },
    });

    const eventId = createdEvent.data.id;

    if (!eventId) {
      throw new DomainError(
        "GOOGLE_CALENDAR_TEST_FAILED",
        "Google Calendar nie zwrocil identyfikatora testowego wydarzenia.",
      );
    }

    await calendar.events.delete({
      calendarId,
      eventId,
    });

    return {
      status: "success" as const,
      calendarId,
      eventId,
    };
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }

    if (error instanceof GaxiosError) {
      if (error.response?.status === 403) {
        throw new DomainError(
          "GOOGLE_CALENDAR_ACCESS_DENIED",
          "Google odrzucil zapis testowy. Najczesciej oznacza to brak uprawnien kalendarza dla konta serwisowego.",
        );
      }

      if (error.response?.status === 404) {
        throw new DomainError(
          "GOOGLE_CALENDAR_NOT_FOUND",
          "Google nie znalazl wskazanego kalendarza. Sprawdz Google Calendar ID w apartamencie.",
        );
      }
    }

    throw new DomainError(
      "GOOGLE_CALENDAR_TEST_FAILED",
      "Nie udalo sie wykonac testowego zapisu do Google Calendar.",
    );
  }
}
