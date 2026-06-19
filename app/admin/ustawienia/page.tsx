import Link from "next/link";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView } from "@/lib/calendar/month-view";
import { getAdminDashboardData } from "@/services/admin/get-admin-dashboard-data";
import { getGoogleCalendarIntegrationStatus } from "@/services/calendar/get-google-calendar-integration-status";

type AdminSettingsPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const monthCalendar = buildMonthView(params?.month);
  const adminMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;
  const dashboard = await getAdminDashboardData({
    monthStart: monthCalendar.monthStart,
    monthEnd: monthCalendar.monthEnd,
  });

  const googleCalendarConfigReady = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );
  const resendApiKeyReady = Boolean(process.env.RESEND_API_KEY?.trim());
  const resendFromEmailReady = Boolean(process.env.RESEND_FROM_EMAIL?.trim());
  const resendReady = resendApiKeyReady && resendFromEmailReady;
  const stripeSecretKeyReady = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripeWebhookSecretReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const stripeReady = stripeSecretKeyReady && stripeWebhookSecretReady;
  const appBaseUrl = process.env.APP_BASE_URL?.trim() || null;

  const googleCalendarStatus =
    dashboard.state === "ready"
      ? await getGoogleCalendarIntegrationStatus({
          apartments: dashboard.apartments.map((apartment) => ({
            id: apartment.id,
            name: apartment.name,
            googleCalendarId: apartment.googleCalendarId,
          })),
        })
      : null;

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
          <h1>Ustawienia i gotowosc systemu</h1>
          <p className="lead">
            Tutaj sprawdzasz, czy integracje i kluczowe ustawienia aplikacji sa gotowe
            do normalnej pracy.
          </p>
        </div>
        <div className="admin-hero-note">
          <p>
            To jest ekran kontrolny. Ma pomagac szybko ocenic, co juz dziala,
            a czego jeszcze brakuje przed pelnym uruchomieniem.
          </p>
        </div>
      </section>

      <nav className="admin-card admin-section-menu" aria-label="Menu panelu administratora">
        <Link className="admin-section-link" href="/admin">
          Start
        </Link>
        <Link className="admin-section-link" href={`/admin/rezerwacje?${adminMonthQuery}`}>
          Rezerwacje
        </Link>
        <Link className="admin-section-link" href={`/admin?${adminMonthQuery}#sekcja-integracje`}>
          Integracje
        </Link>
        <Link className="admin-section-link" href={`/admin/wiadomosci?${adminMonthQuery}`}>
          Wiadomosci
        </Link>
        <Link className="admin-section-link" href={`/admin/platnosci?${adminMonthQuery}`}>
          Platnosci
        </Link>
        <Link className="admin-section-link" href={`/admin/apartamenty?${adminMonthQuery}`}>
          Apartamenty
        </Link>
        <Link
          className="admin-section-link admin-section-link--active"
          href={`/admin/ustawienia?${adminMonthQuery}`}
        >
          Ustawienia
        </Link>
      </nav>

      <section className="admin-metrics">
        <article className="admin-card metric-card">
          <p className="metric-label">Google Calendar</p>
          <p className="metric-value">{googleCalendarConfigReady ? "OK" : "Brak"}</p>
          <p className="metric-hint">
            Sprawdza, czy konto serwisowe Google jest wpisane w Vercel.
          </p>
        </article>
        <article className="admin-card metric-card">
          <p className="metric-label">Wysylka maili</p>
          <p className="metric-value">{resendReady ? "OK" : "Brak"}</p>
          <p className="metric-hint">
            Sprawdza klucz Resend i adres nadawcy dla automatycznych wiadomosci.
          </p>
        </article>
        <article className="admin-card metric-card">
          <p className="metric-label">Platnosci Stripe</p>
          <p className="metric-value">{stripeReady ? "OK" : "Brak"}</p>
          <p className="metric-hint">
            Sprawdza klucz Stripe i webhook, czyli potwierdzenia platnosci.
          </p>
        </article>
      </section>

      <section className="admin-layout">
        <article className="admin-card admin-panel-card admin-page-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Google Calendar</p>
              <h2>Status integracji</h2>
            </div>
          </div>

          {googleCalendarStatus === null ? (
            <p>Stan integracji pojawi sie po poprawnym odczycie danych z bazy.</p>
          ) : (
            <div className="admin-stack">
              <article className="admin-row-card">
                <p className="inline-meta">
                  Konto serwisowe:{" "}
                  {googleCalendarStatus.serviceAccountReady
                    ? "gotowe"
                    : "brakuje danych w Vercel"}
                </p>
                <p className="inline-meta">
                  Adres konta serwisowego:{" "}
                  {googleCalendarStatus.serviceAccountEmail ?? "jeszcze nie wpisany"}
                </p>
                <p className="inline-meta">
                  Fallback Calendar ID:{" "}
                  {googleCalendarStatus.fallbackCalendarId ?? "brak"}
                </p>
              </article>

              {googleCalendarStatus.apartments.length === 0 ? (
                <p>Dodaj apartament, aby sprawdzic integracje kalendarza.</p>
              ) : (
                googleCalendarStatus.apartments.map((calendarStatus) => (
                  <article className="admin-row-card" key={`google-status-${calendarStatus.apartmentId}`}>
                    <div className="admin-row-top">
                      <div>
                        <h3>{calendarStatus.apartmentName}</h3>
                        <p>{calendarStatus.calendarId ?? "Brak Calendar ID"}</p>
                      </div>
                      <span
                        className={
                          calendarStatus.status === "ok"
                            ? "status-badge status-badge--success"
                            : calendarStatus.status === "missing_calendar_id"
                              ? "status-badge status-badge--warning"
                              : "status-badge status-badge--danger"
                        }
                      >
                        {calendarStatus.status === "ok"
                          ? "Polaczony"
                          : calendarStatus.status === "missing_calendar_id"
                            ? "Brak ID"
                            : calendarStatus.status === "missing_service_account"
                              ? "Brak konta"
                              : calendarStatus.status === "calendar_not_found"
                                ? "Nie znaleziono"
                                : calendarStatus.status === "access_denied"
                                  ? "Brak dostepu"
                                  : "Blad"}
                      </span>
                    </div>
                    <p className="inline-meta">{calendarStatus.message}</p>
                    {calendarStatus.resolvedCalendarName ? (
                      <p className="inline-meta">
                        Google widzi ten kalendarz jako: {calendarStatus.resolvedCalendarName}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          )}
        </article>

        <div className="admin-side-column">
          <article className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Ustawienia systemu</p>
                <h2>Gotowosc operacyjna</h2>
              </div>
            </div>

            <div className="admin-stack">
              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Resend</h3>
                    <p>Wysylka maili automatycznych do klienta.</p>
                  </div>
                  <span
                    className={
                      resendReady
                        ? "status-badge status-badge--success"
                        : "status-badge status-badge--danger"
                    }
                  >
                    {resendReady ? "Gotowe" : "Braki"}
                  </span>
                </div>
                <p className="inline-meta">Klucz API: {resendApiKeyReady ? "ustawiony" : "brakuje"}</p>
                <p className="inline-meta">
                  Adres nadawcy: {resendFromEmailReady ? "ustawiony" : "brakuje"}
                </p>
              </article>

              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Stripe</h3>
                    <p>Platnosci online i potwierdzenia przez webhook.</p>
                  </div>
                  <span
                    className={
                      stripeReady
                        ? "status-badge status-badge--success"
                        : "status-badge status-badge--danger"
                    }
                  >
                    {stripeReady ? "Gotowe" : "Braki"}
                  </span>
                </div>
                <p className="inline-meta">
                  Klucz Stripe: {stripeSecretKeyReady ? "ustawiony" : "brakuje"}
                </p>
                <p className="inline-meta">
                  Webhook Stripe: {stripeWebhookSecretReady ? "ustawiony" : "brakuje"}
                </p>
              </article>

              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Adres aplikacji</h3>
                    <p>Adres potrzebny do linkow platnosci i przekierowan.</p>
                  </div>
                  <span
                    className={
                      appBaseUrl
                        ? "status-badge status-badge--success"
                        : "status-badge status-badge--danger"
                    }
                  >
                    {appBaseUrl ? "Gotowe" : "Brak"}
                  </span>
                </div>
                <p className="inline-meta">APP_BASE_URL: {appBaseUrl ?? "nie ustawiono"}</p>
              </article>
            </div>
          </article>

          <article className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Checklista</p>
                <h2>Co jeszcze warto dopiac</h2>
              </div>
            </div>

            <ul className="admin-checklist">
              <li>Uzupelnic konto serwisowe Google w Vercel, aby kalendarz dzialal automatycznie.</li>
              <li>Sprawdzic, czy kazdy apartament ma wpisany poprawny Google Calendar ID.</li>
              <li>Ustawic Resend, aby maile o rezerwacji i anulowaniu wychodzily bez bledu.</li>
              <li>Potwierdzic Stripe na produkcji testowa platnoscia.</li>
              <li>Sprawdzic, czy APP_BASE_URL wskazuje na glowny adres aplikacji online.</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
