import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmailLogStatus } from "@prisma/client";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView } from "@/lib/calendar/month-view";
import { DomainError } from "@/lib/errors/domain-error";
import { getAdminDashboardData } from "@/services/admin/get-admin-dashboard-data";
import { retryEmailLog } from "@/services/email/retry-email-log";

const emailTypeLabels: Record<string, string> = {
  RESERVATION_CREATED: "Nowa rezerwacja",
  RESERVATION_CONFIRMED: "Potwierdzenie platnosci",
  RESERVATION_CANCELLED: "Anulowanie rezerwacji",
};

const emailStatusLabels: Record<EmailLogStatus, string> = {
  PENDING: "W trakcie",
  SENT: "Wyslana",
  FAILED: "Blad",
};

function getEmailBadgeClass(status: EmailLogStatus) {
  if (status === EmailLogStatus.SENT) {
    return "status-badge status-badge--success";
  }

  if (status === EmailLogStatus.FAILED) {
    return "status-badge status-badge--danger";
  }

  return "status-badge status-badge--warning";
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type AdminMessagesPageProps = {
  searchParams?: Promise<{
    month?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function AdminMessagesPage({
  searchParams,
}: AdminMessagesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const monthCalendar = buildMonthView(params?.month);
  const dashboard = await getAdminDashboardData({
    monthStart: monthCalendar.monthStart,
    monthEnd: monthCalendar.monthEnd,
    recentEmailLogsTake: 20,
  });
  const status = params?.status;
  const message = params?.message;
  const adminMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;
  const resendApiKeyReady = Boolean(process.env.RESEND_API_KEY?.trim());
  const resendFromEmailReady = Boolean(process.env.RESEND_FROM_EMAIL?.trim());
  const resendReady = resendApiKeyReady && resendFromEmailReady;

  async function retryEmailLogAction(formData: FormData) {
    "use server";

    try {
      const result = await retryEmailLog(readString(formData, "emailLogId"));

      if (result.status !== "sent") {
        const nextMessage =
          result.status === "skipped"
            ? `Mail nie zostal ponowiony: ${result.reason}`
            : `Nie udalo sie ponowic wysylki maila: ${result.reason}`;

        redirect(`/admin/wiadomosci?${adminMonthQuery}&status=error&message=${encodeURIComponent(nextMessage)}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie ponowic wysylki maila. Sprobuj ponownie.";

      redirect(`/admin/wiadomosci?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    revalidatePath("/admin/wiadomosci");
    redirect(`/admin/wiadomosci?${adminMonthQuery}&status=email_retried`);
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
          <h1>Wiadomosci automatyczne</h1>
          <p className="lead">
            Tutaj kontrolujesz automatyczne maile: co system wysyla, co sie nie
            udalo i co mozna ponowic jednym kliknieciem.
          </p>
        </div>
        <div className="admin-hero-note">
          <p>
            To jest drugi wydzielony ekran panelu. Teraz obsluga wiadomosci ma
            juz swoje wlasne miejsce.
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
        <Link
          className="admin-section-link admin-section-link--active"
          href={`/admin/wiadomosci?${adminMonthQuery}`}
        >
          Wiadomosci
        </Link>
        <Link className="admin-section-link" href={`/admin?${adminMonthQuery}#sekcja-platnosci`}>
          Platnosci
        </Link>
        <Link className="admin-section-link" href={`/admin?${adminMonthQuery}#sekcja-apartamenty`}>
          Apartamenty
        </Link>
        <Link className="admin-section-link" href={`/admin?${adminMonthQuery}#sekcja-ustawienia`}>
          Ustawienia
        </Link>
      </nav>

      {status === "email_retried" ? (
        <div className="inline-notice inline-notice--success">
          <p>Mail zostal ponownie wyslany poprawnie.</p>
        </div>
      ) : null}

      {status === "error" && message ? (
        <div className="inline-notice inline-notice--danger">
          <p>{message}</p>
        </div>
      ) : null}

      {dashboard.state !== "ready" ? (
        <section className="admin-card admin-state-card">
          <h2>Wiadomosci nie sa jeszcze gotowe do odczytu</h2>
          <p>{dashboard.message}</p>
        </section>
      ) : (
        <>
          <section className="admin-metrics">
            <article className="admin-card metric-card">
              <p className="metric-label">Historia maili</p>
              <p className="metric-value">{dashboard.recentEmailLogs.length}</p>
              <p className="metric-hint">Tyle ostatnich wpisow pokazujemy teraz na osobnym ekranie.</p>
            </article>
            <article className="admin-card metric-card">
              <p className="metric-label">Status Resend</p>
              <p className="metric-value">{resendReady ? "OK" : "Brak"}</p>
              <p className="metric-hint">
                {resendReady
                  ? "Wysylka maili ma komplet podstawowych ustawien."
                  : "Brakuje klucza API lub adresu nadawcy."}
              </p>
            </article>
            <article className="admin-card metric-card">
              <p className="metric-label">Bledy do poprawy</p>
              <p className="metric-value">
                {dashboard.recentEmailLogs.filter((emailLog) => emailLog.status === EmailLogStatus.FAILED).length}
              </p>
              <p className="metric-hint">Te wpisy mozna ponowic po poprawieniu ustawien.</p>
            </article>
          </section>

          <section className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Wiadomosci</p>
                <h2>Automatyczne typy wiadomosci</h2>
              </div>
            </div>

            <div className="admin-stack">
              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Po utworzeniu rezerwacji</h3>
                    <p>Klient dostaje automatyczny e-mail z podsumowaniem i linkiem do platnosci.</p>
                  </div>
                  <span className="status-badge status-badge--success">Aktywne</span>
                </div>
                <p className="inline-meta">
                  Wiadomosc potwierdza zapis rezerwacji, podaje kwote do zaplaty i prowadzi klienta do kolejnego kroku.
                </p>
              </article>

              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Po potwierdzeniu platnosci</h3>
                    <p>System wysyla automatyczny e-mail po zapisaniu platnosci.</p>
                  </div>
                  <span className="status-badge status-badge--success">Aktywne</span>
                </div>
                <p className="inline-meta">
                  Wiadomosc rozroznia teraz zaliczke i pelna platnosc za pobyt.
                </p>
              </article>

              <article className="admin-row-card">
                <div className="admin-row-top">
                  <div>
                    <h3>Po anulowaniu rezerwacji</h3>
                    <p>Operator wpisuje powod, a klient dostaje automatyczne potwierdzenie.</p>
                  </div>
                  <span className="status-badge status-badge--success">Aktywne</span>
                </div>
                <p className="inline-meta">
                  Powod anulowania trafia do maila dla klienta i do notatki administracyjnej w rezerwacji.
                </p>
              </article>
            </div>
          </section>

          <section className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Wiadomosci</p>
                <h2>Historia wysylek</h2>
              </div>
            </div>

            {dashboard.recentEmailLogs.length === 0 ? (
              <p>Nie ma jeszcze zapisanej historii maili.</p>
            ) : (
              <div className="admin-stack">
                {dashboard.recentEmailLogs.map((emailLog) => (
                  <article className="admin-row-card" key={emailLog.id}>
                    <div className="admin-row-top">
                      <div>
                        <h3>{emailTypeLabels[emailLog.type] ?? emailLog.type}</h3>
                        <p>{emailLog.recipientEmail}</p>
                      </div>
                      <span className={getEmailBadgeClass(emailLog.status)}>
                        {emailStatusLabels[emailLog.status] ?? emailLog.status}
                      </span>
                    </div>
                    <p className="inline-meta">
                      Rezerwacja: {emailLog.reservationNumber ?? "brak numeru"}
                    </p>
                    <p className="inline-meta">
                      Klient: {emailLog.guestName ?? "brak danych klienta"}
                    </p>
                    <p className="inline-meta">Temat: {emailLog.subject}</p>
                    <p className="inline-meta">Dodano do kolejki: {emailLog.createdAt}</p>
                    <p className="inline-meta">
                      Wyslano: {emailLog.sentAt ?? "nie potwierdzono jeszcze wysylki"}
                    </p>
                    {emailLog.errorMessage ? (
                      <p className="inline-meta">
                        Ostatni blad: {emailLog.errorMessage}
                      </p>
                    ) : null}
                    {emailLog.status === EmailLogStatus.FAILED ? (
                      <form action={retryEmailLogAction} className="admin-inline-form">
                        <input name="emailLogId" type="hidden" value={emailLog.id} />
                        <button className="cta-button" type="submit">
                          Ponow wysylke
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
