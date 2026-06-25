import Link from "next/link";

import { getPaymentPageData } from "@/services/payments";

type PaymentPageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    checkout?: string;
    mollie_payment_id?: string;
  };
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) {
    return "brak";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

function getHeadingForState(state: ReturnType<typeof getStateMeta>["state"]) {
  switch (state) {
    case "active":
      return "Platnosc gotowa do wykonania";
    case "expired":
      return "Link do platnosci wygasl";
    case "paid":
      return "Rezerwacja jest juz oplacona";
    case "cancelled":
      return "Rezerwacja zostala anulowana";
    case "failed":
      return "Platnosc nie powiodla sie";
    case "not_found":
      return "Nie znaleziono linku platnosci";
  }
}

function getDescriptionForState(
  state: ReturnType<typeof getStateMeta>["state"],
) {
  switch (state) {
    case "active":
      return "Link jest aktywny i moze przekierowac klienta do bezpiecznej platnosci online.";
    case "expired":
      return "Blokada terminu lub link do platnosci juz wygasl. Skontaktuj sie z obsluga, aby przygotowac nowy link.";
    case "paid":
      return "Ta rezerwacja ma juz potwierdzona platnosc. Nie trzeba wykonywac kolejnej platnosci.";
    case "cancelled":
      return "Ta rezerwacja zostala anulowana i nie mozna jej juz oplacic.";
    case "failed":
      return "Ostatnia proba platnosci zakonczyla sie niepowodzeniem. Jesli link nadal jest wazny, klient moze sprobowac ponownie.";
    case "not_found":
      return "Podany link nie istnieje albo token jest niepoprawny.";
  }
}

function getCheckoutNotice(checkout: string | undefined) {
  switch (checkout) {
    case "success":
      return "Operator platnosci przekierowal klienta z powrotem na strone. Czekamy jeszcze na oficjalne potwierdzenie platnosci.";
    case "cancelled":
      return "Klient anulowal lub przerwal platnosc i wrocil na strone platnosci.";
    case "expired":
      return "Checkout nie zostal uruchomiony, bo link platnosci juz wygasl.";
    case "paid":
      return "Checkout nie zostal uruchomiony, bo ta rezerwacja jest juz oplacona.";
    case "not_found":
      return "Checkout nie zostal uruchomiony, bo nie znaleziono platnosci dla tego tokenu.";
    case "error":
      return "Nie udalo sie uruchomic platnosci online. Sprobuj ponownie albo skontaktuj sie z obsluga.";
    case "mollie_not_configured":
      return "Platnosci Mollie nie sa jeszcze w pelni skonfigurowane w aplikacji. Skontaktuj sie z obsluga.";
    case "app_url_missing":
      return "Aplikacja nie ma jeszcze kompletnego adresu potrzebnego do uruchomienia platnosci.";
    default:
      return null;
  }
}

function getStateMeta(
  state: Awaited<ReturnType<typeof getPaymentPageData>>["state"],
) {
  const tone =
    state === "active"
      ? "success"
      : state === "paid"
        ? "success"
        : state === "failed"
          ? "warning"
          : "danger";

  return {
    state,
    tone,
  } as const;
}

export default async function PaymentPage({
  params,
  searchParams,
}: PaymentPageProps) {
  const paymentPageData = await getPaymentPageData(params.token);
  const stateMeta = getStateMeta(paymentPageData.state);
  const checkoutNotice = getCheckoutNotice(searchParams?.checkout);

  return (
    <main className="payment-shell">
      <section className="payment-card">
        <p className="eyebrow">Platnosc rezerwacji</p>
        <div className={`status-badge status-badge--${stateMeta.tone}`}>
          {paymentPageData.state.toUpperCase()}
        </div>
        <h1>{getHeadingForState(stateMeta.state)}</h1>
        <p>{getDescriptionForState(stateMeta.state)}</p>
        {checkoutNotice ? (
          <div className="inline-notice">
            <p>{checkoutNotice}</p>
          </div>
        ) : null}
      </section>

      <section className="payment-grid">
        <article className="payment-card">
          <h2>Podsumowanie pobytu</h2>
          {paymentPageData.state === "not_found" ? (
            <p>Nie udalo sie pobrac danych rezerwacji dla tego tokenu.</p>
          ) : (
            <ul className="detail-list">
              <li>
                <strong>Numer rezerwacji:</strong>{" "}
                {paymentPageData.reservationNumber}
              </li>
              <li>
                <strong>Apartament:</strong> {paymentPageData.apartmentName}
                {paymentPageData.apartmentCity
                  ? `, ${paymentPageData.apartmentCity}`
                  : ""}
              </li>
              <li>
                <strong>Termin:</strong> {paymentPageData.stayLabel}
              </li>
              <li>
                <strong>Liczba nocy:</strong> {paymentPageData.nightsCount}
              </li>
              <li>
                <strong>Liczba gosci:</strong> {paymentPageData.guestsCount}
              </li>
              <li>
                <strong>Klient:</strong> {paymentPageData.guestFirstName}{" "}
                {paymentPageData.guestLastName}
              </li>
            </ul>
          )}
        </article>

        <article className="payment-card">
          <h2>Platnosc</h2>
          {paymentPageData.state === "not_found" ? (
            <p>Brak danych platnosci do pokazania.</p>
          ) : (
            <ul className="detail-list">
              <li>
                <strong>Kwota calkowita:</strong>{" "}
                {formatMoney(
                  paymentPageData.totalAmount ?? 0,
                  paymentPageData.currency ?? "PLN",
                )}
              </li>
              <li>
                <strong>Do zaplaty teraz:</strong>{" "}
                {formatMoney(
                  paymentPageData.amountToPayNow ?? 0,
                  paymentPageData.currency ?? "PLN",
                )}
              </li>
              <li>
                <strong>Zaplacono:</strong>{" "}
                {formatMoney(
                  paymentPageData.paidAmount ?? 0,
                  paymentPageData.currency ?? "PLN",
                )}
              </li>
              <li>
                <strong>Status platnosci:</strong> {paymentPageData.paymentStatus}
              </li>
              <li>
                <strong>Status rezerwacji:</strong>{" "}
                {paymentPageData.reservationStatus}
              </li>
              <li>
                <strong>Waznosc linku:</strong>{" "}
                {formatDateTime(paymentPageData.paymentExpiresAt)}
              </li>
            </ul>
          )}
        </article>
      </section>

      <section className="payment-grid">
        <article className="payment-card">
          <h2>Kontakt</h2>
          {paymentPageData.state === "not_found" ? (
            <p>Jesli link mial dzialac, wyslij go ponownie do obslugi.</p>
          ) : (
            <ul className="detail-list">
              <li>
                <strong>E-mail klienta:</strong> {paymentPageData.customerEmail}
              </li>
              <li>
                <strong>Telefon klienta:</strong> {paymentPageData.customerPhone}
              </li>
              <li>
                <strong>Token platnosci:</strong> {paymentPageData.paymentToken}
              </li>
            </ul>
          )}
        </article>

        <article className="payment-card">
          <h2>Nastepny krok</h2>
          {stateMeta.state === "active" && (
            <>
              <p>
                Klikniecie przycisku ponizej przekieruje klienta do bezpiecznej
                platnosci online. Rezerwacja nadal czeka na oficjalne
                potwierdzenie od operatora platnosci.
              </p>
              <div className="cta-card">
                <form method="post" action={`/pay/${params.token}/checkout`}>
                  <button className="cta-button" type="submit">
                    Zaplac online
                  </button>
                </form>
              </div>
            </>
          )}
          {stateMeta.state === "expired" && (
            <p>
              Trzeba wygenerowac nowy link platnosci albo utworzyc nowa
              rezerwacje.
            </p>
          )}
          {stateMeta.state === "paid" && (
            <p>
              Ta platnosc nie wymaga juz zadnego dalszego dzialania od klienta.
            </p>
          )}
          {stateMeta.state === "cancelled" && (
            <p>
              Jesli klient nadal chce przyjechac, trzeba przygotowac nowa
              rezerwacje.
            </p>
          )}
          {stateMeta.state === "failed" && (
            <p>
              Klient moze ponownie uruchomic platnosc online, jesli link nadal
              pozostaje wazny.
            </p>
          )}
          {stateMeta.state === "not_found" && (
            <p>
              Sprawdz, czy link zostal skopiowany poprawnie i czy token nie
              zostal uszkodzony.
            </p>
          )}
          {searchParams?.mollie_payment_id ? (
            <p className="session-meta">
              ID platnosci Mollie: <span>{searchParams.mollie_payment_id}</span>
            </p>
          ) : null}
          <p className="support-link">
            <Link href="/">Wroc do strony glownej</Link>
          </p>
        </article>
      </section>
    </main>
  );
}
