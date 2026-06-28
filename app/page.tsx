import Link from "next/link";

import { APP_VERSION } from "@/lib/app-version";
import { prisma } from "@/lib/db/prisma";
import { getApartmentImages } from "@/services/admin/apartment-images";

export const dynamic = "force-dynamic";

const platformBenefits = [
  {
    title: "Rezerwacje bezposrednie",
    text: "Klient moze wybrac apartament, termin i przejsc do platnosci bez proszenia o link.",
  },
  {
    title: "Kalendarz i blokady",
    text: "Wlasciciel widzi dostepnosc, rezerwacje, blokady reczne i synchronizacje z Google Calendar.",
  },
  {
    title: "Platnosci online",
    text: "ApartSlot jest przygotowany pod platnosci Mollie, linki platnosci i szybka obsluge zamowien.",
  },
  {
    title: "Wiele apartamentow",
    text: "System rozroznia wlascicieli i apartamenty, wiec moze rosnac razem z firma.",
  },
];

const workflowSteps = [
  "Dodajesz apartamenty, zdjecia, ceny i terminy.",
  "Klient rezerwuje pobyt przez formularz online.",
  "System zapisuje rezerwacje, platnosc i dostepnosc w jednym miejscu.",
];

export default async function LandingPage() {
  let apartments:
    | Array<{
        id: string;
        name: string;
        city: string | null;
        owner: {
          name: string;
        } | null;
        basePricePerNight: unknown;
      }>
    | [] = [];
  let apartmentImages: Awaited<ReturnType<typeof getApartmentImages>> = [];

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
          },
        },
        basePricePerNight: true,
      },
    });
  } catch (error) {
    console.error("Landing apartments load failed", error);
  }

  try {
    apartmentImages = await getApartmentImages();
  } catch (error) {
    console.error("Landing apartment images load failed", error);
  }

  const imagesByApartmentId = new Map<string, typeof apartmentImages>();

  for (const image of apartmentImages) {
    const current = imagesByApartmentId.get(image.apartmentId) ?? [];
    current.push(image);
    imagesByApartmentId.set(image.apartmentId, current);
  }

  const carouselApartments = apartments.map((apartment) => ({
    ...apartment,
    images: imagesByApartmentId.get(apartment.id) ?? [],
    basePricePerNight: Number(apartment.basePricePerNight),
  }));

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Menu strony ApartSlot">
        <Link className="landing-brand" href="/">
          ApartSlot
        </Link>
        <div className="landing-nav-actions">
          <Link href="/rezerwacja">Rezerwacja demo</Link>
          <Link className="landing-login-link" href="/admin">
            Zaloguj sie
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">System dla najmu krotkoterminowego</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
          <h1>ApartSlot porzadkuje rezerwacje, platnosci i kalendarze apartamentow.</h1>
          <p className="lead">
            Prosta aplikacja dla wlascicieli i firm, ktore wynajmuja apartamenty
            krotkoterminowo. W jednym miejscu obslugujesz lokale, dostepnosc,
            zdjecia, rezerwacje i platnosci.
          </p>
          <div className="landing-actions">
            <Link className="cta-button landing-primary-cta" href="/admin">
              Zaloguj sie do panelu
            </Link>
            <Link className="cta-button" href="/rezerwacja">
              Zobacz rezerwacje demo
            </Link>
          </div>
        </div>

        <div className="landing-hero-panel">
          <p className="landing-panel-label">Dla wlasciciela</p>
          <h2>Od pierwszego apartamentu do malej sieci obiektow.</h2>
          <ul>
            <li>Kalendarz wolnych i zajetych terminow</li>
            <li>Zdjecia i dane apartamentow</li>
            <li>Linki platnosci i statusy rezerwacji</li>
            <li>Podzial po wlascicielach lub firmach</li>
          </ul>
        </div>
      </section>

      <section className="landing-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Apartamenty</p>
            <h2>Przykladowe obiekty w ApartSlot</h2>
          </div>
          <p className="landing-section-note">
            Karuzela korzysta ze zdjec dodanych w panelu admina.
          </p>
        </div>

        {carouselApartments.length === 0 ? (
          <div className="inline-notice">
            <p>Po dodaniu aktywnych apartamentow pojawi sie tutaj karuzela obiektow.</p>
          </div>
        ) : (
          <div className="landing-carousel" aria-label="Karuzela apartamentow">
            {carouselApartments.map((apartment) => {
              const coverImage = apartment.images.find((image) => image.isCover) ?? apartment.images[0];

              return (
                <article className="landing-apartment-card" key={apartment.id}>
                  {coverImage ? (
                    <img
                      alt={coverImage.altText ?? apartment.name}
                      src={coverImage.imageUrl}
                    />
                  ) : (
                    <div className="landing-apartment-placeholder">
                      <span>{apartment.name}</span>
                    </div>
                  )}
                  <div className="landing-apartment-body">
                    <p className="landing-panel-label">{apartment.city ?? "Lokalizacja"}</p>
                    <h3>{apartment.name}</h3>
                    <p>{apartment.owner?.name ?? "Wlasciciel nieprzypisany"}</p>
                    <strong>od {apartment.basePricePerNight.toFixed(2)} PLN / noc</strong>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="landing-section landing-benefits">
        {platformBenefits.map((benefit) => (
          <article className="landing-benefit-card" key={benefit.title}>
            <h3>{benefit.title}</h3>
            <p>{benefit.text}</p>
          </article>
        ))}
      </section>

      <section className="landing-section landing-split">
        <div>
          <p className="eyebrow">Jak to dziala</p>
          <h2>Wlasciciel zarzadza, klient rezerwuje, system pilnuje porzadku.</h2>
        </div>
        <ol>
          {workflowSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="landing-section landing-final-cta">
        <div>
          <p className="eyebrow">ApartSlot.pl</p>
          <h2>Docelowo tutaj bedzie wejscie dla wlascicieli apartamentow i firm.</h2>
          <p>
            Po zalogowaniu kazdy wlasciciel zobaczy swoje apartamenty, zdjecia,
            rezerwacje, platnosci i ustawienia.
          </p>
        </div>
        <Link className="cta-button landing-primary-cta" href="/admin">
          Przejdz do logowania
        </Link>
      </section>
    </main>
  );
}
