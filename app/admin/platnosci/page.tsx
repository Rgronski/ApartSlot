import Link from "next/link";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView } from "@/lib/calendar/month-view";
import { getAdminDashboardData, formatDashboardMoney } from "@/services/admin/get-admin-dashboard-data";

const statusLabels: Record<string, string> = {
  CREATED: "Utworzona",
  LINK_SENT: "Link wyslany",
  PENDING: "W trakcie",
  PAID: "Oplacona",
  FAILED: "Nieudana",
  CANCELLED: "Anulowana",
  EXPIRED: "Wygasla",
  REFUNDED: "Zwrocona",
};

function getBadgeClass(status: string) {
  if (status === "PAID") {
    return "status-badge status-badge--success";
  }

  if (status === "FAILED" || status === "CANCELLED" || status === "EXPIRED" || status === "REFUNDED") {
    return "status-badge status-badge--danger";
  }

  return "status-badge status-badge--warning";
}

type AdminPaymentsPageProps = {
  searchParams?: Promise<{
    month?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const monthCalendar = buildMonthView(params?.month);
  const dashboard = await getAdminDashboardData({
    monthStart: monthCalendar.monthStart,
    monthEnd: monthCalendar.monthEnd,
    attentionPaymentsTake: 20,
  });
  const adminMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
          <h1>Obsluga platnosci</h1>
          <p className="lead">
            Tutaj nadzorujesz platnosci online: aktywne linki, terminy waznosci
            i sprawy, ktore trzeba dopilnowac.
          </p>
        </div>
        <div className="admin-hero-note">
          <p>
            To jest trzeci wydzielony ekran panelu. Po rezerwacjach i
            wiadomosciach teraz platnosci maja juz swoje osobne miejsce.
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
        <Link className="admin-section-link" href={`/admin/integracje?${adminMonthQuery}`}>
          Integracje
        </Link>
        <Link className="admin-section-link" href={`/admin/wiadomosci?${adminMonthQuery}`}>
          Wiadomosci
        </Link>
        <Link
          className="admin-section-link admin-section-link--active"
          href={`/admin/platnosci?${adminMonthQuery}`}
        >
          Platnosci
        </Link>
        <Link className="admin-section-link" href={`/admin/apartamenty?${adminMonthQuery}`}>
          Apartamenty
        </Link>
        <Link className="admin-section-link" href={`/admin/ustawienia?${adminMonthQuery}`}>
          Ustawienia
        </Link>
      </nav>

      {dashboard.state !== "ready" ? (
        <section className="admin-card admin-state-card">
          <h2>Platnosci nie sa jeszcze gotowe do odczytu</h2>
          <p>{dashboard.message}</p>
        </section>
      ) : (
        <>
          <section className="admin-metrics">
            <article className="admin-card metric-card">
              <p className="metric-label">Platnosci do dopilnowania</p>
              <p className="metric-value">{dashboard.metrics[3]?.value ?? "0"}</p>
              <p className="metric-hint">
                Link wyslany lub platnosc nadal czeka na zamkniecie procesu.
              </p>
            </article>
            <article className="admin-card metric-card">
              <p className="metric-label">Rezerwacje oczekujace</p>
              <p className="metric-value">{dashboard.metrics[1]?.value ?? "0"}</p>
              <p className="metric-hint">
                Te zamowienia najczesciej beda jeszcze wymagaly sprawdzenia platnosci.
              </p>
            </article>
            <article className="admin-card metric-card">
              <p className="metric-label">Rezerwacje potwierdzone</p>
              <p className="metric-value">{dashboard.metrics[2]?.value ?? "0"}</p>
              <p className="metric-hint">
                To pobyty, dla ktorych sprzedaz jest juz zamknieta po stronie systemu.
              </p>
            </article>
          </section>

          <section className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Platnosci</p>
                <h2>Sprawy do dopilnowania</h2>
              </div>
            </div>

            {dashboard.attentionPayments.length === 0 ? (
              <p>Nie ma platnosci wymagajacych uwagi. To dobry znak.</p>
            ) : (
              <div className="admin-stack">
                {dashboard.attentionPayments.map((payment) => (
                  <article className="admin-row-card" key={payment.id}>
                    <div className="admin-row-top">
                      <div>
                        <h3>{payment.reservationNumber}</h3>
                        <p>{payment.guestName}</p>
                      </div>
                      <span className={getBadgeClass(payment.status)}>
                        {statusLabels[payment.status] ?? payment.status}
                      </span>
                    </div>
                    <p className="inline-meta">
                      Kwota: {formatDashboardMoney(payment.amount, payment.currency)}
                    </p>
                    <p className="inline-meta">
                      Waznosc linku: {payment.expiresAt ?? "brak daty"}
                    </p>
                    {payment.paymentUrl ? (
                      <p className="inline-link">
                        <Link href={payment.paymentUrl} target="_blank">
                          Otworz link platnosci
                        </Link>
                      </p>
                    ) : (
                      <p className="inline-meta">Link platnosci nie zostal jeszcze zapisany.</p>
                    )}
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
