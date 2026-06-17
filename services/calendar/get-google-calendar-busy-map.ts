import { DomainError } from "@/lib/errors/domain-error";
import { getGoogleCalendarClient } from "@/integrations/google-calendar/client";

type GoogleCalendarBusyCalendar = {
  apartmentId: string;
  calendarId: string | null;
};

type GoogleCalendarBusyDate = {
  date: string;
  source: "google_calendar";
  label: string;
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeCalendarId(value: string | null) {
  return value?.trim() || null;
}

function buildBusyDates(
  startRaw: string,
  endRaw: string,
): GoogleCalendarBusyDate[] {
  const start = new Date(startRaw);
  const end = new Date(endRaw);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return [];
  }

  const dates: GoogleCalendarBusyDate[] = [];

  for (let cursor = new Date(start); cursor < end; cursor = addDays(cursor, 1)) {
    dates.push({
      date: formatDate(cursor),
      source: "google_calendar",
      label: "Google Calendar",
    });
  }

  return dates;
}

export async function getGoogleCalendarBusyMap(input: {
  calendars: GoogleCalendarBusyCalendar[];
  dateFrom: Date;
  dateTo: Date;
}) {
  const activeCalendars = input.calendars
    .map((calendar) => ({
      apartmentId: calendar.apartmentId,
      calendarId: normalizeCalendarId(calendar.calendarId),
    }))
    .filter((calendar): calendar is { apartmentId: string; calendarId: string } =>
      Boolean(calendar.calendarId),
    );

  const result = new Map<string, GoogleCalendarBusyDate[]>();

  if (activeCalendars.length === 0) {
    return result;
  }

  let calendarClient: ReturnType<typeof getGoogleCalendarClient>;

  try {
    calendarClient = getGoogleCalendarClient();
  } catch (error) {
    if (
      error instanceof DomainError &&
      error.code === "MISSING_GOOGLE_CALENDAR_CONFIG"
    ) {
      return result;
    }

    throw error;
  }

  const apartmentsByCalendarId = new Map<string, string[]>();

  for (const calendar of activeCalendars) {
    const current = apartmentsByCalendarId.get(calendar.calendarId) ?? [];
    current.push(calendar.apartmentId);
    apartmentsByCalendarId.set(calendar.calendarId, current);
  }

  const response = await calendarClient.freebusy.query({
    requestBody: {
      timeMin: input.dateFrom.toISOString(),
      timeMax: input.dateTo.toISOString(),
      items: Array.from(apartmentsByCalendarId.keys()).map((calendarId) => ({
        id: calendarId,
      })),
    },
  });

  const calendars = response.data.calendars ?? {};

  for (const [calendarId, calendarData] of Object.entries(calendars)) {
    const apartmentIds = apartmentsByCalendarId.get(calendarId) ?? [];
    const busyEntries = calendarData.busy ?? [];
    const busyDates = busyEntries.flatMap((entry) =>
      buildBusyDates(entry.start ?? "", entry.end ?? ""),
    );

    for (const apartmentId of apartmentIds) {
      const current = result.get(apartmentId) ?? [];
      const occupiedDates = new Set(current.map((item) => item.date));

      for (const busyDate of busyDates) {
        if (!occupiedDates.has(busyDate.date)) {
          current.push(busyDate);
          occupiedDates.add(busyDate.date);
        }
      }

      current.sort((left, right) => left.date.localeCompare(right.date));
      result.set(apartmentId, current);
    }
  }

  return result;
}
