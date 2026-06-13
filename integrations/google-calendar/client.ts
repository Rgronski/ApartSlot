import { google } from "googleapis";

import { DomainError } from "@/lib/errors/domain-error";

let cachedCalendarClient: ReturnType<typeof google.calendar> | null = null;

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

export function getGoogleCalendarClient() {
  if (cachedCalendarClient) {
    return cachedCalendarClient;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();

  if (!clientEmail || !privateKey) {
    throw new DomainError(
      "MISSING_GOOGLE_CALENDAR_CONFIG",
      "Brakuje konfiguracji konta serwisowego Google Calendar.",
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: normalizePrivateKey(privateKey),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  cachedCalendarClient = google.calendar({
    version: "v3",
    auth,
  });

  return cachedCalendarClient;
}
