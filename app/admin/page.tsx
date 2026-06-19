import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EmailLogStatus, PricingRuleType } from "@prisma/client";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView, WEEK_DAY_LABELS } from "@/lib/calendar/month-view";
import { DomainError } from "@/lib/errors/domain-error";
import { cancelReservation } from "@/services/admin/cancel-reservation";
import { createApartment } from "@/services/admin/create-apartment";
import { createCalendarBlock } from "@/services/admin/create-calendar-block";
import { createPricingRule } from "@/services/admin/create-pricing-rule";
import { deleteApartment } from "@/services/admin/delete-apartment";
import { deleteCalendarBlock } from "@/services/admin/delete-calendar-block";
import { deletePricingRule } from "@/services/admin/delete-pricing-rule";
import { getGoogleCalendarIntegrationStatus } from "@/services/calendar/get-google-calendar-integration-status";
import {
  type AdminDashboardData,
  formatDashboardMoney,
  getAdminDashboardData,
} from "@/services/admin/get-admin-dashboard-data";
import { sendReservationCancelledEmail } from "@/services/email/send-reservation-cancelled-email";
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

function getBadgeClass(status: string) {
  if (status === "CONFIRMED" || status === "PAID" || status === "COMPLETED") {
    return "status-badge status-badge--success";
  }

  if (status === "CANCELLED" || status === "FAILED" || status === "EXPIRED") {
    return "status-badge status-badge--danger";
  }

  return "status-badge status-badge--warning";
}

function getEmailBadgeClass(status: EmailLogStatus) {
  if (status === EmailLogStatus.SENT) {
    return "status-badge status-badge--success";
  }

  if (status === EmailLogStatus.FAILED) {
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
    month?: string;
    status?: string;
    message?: string;
    previewApartmentId?: string;
    previewCheckInDate?: string;
    previewCheckOutDate?: string;
  }>;
};

type ReadyDashboardApartment = Extract<AdminDashboardData, { state: "ready" }>["apartments"][number];

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const monthCalendar = buildMonthView(params?.month);
  const dashboard = await getAdminDashboardData({
    monthStart: monthCalendar.monthStart,
    monthEnd: monthCalendar.monthEnd,
  });
  const status = params?.status;
  const message = params?.message;
  const previewApartmentId = params?.previewApartmentId;
  const previewCheckInDate = params?.previewCheckInDate;
  const previewCheckOutDate = params?.previewCheckOutDate;
  const googleCalendarConfigReady = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );
  const adminMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;
  const apartmentsWithCalendarIds =
    dashboard.state === "ready"
      ? dashboard.apartments.filter((apartment) => apartment.googleCalendarId).length
      : 0;
  const activeApartmentsForCalendar =
    dashboard.state === "ready"
      ? dashboard.apartments.filter((apartment) => apartment.isActive)
      : [];
  const activeApartmentsForManagement =
    dashboard.state === "ready"
      ? dashboard.apartments.filter((apartment) => apartment.isActive)
      : [];
  const inactiveApartmentsForManagement =
    dashboard.state === "ready"
      ? dashboard.apartments.filter((apartment) => !apartment.isActive)
      : [];
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

  function renderApartmentManagementCard(apartment: ReadyDashboardApartment) {
    return (
      <article className="admin-row-card" id={`apartment-editor-${apartment.id}`} key={apartment.id}>
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

        <details className="admin-details admin-details--danger">
          <summary>Usun apartament</summary>

          <form action={deleteApartmentAction} className="admin-form admin-form--nested">
            <input name="apartmentId" type="hidden" value={apartment.id} />

            <div className="inline-notice inline-notice--danger">
              <p>
                Apartament mozna usunac tylko wtedy, gdy nie ma jeszcze zadnych rezerwacji.
                Reguly cenowe i reczne blokady zostana skasowane razem z nim.
              </p>
            </div>

            <div className="admin-form-actions">
              <button className="cta-button cta-button--danger" type="submit">
                Potwierdz usuniecie
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

        <details className="admin-details">
          <summary>Dodaj reczna blokade terminu</summary>

          <form action={createCalendarBlockAction} className="admin-form admin-form--nested">
            <input name="apartmentId" type="hidden" value={apartment.id} />

            <div className="admin-form-grid admin-form-grid--compact">
              <label className="admin-field">
                <span>Data od</span>
                <input name="dateFrom" type="date" required />
              </label>

              <label className="admin-field">
                <span>Data do</span>
                <input name="dateTo" type="date" required />
              </label>
            </div>

            <label className="admin-field">
              <span>Powod blokady</span>
              <input
                name="reason"
                type="text"
                placeholder="Np. pobyt wlasciciela, serwis, remont"
              />
            </label>

            <div className="admin-form-actions">
              <button className="cta-button" type="submit">
                Zapisz blokade
              </button>
            </div>
          </form>
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

        <div className="pricing-rule-list">
          <p className="pricing-rule-list-title">Reczne blokady terminow</p>
          {apartment.calendarBlocks.length === 0 ? (
            <p className="inline-meta">
              Brak recznych blokad dla tego apartamentu.
            </p>
          ) : (
            <div className="admin-stack">
              {apartment.calendarBlocks.map((block) => (
                <article className="pricing-rule-card" key={block.id}>
                  <div className="admin-row-top">
                    <div>
                      <h3>{block.dateFrom} - {block.dateTo}</h3>
                      <p>{block.reason ?? "Blokada reczna bez opisu"}</p>
                    </div>
                    <span className="status-badge status-badge--danger">
                      Zablokowane
                    </span>
                  </div>

                  <form action={deleteCalendarBlockAction} className="admin-inline-form">
                    <input name="calendarBlockId" type="hidden" value={block.id} />
                    <button className="cta-button cta-button--danger" type="submit">
                      Usun blokade
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </div>
      </article>
    );
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

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=created`);
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

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=updated`);
  }

  async function deleteApartmentAction(formData: FormData) {
    "use server";

    try {
      await deleteApartment(readString(formData, "apartmentId"));
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie usunac apartamentu. Sprobuj ponownie.";

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=deleted`);
  }

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
    revalidatePath("/");
    redirect(
      `/admin?${adminMonthQuery}&status=${nextStatus}${nextMessage ? `&message=${encodeURIComponent(nextMessage)}` : ""}`,
    );
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

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=rule_created`);
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

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=rule_updated`);
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

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=rule_deleted`);
  }

  async function previewPricingRuleAction(formData: FormData) {
    "use server";

    const apartmentId = readString(formData, "apartmentId");
    const checkInDate = readString(formData, "checkInDate");
    const checkOutDate = readString(formData, "checkOutDate");

    if (!apartmentId || !checkInDate || !checkOutDate) {
      redirect(
        `/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent("Uzupelnij termin, aby policzyc podglad ceny.")}`,
      );
    }

    redirect(
      `/admin?${adminMonthQuery}&previewApartmentId=${encodeURIComponent(apartmentId)}&previewCheckInDate=${encodeURIComponent(checkInDate)}&previewCheckOutDate=${encodeURIComponent(checkOutDate)}#pricing-preview-${encodeURIComponent(apartmentId)}`,
    );
  }

  async function createCalendarBlockAction(formData: FormData) {
    "use server";

    try {
      await createCalendarBlock({
        apartmentId: readString(formData, "apartmentId"),
        dateFrom: readString(formData, "dateFrom"),
        dateTo: readString(formData, "dateTo"),
        reason: readString(formData, "reason"),
      });
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie zapisac blokady terminu. Sprobuj ponownie.";

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=block_created`);
  }

  async function deleteCalendarBlockAction(formData: FormData) {
    "use server";

    try {
      await deleteCalendarBlock(readString(formData, "calendarBlockId"));
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie usunac blokady terminu. Sprobuj ponownie.";

      redirect(`/admin?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    revalidatePath("/admin");
    redirect(`/admin?${adminMonthQuery}&status=block_deleted`);
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
            <h2>Kalendarz zajetosci</h2>
          </div>
        </div>

        <p>
          Tutaj widzisz wybrany miesiac i szybko sprawdzisz, ktore dni sa juz
          zajete przez rezerwacje, reczne blokady lub Google Calendar.
        </p>

        <div className="inline-notice">
          <p>Kalendarz pokazuje tylko apartamenty aktywne. Nieaktywne pozostaja dostepne nizej do edycji.</p>
        </div>

        <div className="calendar-toolbar">
          <Link className="calendar-nav-button" href={`/admin?month=${monthCalendar.previousMonthParam}`}>
            Poprzedni miesiac
          </Link>
          <span className="calendar-toolbar-label">{monthCalendar.monthLabel}</span>
          <Link className="calendar-nav-button" href={`/admin?month=${monthCalendar.nextMonthParam}`}>
            Nastepny miesiac
          </Link>
        </div>

        <div
          className={`inline-notice ${googleCalendarConfigReady ? "inline-notice--success" : ""}`}
        >
          <p>
            Google Calendar:{" "}
            {googleCalendarConfigReady
              ? `konto serwisowe jest gotowe, a ${apartmentsWithCalendarIds} apartament(y) maja wpisane calendar ID.`
              : "brakuje jeszcze danych konta serwisowego w Vercel."}
          </p>
        </div>

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

        {status === "deleted" ? (
          <div className="inline-notice inline-notice--success">
            <p>Apartament zostal usuniety poprawnie.</p>
          </div>
        ) : null}

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

        {status === "block_created" ? (
          <div className="inline-notice inline-notice--success">
            <p>Blokada terminu zostala zapisana.</p>
          </div>
        ) : null}

        {status === "block_deleted" ? (
          <div className="inline-notice inline-notice--success">
            <p>Blokada terminu zostala usunieta.</p>
          </div>
        ) : null}

        {status === "error" && message ? (
          <div className="inline-notice inline-notice--danger">
            <p>{message}</p>
          </div>
        ) : null}

        {dashboard.state === "ready" ? (
          activeApartmentsForCalendar.length === 0 ? (
            <div className="inline-notice">
              <p>Brak aktywnych apartamentow do pokazania w kalendarzu zajetosci.</p>
            </div>
          ) : (
            <div className="admin-stack">
              {activeApartmentsForCalendar.map((apartment) => {
                const occupancyByDate = new Map(
                  apartment.occupancyDates.map((item) => [item.date, item]),
                );

                return (
                  <article className="calendar-card" key={`calendar-${apartment.id}`}>
                    <div className="calendar-card-header">
                      <div>
                        <h3>{apartment.name}</h3>
                        <p>{apartment.city ?? "Miasto nieuzupelnione"}</p>
                      </div>
                      <span className="calendar-month-chip">{monthCalendar.monthLabel}</span>
                    </div>

                    <div className="calendar-grid-labels">
                      {WEEK_DAY_LABELS.map((label) => (
                        <span key={`${apartment.id}-${label}`}>{label}</span>
                      ))}
                    </div>

                    <div className="calendar-grid">
                      {monthCalendar.days.map((day) => {
                        const occupied = occupancyByDate.get(day.isoDate);

                        return (
                          <div
                            className={[
                              "calendar-day",
                              day.isCurrentMonth ? "" : "calendar-day--muted",
                              occupied
                                ? occupied.source === "calendar_block"
                                  ? "calendar-day--blocked"
                                  : occupied.source === "google_calendar"
                                    ? "calendar-day--google"
                                  : "calendar-day--reserved"
                                : "calendar-day--free",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={`${apartment.id}-${day.isoDate}`}
                            title={occupied ? `${day.isoDate} | ${occupied.label}` : `${day.isoDate} | Wolny termin`}
                          >
                            <span>{day.dayNumber}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="calendar-legend">
                      <span><i className="calendar-dot calendar-dot--free" /> Wolne</span>
                      <span><i className="calendar-dot calendar-dot--reserved" /> Rezerwacja</span>
                      <span><i className="calendar-dot calendar-dot--blocked" /> Blokada reczna</span>
                      <span><i className="calendar-dot calendar-dot--google" /> Google Calendar</span>
                    </div>

                    <div className="calendar-card-actions">
                      <a className="cta-button" href={`#apartment-editor-${apartment.id}`}>
                        Edytuj apartament
                      </a>

                      <details className="admin-details admin-details--danger">
                        <summary>Usun apartament</summary>

                        <form action={deleteApartmentAction} className="admin-form admin-form--nested">
                          <input name="apartmentId" type="hidden" value={apartment.id} />

                          <div className="inline-notice inline-notice--danger">
                            <p>
                              Ta operacja usunie apartament oraz jego reguly cenowe i reczne blokady.
                              Jesli istnieja rezerwacje, system zablokuje usuniecie.
                            </p>
                          </div>

                          <div className="admin-form-actions">
                            <button className="cta-button cta-button--danger" type="submit">
                              Potwierdz usuniecie
                            </button>
                          </div>
                        </form>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <div className="inline-notice">
            <p>Kalendarz zajetosci pojawi sie, gdy panel poprawnie odczyta dane z bazy.</p>
          </div>
        )}

        <details className="admin-details admin-details--top-form">
          <summary>Dodaj apartament</summary>

          <form action={createApartmentAction} className="admin-form admin-form--nested">
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
        </details>
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
            </article>

            <div className="admin-side-column">
              <article className="admin-card admin-panel-card">
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

              <article className="admin-card admin-panel-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Wiadomosci</p>
                    <h2>Automatyczne wiadomosci</h2>
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
              </article>

              <article className="admin-card admin-panel-card">
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
                      </article>
                    ))}
                  </div>
                )}
              </article>

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
                    <div className="admin-subsection">
                      <div className="section-heading section-heading--compact">
                        <div>
                          <p className="eyebrow">Apartamenty aktywne</p>
                          <h3>Obiekty gotowe do sprzedazy i obslugi</h3>
                        </div>
                      </div>
                      {activeApartmentsForManagement.length === 0 ? (
                        <p>Nie ma teraz zadnego aktywnego apartamentu.</p>
                      ) : (
                        <div className="admin-stack">
                          {activeApartmentsForManagement.map((apartment) =>
                            renderApartmentManagementCard(apartment),
                          )}
                        </div>
                      )}
                    </div>

                    <div className="admin-subsection">
                      <div className="section-heading section-heading--compact">
                        <div>
                          <p className="eyebrow">Apartamenty nieaktywne</p>
                          <h3>Obiekty ukryte ze sprzedazy, ale zachowane w systemie</h3>
                        </div>
                      </div>
                      {inactiveApartmentsForManagement.length === 0 ? (
                        <p>Nie ma teraz zadnego nieaktywnego apartamentu.</p>
                      ) : (
                        <div className="admin-stack">
                          {inactiveApartmentsForManagement.map((apartment) =>
                            renderApartmentManagementCard(apartment),
                          )}
                        </div>
                      )}
                    </div>
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
                  <li>Podglad kalendarza miesiecznego dla apartamentu.</li>
                  <li>Gotowe szablony wiadomosci do edycji przez operatora.</li>
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
