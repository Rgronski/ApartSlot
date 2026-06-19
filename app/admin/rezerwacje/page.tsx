import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView } from "@/lib/calendar/month-view";
import { DomainError } from "@/lib/errors/domain-error";
import { getAdminDashboardData, formatDashboardMoney } from "@/services/admin/get-admin-dashboard-data";
import { cancelReservation } from "@/services/admin/cancel-reservation";
import { sendReservationCancelledEmail } from "@/services/email/send-reservation-cancelled-email";

const statusLabels: Record<string, string> = {
  DRAFT: "Szkic",
  PENDING_PAYMENT: "Czeka na platnosc",
  CONFIRMED: "Potwierdzona",
  CANCELLED: "Anulowana",
  EXPIRED: "Wygasla",
  MANUAL_BLOCK: "Blokada reczna",
  COMPLETED: "Zakonczona",
  CREATED: "Utworzona",
  LINK_SENT: "Link wyslany",
  PENDING: "W trakcie",
  PAID: "Oplacona",
  FAILED: "Nieudana",
  REFUNDED: "Zwrocona",
};

function getBadgeClass(status: string) {
  if (status === "CONFIRMED" || status === "PAID" || status === "COMPLETED") {
    return "status-badge status-badge--success";
  }

  if (status === "CANCELLED" || status === "FAILED" || status === "EXPIRED") {
    return "status-badge status-badge--danger";
  }

  return "status-badge status-badge--warning";
}

function canReservationBeCancelled(status: string) {
  return status === "DRAFT" || status === "PENDING_PAYMENT" || status === "CONFIRMED";
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type AdminReservationsPageProps = {
  searchParams?: Promise<{
    month?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function AdminReservationsPage({
  searchParams,
}: AdminReservationsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const monthCalendar = buildMonthView(params?.month);
  const dashboard = await getAdminDashboardData({
    monthStart: monthCalendar.monthStart,
    monthEnd: monthCalendar.monthEnd,
    recentReservationsTake: 20,
  });
  const status = params?.status;
  const message = params?.message;
  const adminMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;

  async function cancelReservationAction(formData: FormData) {
    "use server";

    let nextStatus = "reservation_cancelled";
    let nextMessage = "";

    try {
      const result = await cancelReservation(
        readString(formData, "reservationId"),
        readString(formData, "cancellationReason"),
        readString(formData, "operatorNote") || null,
      );

      const emailResult = await sendReservationCancelledEmail(
        result.reservationId,
        result.cancellationReason,
      );

      if (emailResult.status !== "sent") {
        nextStatus = "warning";
        nextMessage =
          emailResult.status === "skipped"
            ? `Rezerwacja zostala anulowana, ale mail nie zostal wyslany: ${emailResult.reason}`
            : `Rezerwacja zostala anulowana, ale mail zakonczyl sie bledem: ${emailResult.reason}`;
      }
    } catch (error) {
      nextStatus = "error";
      nextMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie anulowac rezerwacji. Sprobuj ponownie.";
    }

    revalidatePath("/admin");
    revalidatePath("/admin/rezerwacje");
    revalidatePath("/");
    redirect(
      `/admin/rezerwacje?${adminMonthQuery}&status=${nextStatus}${nextMessage ? `&message=${encodeURIComponent(nextMessage)}` : ""}`,
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
          <h1>Obsluga rezerwacji</h1>
          <p className="lead">
            Tutaj pracujemy juz tylko na rezerwacjach: sprawdzamy statusy,
            platnosci i ewentualne anulowania.
          </p>
        </div>
        <div className="admin-hero-note">
          <p>
            To jest pierwszy wydzielony ekran panelu. W nastepnych krokach
            podobnie rozdzielimy pozostale obszary.
          </p>
        </div>
      </section>

      <nav className="admin-card admin-section-menu" aria-label="Menu panelu administratora">
        <Link className="admin-section-link" href="/admin">
          Start
        </Link>
        <Link
          className="admin-section-link admin-section-link--active"
          href={`/admin/rezerwacje?${adminMonthQuery}`}
        >
          Rezerwacje
        </Link>
        <Link className="admin-section-link" href={`/admin?${adminMonthQuery}#sekcja-integracje`}>
          Integracje
        </Link>
        <Link className="admin-section-link" href={`/admin?${adminMonthQuery}#sekcja-wiadomosci`}>
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

      {status === "reservation_cancelled" ? (
        <div className="inline-notice inline-notice--success">
          <p>Rezerwacja zostala anulowana poprawnie.</p>
        </div>
      ) : null}

      {status === "warning" ? (
        <div className="inline-notice">
          <p>{message ?? "Operacja zakonczyla sie z ostrzezeniem."}</p>
        </div>
      ) : null}

      {status === "error" && message ? (
        <div className="inline-notice inline-notice--danger">
          <p>{message}</p>
        </div>
      ) : null}

      {dashboard.state !== "ready" ? (
        <section className="admin-card admin-state-card">
          <h2>Rezerwacje nie sa jeszcze gotowe do odczytu</h2>
          <p>{dashboard.message}</p>
        </section>
      ) : (
        <>
          <section className="admin-metrics">
            {dashboard.metrics.slice(1, 4).map((metric) => (
              <article className="admin-card metric-card" key={metric.label}>
                <p className="metric-label">{metric.label}</p>
                <p className="metric-value">{metric.value}</p>
                <p className="metric-hint">{metric.hint}</p>
              </article>
            ))}
          </section>

          <section className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Rezerwacje</p>
                <h2>Ostatnie i aktywne zamowienia</h2>
              </div>
            </div>

            {dashboard.recentReservations.length === 0 ? (
              <p>Brak rezerwacji w bazie. Gdy pojawia sie zamowienia, zobaczysz je tutaj.</p>
            ) : (
              <div className="admin-stack">
                {dashboard.recentReservations.map((reservation) => (
                  <article className="admin-row-card" key={reservation.id}>
                    <div className="admin-row-top">
                      <div>
                        <h3>{reservation.reservationNumber}</h3>
                        <p>
                          {reservation.apartmentName} | {reservation.guestName}
                        </p>
                      </div>
                      <div className="admin-badges">
                        <span className={getBadgeClass(reservation.status)}>
                          {statusLabels[reservation.status] ?? reservation.status}
                        </span>
                        <span className={getBadgeClass(reservation.paymentStatus)}>
                          {statusLabels[reservation.paymentStatus] ?? reservation.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <dl className="detail-list detail-list--compact">
                      <div>
                        <dt>Pobyt</dt>
                        <dd>
                          {reservation.checkInDate} - {reservation.checkOutDate}
                        </dd>
                      </div>
                      <div>
                        <dt>Kwota calosci</dt>
                        <dd>
                          {formatDashboardMoney(
                            reservation.totalAmount,
                            reservation.currency,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Do zaplaty teraz</dt>
                        <dd>
                          {formatDashboardMoney(
                            reservation.amountToPayNow,
                            reservation.currency,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Dodano</dt>
                        <dd>{reservation.createdAt}</dd>
                      </div>
                    </dl>

                    {canReservationBeCancelled(reservation.status) ? (
                      <details className="admin-details admin-details--danger">
                        <summary>Anuluj rezerwacje</summary>

                        <form action={cancelReservationAction} className="admin-form admin-form--nested">
                          <input name="reservationId" type="hidden" value={reservation.id} />

                          <div className="inline-notice inline-notice--danger">
                            <p>
                              Ta akcja ustawi rezerwacje jako anulowana, zatrzyma nieoplacone platnosci
                              i sprobuje usunac wpis z Google Calendar.
                            </p>
                          </div>

                          <label className="admin-field">
                            <span>Powod anulowania</span>
                            <textarea
                              name="cancellationReason"
                              rows={3}
                              required
                              placeholder="Np. prosba klienta, brak kontaktu, zmiana terminu, blad testowy"
                            />
                          </label>

                          <label className="admin-field">
                            <span>Notatka operatora</span>
                            <textarea
                              name="operatorNote"
                              rows={2}
                              placeholder="Opcjonalnie: dodatkowy komentarz wewnetrzny."
                            />
                          </label>

                          <div className="admin-form-actions">
                            <button className="cta-button cta-button--danger" type="submit">
                              Potwierdz anulowanie
                            </button>
                          </div>
                        </form>
                      </details>
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
