import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ReservationStatus } from "@prisma/client";
import Link from "next/link";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView } from "@/lib/calendar/month-view";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";
import { getAdminDashboardData } from "@/services/admin/get-admin-dashboard-data";
import {
  getGoogleCalendarIntegrationStatus,
  runGoogleCalendarWriteTest,
  syncConfirmedReservationsBatch,
} from "@/services/calendar";

type AdminIntegrationsPageProps = {
  searchParams?: Promise<{
    month?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function AdminIntegrationsPage({
  searchParams,
}: AdminIntegrationsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const monthCalendar = buildMonthView(params?.month);
  const adminMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;
  const status = params?.status;
  const message = params?.message;
  const dashboard = await getAdminDashboardData({
    monthStart: monthCalendar.monthStart,
    monthEnd: monthCalendar.monthEnd,
  });

  const googleCalendarConfigReady = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );

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

  const connectedApartmentsCount =
    googleCalendarStatus?.apartments.filter((item) => item.status === "ok").length ?? 0;
  const missingApartmentsCount =
    googleCalendarStatus?.apartments.filter((item) => item.status !== "ok").length ?? 0;
  const confirmedReservationsWithoutCalendarEvent =
    dashboard.state === "ready"
      ? await prisma.reservation.count({
          where: {
            status: ReservationStatus.CONFIRMED,
            calendarEventId: null,
          },
        })
      : 0;

  async function runCalendarWriteTestAction(formData: FormData) {
    "use server";

    try {
      const calendarId = String(formData.get("calendarId") ?? "").trim();
      const apartmentName = String(formData.get("apartmentName") ?? "").trim();

      await runGoogleCalendarWriteTest({
        calendarId,
        apartmentName,
      });
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie wykonac testu zapisu do Google Calendar.";

      redirect(
        `/admin/integracje?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`,
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/integracje");
    redirect(`/admin/integracje?${adminMonthQuery}&status=calendar_test_success`);
  }

  async function syncConfirmedReservationsAction() {
    "use server";

    let messageText =
      "Synchronizacja potwierdzonych rezerwacji zostala uruchomiona poprawnie.";

    try {
      const result = await syncConfirmedReservationsBatch();
      messageText = `Sprawdzono ${result.checked} potwierdzonych rezerwacji. Zsynchronizowano: ${result.synced}, pominieto: ${result.skipped}, bledy: ${result.failed}.`;

      revalidatePath("/admin");
      revalidatePath("/admin/integracje");
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie uruchomic synchronizacji potwierdzonych rezerwacji.";

      redirect(
        `/admin/integracje?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`,
      );
    }

    redirect(
      `/admin/integracje?${adminMonthQuery}&status=calendar_sync_success&message=${encodeURIComponent(messageText)}`,
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
          <h1>Integracje systemu</h1>
          <p className="lead">
            Tutaj sprawdzasz, czy polaczenia z Google Calendar sa gotowe i ktore
            apartamenty wymagaja jeszcze dopiecia.
          </p>
        </div>
        <div className="admin-hero-note">
          <p>
            To jest ekran tylko do integracji. Dzieki temu latwiej od razu zobaczyc,
            czy kalendarze beda poprawnie zapisywac rezerwacje.
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
        <Link
          className="admin-section-link admin-section-link--active"
          href={`/admin/integracje?${adminMonthQuery}`}
        >
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
        <Link className="admin-section-link" href={`/admin/zdjecia?${adminMonthQuery}`}>
          Zdjecia
        </Link>
        <Link className="admin-section-link" href={`/admin/ustawienia?${adminMonthQuery}`}>
          Ustawienia
        </Link>
      </nav>

      <section className="admin-metrics">
        <article className="admin-card metric-card">
          <p className="metric-label">Konto serwisowe Google</p>
          <p className="metric-value">{googleCalendarConfigReady ? "OK" : "Brak"}</p>
          <p className="metric-hint">
            Bez tego system nie zapisze automatycznie rezerwacji do Google Calendar.
          </p>
        </article>
        <article className="admin-card metric-card">
          <p className="metric-label">Polaczone apartamenty</p>
          <p className="metric-value">{connectedApartmentsCount}</p>
          <p className="metric-hint">
            Tyle apartamentow ma poprawnie rozpoznane polaczenie z kalendarzem.
          </p>
        </article>
        <article className="admin-card metric-card">
          <p className="metric-label">Wymagaja dopiecia</p>
          <p className="metric-value">{missingApartmentsCount}</p>
          <p className="metric-hint">
            Tyle apartamentow nadal ma brak ID, brak dostepu albo inny problem.
          </p>
        </article>
        <article className="admin-card metric-card">
          <p className="metric-label">Potwierdzone bez wpisu</p>
          <p className="metric-value">{confirmedReservationsWithoutCalendarEvent}</p>
          <p className="metric-hint">
            Tyle potwierdzonych rezerwacji nie ma jeszcze zapisanego identyfikatora wydarzenia Google.
          </p>
        </article>
      </section>

      {status === "calendar_test_success" ? (
        <div className="inline-notice inline-notice--success">
          <p>Test zapisu do Google Calendar zakonczyl sie powodzeniem.</p>
        </div>
      ) : null}

      {status === "calendar_sync_success" ? (
        <div className="inline-notice inline-notice--success">
          <p>{message ?? "Synchronizacja potwierdzonych rezerwacji zostala uruchomiona poprawnie."}</p>
        </div>
      ) : null}

      {status === "error" && message ? (
        <div className="inline-notice inline-notice--danger">
          <p>{message}</p>
        </div>
      ) : null}

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
                <div className="admin-row-top">
                  <div>
                    <h3>Konto serwisowe Google</h3>
                    <p>To konto techniczne wykonuje zapis i usuwanie wydarzen w kalendarzu.</p>
                  </div>
                  <form action={syncConfirmedReservationsAction}>
                    <button className="cta-button" type="submit">
                      Synchronizuj potwierdzone rezerwacje
                    </button>
                  </form>
                </div>
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
                    {calendarStatus.calendarId ? (
                      <form action={runCalendarWriteTestAction} className="admin-inline-form">
                        <input name="calendarId" type="hidden" value={calendarStatus.calendarId} />
                        <input
                          name="apartmentName"
                          type="hidden"
                          value={calendarStatus.apartmentName}
                        />
                        <button className="cta-button" type="submit">
                          Testuj zapis do Google
                        </button>
                      </form>
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
                <p className="eyebrow">Co sprawdzic</p>
                <h2>Checklista integracji</h2>
              </div>
            </div>

            <ul className="admin-checklist">
              <li>Sprawdzic, czy konto serwisowe Google jest wpisane w Vercel.</li>
              <li>Potwierdzic, ze kazdy apartament ma poprawny Google Calendar ID.</li>
              <li>Jesli Google pokazuje brak dostepu, nadac uprawnienia kalendarzowi dla konta serwisowego.</li>
              <li>Uruchomic test zapisu z tego ekranu i sprawdzic, czy nie ma bledu dostepu.</li>
              <li>Wykonac jedna testowa platna rezerwacje i sprawdzic, czy trafia do Google Calendar.</li>
            </ul>
          </article>

          <article className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Powiazane obszary</p>
                <h2>Szybkie przejscia</h2>
              </div>
            </div>

            <div className="admin-stack">
              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Apartamenty</h3>
                    <p>Tutaj wpisujesz lub poprawiasz Google Calendar ID dla obiektu.</p>
                  </div>
                  <Link className="cta-button" href={`/admin/apartamenty?${adminMonthQuery}`}>
                    Otworz
                  </Link>
                </div>
              </article>

              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Ustawienia</h3>
                    <p>Tutaj sprawdzisz Resend, Mollie i glowny adres aplikacji.</p>
                  </div>
                  <Link className="cta-button" href={`/admin/ustawienia?${adminMonthQuery}`}>
                    Otworz
                  </Link>
                </div>
              </article>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
