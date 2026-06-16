import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { APP_VERSION } from "@/lib/app-version";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";
import { createOnlineReservationWithPrisma } from "@/services/reservations";

const nextSteps = [
  "Zbieranie pierwszych prawdziwych rezerwacji online.",
  "Dalsze dopinanie blokad terminow i pracy operatora.",
  "Rozszerzenie panelu o kalendarz i podglad oblozenia.",
];

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
    status?: string;
    message?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const status = params?.status;
  const message = params?.message;

  let apartments:
    | Awaited<
        ReturnType<
          typeof prisma.apartment.findMany
        >
      >
    | [] = [];
  let apartmentsError: string | null = null;

  try {
    apartments = await prisma.apartment.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "asc",
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

  async function createPublicReservationAction(formData: FormData) {
    "use server";

    const appBaseUrl = resolveAppBaseUrl();

    if (!appBaseUrl) {
      redirect(
        `/?status=error&message=${encodeURIComponent("Brakuje adresu aplikacji do przekierowania na platnosc.")}`,
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
      redirect(result.paymentDraft.paymentUrl);
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie utworzyc rezerwacji. Sprobuj ponownie.";

      redirect(`/?status=error&message=${encodeURIComponent(errorMessage)}`);
    }
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
          razu do ekranu platnosci.
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
          <form action={createPublicReservationAction} className="admin-form">
            <div className="admin-form-grid">
              <label className="admin-field">
                <span>Apartament</span>
                <select name="apartmentId" defaultValue={apartments[0]?.id} required>
                  {apartments.map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>
                      {apartment.name} | {apartment.city ?? "bez miasta"} | od {Number(apartment.basePricePerNight).toFixed(2)} PLN
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
                System sprawdzi dostepnosc i od razu przygotuje link do platnosci.
              </p>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
