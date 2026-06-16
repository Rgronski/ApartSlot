import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DomainError } from "@/lib/errors/domain-error";
import { createApartment } from "@/services/admin/create-apartment";
import {
  formatDashboardMoney,
  getAdminDashboardData,
} from "@/services/admin/get-admin-dashboard-data";

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

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readNumber(formData: FormData, key: string) {
  const rawValue = readString(formData, key).replace(",", ".");
  return Number(rawValue);
}

type AdminPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const dashboard = await getAdminDashboardData();
  const status = params?.status;
  const message = params?.message;

  async function createApartmentAction(formData: FormData) {
    "use server";

    try {
      await createApartment({
        name: readString(formData, "name"),
        slug: readString(formData, "slug"),
        city: readString(formData, "city"),
        address: readString(formData, "address"),
        description: readString(formData, "description"),
        maxGuests: readNumber(formData, "maxGuests"),
        basePricePerNight: readNumber(formData, "basePricePerNight"),
        cleaningFee: readNumber(formData, "cleaningFee"),
        depositAmount: readNumber(formData, "depositAmount"),
        minimumNights: readNumber(formData, "minimumNights"),
        defaultCheckInTime: readString(formData, "defaultCheckInTime"),
        defaultCheckOutTime: readString(formData, "defaultCheckOutTime"),
        googleCalendarId: readString(formData, "googleCalendarId"),
      });
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie zapisac apartamentu. Sprobuj ponownie.";

      redirect(`/admin?status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect("/admin?status=created");
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <h1>Centrum obslugi rezerwacji</h1>
          <p className="lead">
            Tutaj zbieramy najwazniejsze informacje: sprzedaz, statusy platnosci
            i gotowosc kalendarza Google.
          </p>
        </div>
        <div className="admin-hero-note">
          <p>
            To jest pierwszy etap panelu MVP. Na tym ekranie skupiamy sie na
            szybkim podgladzie sytuacji.
          </p>
        </div>
      </section>

      <section className="admin-card admin-form-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Apartamenty</p>
            <h2>Dodaj nowy apartament</h2>
          </div>
        </div>

        <p>
          Ten formularz sluzy do samodzielnego dodawania kolejnych obiektow do
          systemu. Po zapisie apartament pojawi sie od razu na liscie w panelu.
        </p>

        {status === "created" ? (
          <div className="inline-notice inline-notice--success">
            <p>Apartament zostal zapisany poprawnie.</p>
          </div>
        ) : null}

        {status === "error" && message ? (
          <div className="inline-notice inline-notice--danger">
            <p>{message}</p>
          </div>
        ) : null}

        <form action={createApartmentAction} className="admin-form">
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Nazwa apartamentu</span>
              <input name="name" type="text" required placeholder="Np. Apartament Centrum" />
            </label>

            <label className="admin-field">
              <span>Slug</span>
              <input
                name="slug"
                type="text"
                placeholder="Np. apartament-centrum"
              />
            </label>

            <label className="admin-field">
              <span>Miasto</span>
              <input name="city" type="text" placeholder="Np. Warszawa" />
            </label>

            <label className="admin-field">
              <span>Adres</span>
              <input name="address" type="text" placeholder="Adres lub opis lokalizacji" />
            </label>

            <label className="admin-field">
              <span>Maksymalna liczba gosci</span>
              <input name="maxGuests" type="number" min="1" step="1" required defaultValue="2" />
            </label>

            <label className="admin-field">
              <span>Cena za noc (PLN)</span>
              <input
                name="basePricePerNight"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue="350"
              />
            </label>

            <label className="admin-field">
              <span>Oplata za sprzatanie (PLN)</span>
              <input
                name="cleaningFee"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue="120"
              />
            </label>

            <label className="admin-field">
              <span>Kaucja (PLN)</span>
              <input
                name="depositAmount"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue="500"
              />
            </label>

            <label className="admin-field">
              <span>Minimalna liczba nocy</span>
              <input name="minimumNights" type="number" min="1" step="1" required defaultValue="1" />
            </label>

            <label className="admin-field">
              <span>Godzina check-in</span>
              <input name="defaultCheckInTime" type="text" placeholder="15:00" defaultValue="15:00" />
            </label>

            <label className="admin-field">
              <span>Godzina check-out</span>
              <input name="defaultCheckOutTime" type="text" placeholder="11:00" defaultValue="11:00" />
            </label>

            <label className="admin-field">
              <span>Google Calendar ID</span>
              <input name="googleCalendarId" type="text" placeholder="Opcjonalnie" />
            </label>
          </div>

          <label className="admin-field">
            <span>Opis</span>
            <textarea
              name="description"
              rows={4}
              placeholder="Krotki opis apartamentu, lokalizacji lub standardu."
            />
          </label>

          <div className="admin-form-actions">
            <button className="cta-button" type="submit">
              Zapisz apartament
            </button>
            <p className="admin-form-note">
              Jesli slug zostawisz pusty, system zbuduje go automatycznie z nazwy.
            </p>
          </div>
        </form>
      </section>

      {dashboard.state !== "ready" ? (
        <section className="admin-card admin-state-card">
          <h2>Panel nie jest jeszcze gotowy do odczytu danych</h2>
          <p>{dashboard.message}</p>
          <p>
            Gdy podlaczymy baze, ten ekran automatycznie zacznie pokazywac
            rezerwacje, platnosci i apartamenty.
          </p>
        </section>
      ) : (
        <>
          <section className="admin-metrics">
            {dashboard.metrics.map((metric) => (
              <article className="admin-card metric-card" key={metric.label}>
                <p className="metric-label">{metric.label}</p>
                <p className="metric-value">{metric.value}</p>
                <p className="metric-hint">{metric.hint}</p>
              </article>
            ))}
          </section>

          <section className="admin-layout">
            <article className="admin-card admin-panel-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Ostatnie rezerwacje</p>
                  <h2>Co ostatnio wpadlo do systemu</h2>
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
                    </article>
                  ))}
                </div>
              )}
            </article>

            <div className="admin-side-column">
              <article className="admin-card admin-panel-card">
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
              </article>

              <article className="admin-card admin-panel-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Apartamenty i kalendarz</p>
                    <h2>Gotowosc integracji</h2>
                  </div>
                </div>

                {dashboard.apartments.length === 0 ? (
                  <p>Nie ma jeszcze zadnego apartamentu w bazie.</p>
                ) : (
                  <div className="admin-stack">
                    {dashboard.apartments.map((apartment) => (
                      <article className="admin-row-card" key={apartment.id}>
                        <div className="admin-row-top">
                          <div>
                            <h3>{apartment.name}</h3>
                            <p>{apartment.city ?? "Miasto nieuzupelnione"}</p>
                          </div>
                          <span
                            className={
                              apartment.isActive
                                ? "status-badge status-badge--success"
                                : "status-badge status-badge--danger"
                            }
                          >
                            {apartment.isActive ? "Aktywny" : "Nieaktywny"}
                          </span>
                        </div>
                        <p className="inline-meta">
                          Google Calendar:{" "}
                          {apartment.googleCalendarId ? "podlaczony w rekordzie apartamentu" : "brak ID kalendarza"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </article>

              <article className="admin-card admin-panel-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Nastepne kroki</p>
                    <h2>Co jeszcze dobudujemy</h2>
                  </div>
                </div>
                <ul className="admin-checklist">
                  <li>Rezerwacja reczna z poziomu panelu.</li>
                  <li>Reczne blokady terminow bez wchodzenia do bazy.</li>
                  <li>Edycja cen i zasad pobytu dla apartamentu.</li>
                  <li>Docelowo logowanie administratora.</li>
                </ul>
              </article>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
