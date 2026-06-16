import { APP_VERSION } from "@/lib/app-version";

const nextSteps = [
  "Dodac modele danych i schemat bazy Prisma.",
  "Zaimplementowac logike dostepnosci terminow.",
  "Przygotowac tworzenie rezerwacji i platnosci.",
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">MVP start</p>
        <p className="version-chip">Wersja {APP_VERSION}</p>
        <h1>System rezerwacji apartamentu</h1>
        <p className="lead">
          Projekt zostal przygotowany jako fundament pod rezerwacje online,
          platnosci, Google Calendar oraz panel administratora.
        </p>
      </section>

      <section className="content-grid">
        <article className="info-card">
          <h2>Co jest gotowe</h2>
          <p>
            Szkielet projektu zawiera juz widoki publiczne, panel admina,
            podstawowe API oraz katalogi na logike biznesowa i integracje.
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
    </main>
  );
}
