import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView, WEEK_DAY_LABELS } from "@/lib/calendar/month-view";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";
import { getApartmentImages } from "@/services/admin/apartment-images";
import { getGoogleCalendarBusyMap } from "@/services/calendar";
import { createOnlineReservationWithPrisma } from "@/services/reservations";

const nextSteps = [
  "Zbieranie pierwszych prawdziwych rezerwacji online.",
  "Dalsze dopinanie blokad terminow i pracy operatora.",
  "Rozszerzenie pracy operatora i automatyzacji po rezerwacji.",
];

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildPublicOccupancyDates(input: {
  reservations: {
    reservationNumber: string;
    checkInDate: Date;
    checkOutDate: Date;
  }[];
  calendarBlocks: {
    dateFrom: Date;
    dateTo: Date;
    reason: string | null;
  }[];
  googleCalendarDates: {
    date: string;
    source: "google_calendar";
    label: string;
  }[];
}) {
  const occupancyMap = new Map<
    string,
    {
      date: string;
      source: "reservation" | "calendar_block" | "google_calendar";
      label: string;
    }
  >();

  for (const reservation of input.reservations) {
    for (
      let cursor = new Date(reservation.checkInDate);
      cursor < reservation.checkOutDate;
      cursor = addDays(cursor, 1)
    ) {
      const isoDate = toIsoDate(cursor);
      occupancyMap.set(isoDate, {
        date: isoDate,
        source: "reservation",
        label: `Rezerwacja ${reservation.reservationNumber}`,
      });
    }
  }

  for (const block of input.calendarBlocks) {
    for (
      let cursor = new Date(block.dateFrom);
      cursor <= block.dateTo;
      cursor = addDays(cursor, 1)
    ) {
      const isoDate = toIsoDate(cursor);
      occupancyMap.set(isoDate, {
        date: isoDate,
        source: "calendar_block",
        label: block.reason ?? "Blokada reczna",
      });
    }
  }

  for (const googleDate of input.googleCalendarDates) {
    if (!occupancyMap.has(googleDate.date)) {
      occupancyMap.set(googleDate.date, googleDate);
    }
  }

  return Array.from(occupancyMap.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readNumber(formData: FormData, key: string) {
  const rawValue = readString(formData, key).replace(",", ".");
  return Number(rawValue);
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function resolveAppBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (productionDomain) {
    return `https://${productionDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  const fallbackDomain = process.env.VERCEL_URL?.trim();

  if (fallbackDomain) {
    return `https://${fallbackDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  return null;
}

type HomePageProps = {
  searchParams?: Promise<{
    month?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const status = params?.status;
  const message = params?.message;
  const monthCalendar = buildMonthView(params?.month);
  const homeMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;

  let apartments:
    | Array<{
        id: string;
        name: string;
        city: string | null;
        owner: {
          name: string;
          username: string;
        } | null;
        basePricePerNight: unknown;
        googleCalendarId: string | null;
        reservations: {
          reservationNumber: string;
          checkInDate: Date;
          checkOutDate: Date;
        }[];
        calendarBlocks: {
          id: string;
          dateFrom: Date;
          dateTo: Date;
          reason: string | null;
        }[];
      }>
    | [] = [];
  let apartmentsError: string | null = null;
  let apartmentImages: Awaited<ReturnType<typeof getApartmentImages>> = [];
  const apartmentImagesByApartmentId = new Map<string, typeof apartmentImages>();

  try {
    apartmentImages = await getApartmentImages();
  } catch (error) {
    console.error("Apartment images load failed on homepage", error);
  }

  for (const image of apartmentImages) {
    const current = apartmentImagesByApartmentId.get(image.apartmentId) ?? [];
    current.push(image);
    apartmentImagesByApartmentId.set(image.apartmentId, current);
  }

  try {
    apartments = await prisma.apartment.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
        city: true,
        owner: {
          select: {
            name: true,
            username: true,
          },
        },
        basePricePerNight: true,
        googleCalendarId: true,
        reservations: {
          where: {
            status: {
              in: ["PENDING_PAYMENT", "CONFIRMED", "MANUAL_BLOCK"],
            },
            checkInDate: {
              lte: monthCalendar.monthEnd,
            },
            checkOutDate: {
              gt: monthCalendar.monthStart,
            },
          },
          select: {
            reservationNumber: true,
            checkInDate: true,
            checkOutDate: true,
          },
        },
        calendarBlocks: {
          where: {
            dateFrom: {
              lte: monthCalendar.monthEnd,
            },
            dateTo: {
              gte: monthCalendar.monthStart,
            },
          },
          select: {
            id: true,
            dateFrom: true,
            dateTo: true,
            reason: true,
          },
        },
      },
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error
        ? error.message
        : "Nie udalo sie pobrac apartamentow do formularza rezerwacji.";

    apartmentsError = rawMessage.includes("max clients reached")
      ? "Aplikacja chwilowo nie moze polaczyc sie z baza danych. To zwykle oznacza problem z konfiguracja polaczenia Supabase w Vercel."
      : rawMessage;
  }

  let googleCalendarBusyMap = new Map<
    string,
    { date: string; source: "google_calendar"; label: string }[]
  >();

  if (!apartmentsError) {
    try {
      googleCalendarBusyMap = await getGoogleCalendarBusyMap({
        calendars: apartments.map((apartment) => ({
          apartmentId: apartment.id,
          calendarId: apartment.googleCalendarId,
        })),
        dateFrom: monthCalendar.monthStart,
        dateTo: addDays(monthCalendar.monthEnd, 1),
      });
    } catch (error) {
      console.error("Google Calendar occupancy load failed on homepage", error);
    }
  }

  const apartmentsForCalendar = apartments.map((apartment) => ({
    id: apartment.id,
    name: apartment.name,
    city: apartment.city,
    ownerName: apartment.owner?.name ?? null,
    ownerUsername: apartment.owner?.username ?? null,
    basePricePerNight: Number(apartment.basePricePerNight),
    images: apartmentImagesByApartmentId.get(apartment.id) ?? [],
    occupancyDates: buildPublicOccupancyDates({
      reservations: apartment.reservations,
      calendarBlocks: apartment.calendarBlocks,
      googleCalendarDates: googleCalendarBusyMap.get(apartment.id) ?? [],
    }),
  }));

  async function createPublicReservationAction(formData: FormData) {
    "use server";

    const appBaseUrl = resolveAppBaseUrl();
    let paymentRedirectUrl: string;

    if (!appBaseUrl) {
      redirect(
        `/?${homeMonthQuery}&status=error&message=${encodeURIComponent("Brakuje adresu aplikacji do przekierowania na platnosc.")}`,
      );
    }

    try {
      const result = await createOnlineReservationWithPrisma({
        apartmentId: readString(formData, "apartmentId"),
        checkInDate: readString(formData, "checkInDate"),
        checkOutDate: readString(formData, "checkOutDate"),
        guestsCount: readNumber(formData, "guestsCount"),
        customerNotes: readString(formData, "customerNotes") || undefined,
        paymentBaseUrl: `${appBaseUrl}/pay`,
        guest: {
          firstName: readString(formData, "firstName"),
          lastName: readString(formData, "lastName"),
          email: readString(formData, "email"),
          phone: readString(formData, "phone"),
          country: readString(formData, "country") || undefined,
          city: readString(formData, "city") || undefined,
          language: "pl",
          marketingConsent: readBoolean(formData, "marketingConsent"),
          termsAccepted: readBoolean(formData, "termsAccepted"),
          rodoAccepted: readBoolean(formData, "rodoAccepted"),
        },
      });

      revalidatePath("/");
      paymentRedirectUrl = `${result.paymentDraft.paymentUrl}/checkout`;
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie utworzyc rezerwacji. Sprobuj ponownie.";

      redirect(`/?${homeMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    redirect(paymentRedirectUrl);
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">MVP start</p>
        <p className="version-chip">Wersja {APP_VERSION}</p>
        <h1>System rezerwacji apartamentu</h1>
        <p className="lead">
          Klient moze teraz wybrac apartament, termin i przejsc od razu do
          platnosci. Panel administratora obsluguje juz ceny specjalne oraz
          blokady terminow.
        </p>
      </section>

      <section className="content-grid">
        <article className="info-card">
          <h2>Co jest gotowe</h2>
          <p>
            Formularz publiczny pozwala przyjac rezerwacje online, a panel admina
            wspiera zarzadzanie cenami i dostepnoscia.
          </p>
        </article>

        <article className="info-card">
          <h2>Najblizsze kroki</h2>
          <ul>
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="info-card booking-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rezerwacja online</p>
            <h2>Zarezerwuj pobyt</h2>
          </div>
        </div>

        <p>
          Klient wypelnia ten formularz, a po poprawnym zapisie przechodzi od
          razu do bezpiecznej platnosci online.
        </p>

        {status === "error" && message ? (
          <div className="inline-notice inline-notice--danger">
            <p>{message}</p>
          </div>
        ) : null}

        {apartmentsError ? (
          <div className="inline-notice inline-notice--danger">
            <p>{apartmentsError}</p>
          </div>
        ) : null}

        {!apartmentsError && apartments.length === 0 ? (
          <div className="inline-notice">
            <p>Dodaj aktywny apartament w panelu admina, aby uruchomic rezerwacje online.</p>
          </div>
        ) : (
          <>
            <div className="public-gallery-list">
              {apartmentsForCalendar.map((apartment) => (
                <article className="public-gallery-card" key={`gallery-${apartment.id}`}>
                  <div>
                    <h3>{apartment.name}</h3>
                    <p>
                      {apartment.city ?? "Miasto nieuzupelnione"} | od{" "}
                      {apartment.basePricePerNight.toFixed(2)} PLN
                    </p>
                  </div>

                  {apartment.images.length === 0 ? (
                    <p className="inline-meta">Ten apartament nie ma jeszcze zdjec.</p>
                  ) : (
                    <div className="public-gallery-thumbnails">
                      {apartment.images.map((image, imageIndex) => (
                        <a
                          href={`#photo-${image.id}`}
                          key={image.id}
                          className="public-gallery-thumb"
                        >
                          <img
                            alt={image.altText ?? apartment.name}
                            src={image.imageUrl}
                          />
                          {imageIndex === 0 || image.isCover ? <span>Podglad</span> : null}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>

            {apartmentImages.map((image) => (
              <div className="photo-lightbox" id={`photo-${image.id}`} key={`lightbox-${image.id}`}>
                <a className="photo-lightbox-backdrop" href="#" aria-label="Zamknij podglad" />
                <figure className="photo-lightbox-panel">
                  <img alt={image.altText ?? "Zdjecie apartamentu"} src={image.imageUrl} />
                  <figcaption>{image.altText ?? "Zdjecie apartamentu"}</figcaption>
                  <a className="photo-lightbox-close" href="#">
                    Zamknij
                  </a>
                </figure>
              </div>
            ))}

            <form action={createPublicReservationAction} className="admin-form">
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>Apartament</span>
                  <select name="apartmentId" defaultValue={apartments[0]?.id} required>
                    {apartmentsForCalendar.map((apartment) => (
                      <option key={apartment.id} value={apartment.id}>
                        {apartment.name} | {apartment.ownerName ?? "brak wlasciciela"} | {apartment.city ?? "bez miasta"} | od {Number(apartment.basePricePerNight).toFixed(2)} PLN
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Przyjazd</span>
                  <input name="checkInDate" type="date" required />
                </label>

                <label className="admin-field">
                  <span>Wyjazd</span>
                  <input name="checkOutDate" type="date" required />
                </label>

                <label className="admin-field">
                  <span>Liczba gosci</span>
                  <input name="guestsCount" type="number" min="1" step="1" defaultValue="2" required />
                </label>

                <label className="admin-field">
                  <span>Imie</span>
                  <input name="firstName" type="text" required />
                </label>

                <label className="admin-field">
                  <span>Nazwisko</span>
                  <input name="lastName" type="text" required />
                </label>

                <label className="admin-field">
                  <span>E-mail</span>
                  <input name="email" type="email" required />
                </label>

                <label className="admin-field">
                  <span>Telefon</span>
                  <input name="phone" type="text" required />
                </label>

                <label className="admin-field">
                  <span>Kraj</span>
                  <input name="country" type="text" placeholder="Opcjonalnie" />
                </label>

                <label className="admin-field">
                  <span>Miasto</span>
                  <input name="city" type="text" placeholder="Opcjonalnie" />
                </label>
              </div>

              <label className="admin-field">
                <span>Uwagi do pobytu</span>
                <textarea
                  name="customerNotes"
                  rows={4}
                  placeholder="Np. planowany pozny przyjazd albo prosba o fakture."
                />
              </label>

              <div className="consent-stack">
                <label className="admin-toggle">
                  <input name="termsAccepted" type="checkbox" required />
                  <span>Akceptuje regulamin rezerwacji</span>
                </label>

                <label className="admin-toggle">
                  <input name="rodoAccepted" type="checkbox" required />
                  <span>Akceptuje zasady przetwarzania danych</span>
                </label>

                <label className="admin-toggle">
                  <input name="marketingConsent" type="checkbox" />
                  <span>Zgoda marketingowa jest opcjonalna</span>
                </label>
              </div>

              <div className="admin-form-actions">
                <button className="cta-button" type="submit">
                  Przejdz do platnosci
                </button>
                <p className="admin-form-note">
                  System sprawdzi dostepnosc i od razu sprobuje uruchomic platnosc online.
                </p>
              </div>
            </form>
          </>
        )}
      </section>

      <section className="info-card booking-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Kalendarz dostepnosci</p>
            <h2>Wolne i zajete terminy</h2>
          </div>
        </div>

        <p>
          Klient widzi tutaj wybrany miesiac i moze szybko sprawdzic, ktore dni
          sa juz zajete przez rezerwacje, blokady albo wydarzenia z Google
          Calendar.
        </p>

        <div className="calendar-toolbar">
          <Link className="calendar-nav-button" href={`/?month=${monthCalendar.previousMonthParam}`}>
            Poprzedni miesiac
          </Link>
          <span className="calendar-toolbar-label">{monthCalendar.monthLabel}</span>
          <Link className="calendar-nav-button" href={`/?month=${monthCalendar.nextMonthParam}`}>
            Nastepny miesiac
          </Link>
        </div>

        {apartmentsError ? (
          <div className="inline-notice inline-notice--danger">
            <p>{apartmentsError}</p>
          </div>
        ) : apartmentsForCalendar.length === 0 ? (
          <div className="inline-notice">
            <p>Dodaj aktywny apartament, aby pokazac kalendarz dostepnosci.</p>
          </div>
        ) : (
          <div className="admin-stack">
            {apartmentsForCalendar.map((apartment) => {
              const occupancyByDate = new Map(
                apartment.occupancyDates.map((item) => [item.date, item]),
              );

              return (
                <article className="calendar-card" key={`public-calendar-${apartment.id}`}>
                  <div className="calendar-card-header">
                    <div>
                      <h3>{apartment.name}</h3>
                      <p>{apartment.city ?? "Miasto nieuzupelnione"}</p>
                      <p>Wlasciciel: {apartment.ownerName ?? "nieprzypisany"}</p>
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
                          title={
                            occupied
                              ? `${day.isoDate} | ${occupied.label}`
                              : `${day.isoDate} | Wolny termin`
                          }
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
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
