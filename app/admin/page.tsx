import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PricingRuleType } from "@prisma/client";

import { APP_VERSION } from "@/lib/app-version";
import { DomainError } from "@/lib/errors/domain-error";
import { createApartment } from "@/services/admin/create-apartment";
import { createPricingRule } from "@/services/admin/create-pricing-rule";
import { deletePricingRule } from "@/services/admin/delete-pricing-rule";
import {
  formatDashboardMoney,
  getAdminDashboardData,
} from "@/services/admin/get-admin-dashboard-data";
import { previewPricingCalculation } from "@/services/admin/preview-pricing-calculation";
import { updateApartment } from "@/services/admin/update-apartment";
import { updatePricingRule } from "@/services/admin/update-pricing-rule";

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

const pricingRuleTypeLabels: Record<PricingRuleType, string> = {
  SEASONAL: "Sezon",
  WEEKEND: "Weekend",
  EVENT: "Event",
  CUSTOM: "Wlasna",
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

function readOptionalNumber(formData: FormData, key: string) {
  const rawValue = readString(formData, key);

  if (!rawValue) {
    return null;
  }

  return Number(rawValue.replace(",", "."));
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

type AdminPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    previewApartmentId?: string;
    previewCheckInDate?: string;
    previewCheckOutDate?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const dashboard = await getAdminDashboardData();
  const status = params?.status;
  const message = params?.message;
  const previewApartmentId = params?.previewApartmentId;
  const previewCheckInDate = params?.previewCheckInDate;
  const previewCheckOutDate = params?.previewCheckOutDate;
  let pricingPreview:
    | Awaited<ReturnType<typeof previewPricingCalculation>>
    | null = null;
  let pricingPreviewError: string | null = null;

  if (previewApartmentId && previewCheckInDate && previewCheckOutDate) {
    try {
      pricingPreview = await previewPricingCalculation(
        previewApartmentId,
        previewCheckInDate,
        previewCheckOutDate,
      );
    } catch (error) {
      pricingPreviewError =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie policzyc podgladu ceny.";
    }
  }

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

  async function updateApartmentAction(formData: FormData) {
    "use server";

    try {
      await updateApartment({
        apartmentId: readString(formData, "apartmentId"),
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
        isActive: readBoolean(formData, "isActive"),
      });
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie zapisac zmian apartamentu. Sprobuj ponownie.";

      redirect(`/admin?status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect("/admin?status=updated");
  }

  async function createPricingRuleAction(formData: FormData) {
    "use server";

    const ruleTypeRaw = readString(formData, "ruleType");
    const ruleType = Object.values(PricingRuleType).includes(
      ruleTypeRaw as PricingRuleType,
    )
      ? (ruleTypeRaw as PricingRuleType)
      : PricingRuleType.CUSTOM;

    try {
      await createPricingRule({
        apartmentId: readString(formData, "apartmentId"),
        name: readString(formData, "name"),
        ruleType,
        dateFrom: readString(formData, "dateFrom"),
        dateTo: readString(formData, "dateTo"),
        pricePerNight: readNumber(formData, "pricePerNight"),
        minimumNights: readOptionalNumber(formData, "minimumNights"),
        priority: readOptionalNumber(formData, "priority") ?? 0,
      });
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie dodac reguly cenowej. Sprobuj ponownie.";

      redirect(`/admin?status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect("/admin?status=rule_created");
  }

  async function updatePricingRuleAction(formData: FormData) {
    "use server";

    const ruleTypeRaw = readString(formData, "ruleType");
    const ruleType = Object.values(PricingRuleType).includes(
      ruleTypeRaw as PricingRuleType,
    )
      ? (ruleTypeRaw as PricingRuleType)
      : PricingRuleType.CUSTOM;

    try {
      await updatePricingRule({
        pricingRuleId: readString(formData, "pricingRuleId"),
        name: readString(formData, "name"),
        ruleType,
        dateFrom: readString(formData, "dateFrom"),
        dateTo: readString(formData, "dateTo"),
        pricePerNight: readNumber(formData, "pricePerNight"),
        minimumNights: readOptionalNumber(formData, "minimumNights"),
        priority: readOptionalNumber(formData, "priority") ?? 0,
        isActive: readBoolean(formData, "isActive"),
      });
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie zapisac reguly cenowej. Sprobuj ponownie.";

      redirect(`/admin?status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect("/admin?status=rule_updated");
  }

  async function deletePricingRuleAction(formData: FormData) {
    "use server";

    try {
      await deletePricingRule(readString(formData, "pricingRuleId"));
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie wylaczyc reguly cenowej. Sprobuj ponownie.";

      redirect(`/admin?status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect("/admin?status=rule_deleted");
  }

  async function previewPricingRuleAction(formData: FormData) {
    "use server";

    const apartmentId = readString(formData, "apartmentId");
    const checkInDate = readString(formData, "checkInDate");
    const checkOutDate = readString(formData, "checkOutDate");

    if (!apartmentId || !checkInDate || !checkOutDate) {
      redirect(
        `/admin?status=error&message=${encodeURIComponent("Uzupelnij termin, aby policzyc podglad ceny.")}`,
      );
    }

    redirect(
      `/admin?previewApartmentId=${encodeURIComponent(apartmentId)}&previewCheckInDate=${encodeURIComponent(checkInDate)}&previewCheckOutDate=${encodeURIComponent(checkOutDate)}#pricing-preview-${encodeURIComponent(apartmentId)}`,
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
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

        {status === "updated" ? (
          <div className="inline-notice inline-notice--success">
            <p>Dane apartamentu zostaly zaktualizowane.</p>
          </div>
        ) : null}

        {status === "rule_created" ? (
          <div className="inline-notice inline-notice--success">
            <p>Regula cenowa zostala dodana poprawnie.</p>
          </div>
        ) : null}

        {status === "rule_updated" ? (
          <div className="inline-notice inline-notice--success">
            <p>Regula cenowa zostala zaktualizowana.</p>
          </div>
        ) : null}

        {status === "rule_deleted" ? (
          <div className="inline-notice inline-notice--success">
            <p>Regula cenowa zostala wylaczona.</p>
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
          {dashboard.warningMessage ? (
            <section className="admin-card admin-state-card">
              <h2>Panel dziala czesciowo</h2>
              <p>{dashboard.warningMessage}</p>
              <p>
                Formularz i lista apartamentow sa aktywne. Sekcje rezerwacji i
                platnosci dopinamy osobno.
              </p>
            </section>
          ) : null}

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
                    <h2>Edycja i ceny specjalne</h2>
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
                          Cena bazowa: {formatDashboardMoney(apartment.basePricePerNight, "PLN")}
                        </p>
                        <p className="inline-meta">
                          Min. noclegi: {apartment.minimumNights} | Max gosci: {apartment.maxGuests}
                        </p>
                        <p className="inline-meta">
                          Google Calendar:{" "}
                          {apartment.googleCalendarId ? "podlaczony w rekordzie apartamentu" : "brak ID kalendarza"}
                        </p>

                        <details className="admin-details">
                          <summary>Edytuj dane apartamentu</summary>

                          <form action={updateApartmentAction} className="admin-form admin-form--nested">
                            <input name="apartmentId" type="hidden" value={apartment.id} />

                            <div className="admin-form-grid">
                              <label className="admin-field">
                                <span>Nazwa apartamentu</span>
                                <input name="name" type="text" required defaultValue={apartment.name} />
                              </label>

                              <label className="admin-field">
                                <span>Slug</span>
                                <input name="slug" type="text" defaultValue={apartment.slug} />
                              </label>

                              <label className="admin-field">
                                <span>Miasto</span>
                                <input name="city" type="text" defaultValue={apartment.city ?? ""} />
                              </label>

                              <label className="admin-field">
                                <span>Adres</span>
                                <input name="address" type="text" defaultValue={apartment.address ?? ""} />
                              </label>

                              <label className="admin-field">
                                <span>Maksymalna liczba gosci</span>
                                <input name="maxGuests" type="number" min="1" step="1" required defaultValue={String(apartment.maxGuests)} />
                              </label>

                              <label className="admin-field">
                                <span>Cena bazowa za noc (PLN)</span>
                                <input name="basePricePerNight" type="number" min="0" step="0.01" required defaultValue={String(apartment.basePricePerNight)} />
                              </label>

                              <label className="admin-field">
                                <span>Sprzatanie (PLN)</span>
                                <input name="cleaningFee" type="number" min="0" step="0.01" required defaultValue={String(apartment.cleaningFee)} />
                              </label>

                              <label className="admin-field">
                                <span>Kaucja (PLN)</span>
                                <input name="depositAmount" type="number" min="0" step="0.01" required defaultValue={String(apartment.depositAmount)} />
                              </label>

                              <label className="admin-field">
                                <span>Minimalna liczba nocy</span>
                                <input name="minimumNights" type="number" min="1" step="1" required defaultValue={String(apartment.minimumNights)} />
                              </label>

                              <label className="admin-field">
                                <span>Check-in</span>
                                <input name="defaultCheckInTime" type="text" defaultValue={apartment.defaultCheckInTime ?? ""} />
                              </label>

                              <label className="admin-field">
                                <span>Check-out</span>
                                <input name="defaultCheckOutTime" type="text" defaultValue={apartment.defaultCheckOutTime ?? ""} />
                              </label>

                              <label className="admin-field">
                                <span>Google Calendar ID</span>
                                <input name="googleCalendarId" type="text" defaultValue={apartment.googleCalendarId ?? ""} />
                              </label>
                            </div>

                            <label className="admin-field">
                              <span>Opis</span>
                              <textarea name="description" rows={3} defaultValue={apartment.description ?? ""} />
                            </label>

                            <label className="admin-toggle">
                              <input
                                name="isActive"
                                type="checkbox"
                                defaultChecked={apartment.isActive}
                              />
                              <span>Apartament jest aktywny i widoczny w sprzedazy</span>
                            </label>

                            <div className="admin-form-actions">
                              <button className="cta-button" type="submit">
                                Zapisz zmiany
                              </button>
                            </div>
                          </form>
                        </details>

                        <details className="admin-details">
                          <summary>Dodaj cene specjalna</summary>

                          <form action={createPricingRuleAction} className="admin-form admin-form--nested">
                            <input name="apartmentId" type="hidden" value={apartment.id} />

                            <div className="admin-form-grid">
                              <label className="admin-field">
                                <span>Nazwa reguly</span>
                                <input
                                  name="name"
                                  type="text"
                                  required
                                  placeholder="Np. Weekend wakacyjny"
                                />
                              </label>

                              <label className="admin-field">
                                <span>Typ reguly</span>
                                <select name="ruleType" defaultValue={PricingRuleType.SEASONAL}>
                                  <option value={PricingRuleType.SEASONAL}>Sezon</option>
                                  <option value={PricingRuleType.WEEKEND}>Weekend</option>
                                  <option value={PricingRuleType.EVENT}>Event</option>
                                  <option value={PricingRuleType.CUSTOM}>Wlasna</option>
                                </select>
                              </label>

                              <label className="admin-field">
                                <span>Data od</span>
                                <input name="dateFrom" type="date" required />
                              </label>

                              <label className="admin-field">
                                <span>Data do</span>
                                <input name="dateTo" type="date" required />
                              </label>

                              <label className="admin-field">
                                <span>Nowa cena za noc (PLN)</span>
                                <input name="pricePerNight" type="number" min="0" step="0.01" required />
                              </label>

                              <label className="admin-field">
                                <span>Minimalna liczba nocy</span>
                                <input name="minimumNights" type="number" min="1" step="1" placeholder="Opcjonalnie" />
                              </label>

                              <label className="admin-field">
                                <span>Priorytet</span>
                                <input
                                  name="priority"
                                  type="number"
                                  min="0"
                                  step="1"
                                  defaultValue="10"
                                />
                              </label>
                            </div>

                            <p className="admin-form-note">
                              Wyzszy priorytet wygrywa, gdy kilka regul pasuje do tej samej nocy.
                            </p>

                            <div className="admin-form-actions">
                              <button className="cta-button" type="submit">
                                Dodaj regule cenowa
                              </button>
                            </div>
                          </form>
                        </details>

                        <details
                          className="admin-details"
                          open={previewApartmentId === apartment.id}
                          id={`pricing-preview-${apartment.id}`}
                        >
                          <summary>Sprawdz kalkulacje ceny</summary>

                          <form action={previewPricingRuleAction} className="admin-form admin-form--nested">
                            <input name="apartmentId" type="hidden" value={apartment.id} />

                            <div className="admin-form-grid admin-form-grid--compact">
                              <label className="admin-field">
                                <span>Przyjazd</span>
                                <input
                                  name="checkInDate"
                                  type="date"
                                  required
                                  defaultValue={
                                    previewApartmentId === apartment.id
                                      ? previewCheckInDate ?? ""
                                      : ""
                                  }
                                />
                              </label>

                              <label className="admin-field">
                                <span>Wyjazd</span>
                                <input
                                  name="checkOutDate"
                                  type="date"
                                  required
                                  defaultValue={
                                    previewApartmentId === apartment.id
                                      ? previewCheckOutDate ?? ""
                                      : ""
                                  }
                                />
                              </label>
                            </div>

                            <div className="admin-form-actions">
                              <button className="cta-button" type="submit">
                                Policz cene pobytu
                              </button>
                            </div>
                          </form>

                          {previewApartmentId === apartment.id && pricingPreviewError ? (
                            <div className="inline-notice inline-notice--danger">
                              <p>{pricingPreviewError}</p>
                            </div>
                          ) : null}

                          {previewApartmentId === apartment.id && pricingPreview ? (
                            <article className="pricing-preview-card pricing-preview-card--active">
                              <h3>Podglad kalkulacji</h3>
                              <p className="inline-meta">
                                Nocy: {pricingPreview.nightsCount}
                              </p>
                              <p className="inline-meta">
                                Noclegi: {formatDashboardMoney(pricingPreview.accommodationAmount, pricingPreview.currency)}
                              </p>
                              <p className="inline-meta">
                                Sprzatanie: {formatDashboardMoney(pricingPreview.cleaningFee, pricingPreview.currency)}
                              </p>
                              <p className="inline-meta">
                                Kaucja: {formatDashboardMoney(pricingPreview.depositAmount, pricingPreview.currency)}
                              </p>
                              <p className="inline-meta pricing-preview-total">
                                Razem: {formatDashboardMoney(pricingPreview.totalAmount, pricingPreview.currency)}
                              </p>

                              <div className="admin-stack">
                                {pricingPreview.nightlyBreakdown.map((night) => (
                                  <article className="pricing-preview-night" key={night.date}>
                                    <div className="admin-row-top">
                                      <div>
                                        <h3>{night.date}</h3>
                                        <p>
                                          {night.source === "pricing_rule"
                                            ? `Regula: ${night.pricingRuleName ?? "specjalna cena"}`
                                            : "Cena bazowa"}
                                        </p>
                                      </div>
                                      <span className="status-badge status-badge--warning">
                                        {formatDashboardMoney(night.pricePerNight, pricingPreview.currency)}
                                      </span>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </article>
                          ) : null}
                        </details>

                        <div className="pricing-rule-list">
                          <p className="pricing-rule-list-title">Aktywne reguly cenowe</p>
                          {apartment.pricingRules.length === 0 ? (
                            <p className="inline-meta">
                              Brak dodatkowych cen. System uzyje ceny bazowej.
                            </p>
                          ) : (
                            <div className="admin-stack">
                              {apartment.pricingRules.map((rule) => (
                                <article className="pricing-rule-card" key={rule.id}>
                                  <div className="admin-row-top">
                                    <div>
                                      <h3>{rule.name}</h3>
                                      <p>
                                        {pricingRuleTypeLabels[rule.ruleType]} | {rule.dateFrom} - {rule.dateTo}
                                      </p>
                                    </div>
                                    <span className="status-badge status-badge--warning">
                                      Priorytet {rule.priority}
                                    </span>
                                  </div>
                                  <p className="inline-meta">
                                    Cena: {formatDashboardMoney(rule.pricePerNight, "PLN")}
                                  </p>
                                  <p className="inline-meta">
                                    Minimalna liczba nocy: {rule.minimumNights ?? "bez limitu"}
                                  </p>
                                  {rule.ruleType === PricingRuleType.WEEKEND ? (
                                    <p className="inline-meta">
                                      Regula weekendowa dziala dla piatku i soboty.
                                    </p>
                                  ) : null}

                                  <details className="admin-details admin-details--flat">
                                    <summary>Edytuj te regule</summary>

                                    <form action={updatePricingRuleAction} className="admin-form admin-form--nested">
                                      <input name="pricingRuleId" type="hidden" value={rule.id} />

                                      <div className="admin-form-grid">
                                        <label className="admin-field">
                                          <span>Nazwa reguly</span>
                                          <input name="name" type="text" required defaultValue={rule.name} />
                                        </label>

                                        <label className="admin-field">
                                          <span>Typ reguly</span>
                                          <select name="ruleType" defaultValue={rule.ruleType}>
                                            <option value={PricingRuleType.SEASONAL}>Sezon</option>
                                            <option value={PricingRuleType.WEEKEND}>Weekend</option>
                                            <option value={PricingRuleType.EVENT}>Event</option>
                                            <option value={PricingRuleType.CUSTOM}>Wlasna</option>
                                          </select>
                                        </label>

                                        <label className="admin-field">
                                          <span>Data od</span>
                                          <input name="dateFrom" type="date" required defaultValue={rule.dateFrom} />
                                        </label>

                                        <label className="admin-field">
                                          <span>Data do</span>
                                          <input name="dateTo" type="date" required defaultValue={rule.dateTo} />
                                        </label>

                                        <label className="admin-field">
                                          <span>Cena za noc (PLN)</span>
                                          <input name="pricePerNight" type="number" min="0" step="0.01" required defaultValue={String(rule.pricePerNight)} />
                                        </label>

                                        <label className="admin-field">
                                          <span>Minimalna liczba nocy</span>
                                          <input name="minimumNights" type="number" min="1" step="1" defaultValue={rule.minimumNights ?? ""} />
                                        </label>

                                        <label className="admin-field">
                                          <span>Priorytet</span>
                                          <input name="priority" type="number" min="0" step="1" required defaultValue={String(rule.priority)} />
                                        </label>
                                      </div>

                                      <label className="admin-toggle">
                                        <input
                                          name="isActive"
                                          type="checkbox"
                                          defaultChecked={rule.isActive}
                                        />
                                        <span>Regula jest aktywna</span>
                                      </label>

                                      <div className="admin-form-actions">
                                        <button className="cta-button" type="submit">
                                          Zapisz regule
                                        </button>
                                      </div>
                                    </form>

                                    <form action={deletePricingRuleAction} className="admin-inline-form">
                                      <input name="pricingRuleId" type="hidden" value={rule.id} />
                                      <button className="cta-button cta-button--danger" type="submit">
                                        Wylacz te regule
                                      </button>
                                    </form>
                                  </details>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
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
                  <li>Podglad ceny z publicznego formularza rezerwacji.</li>
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
