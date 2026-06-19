type ReservationCreatedEmailTemplateInput = {
  guestFirstName: string;
  apartmentName: string;
  checkInDate: string;
  checkOutDate: string;
  nightsCount: number;
  guestsCount: number;
  amountToPayNow: number;
  totalAmount: number;
  currency: string;
  reservationNumber: string;
  paymentUrl: string | null;
  holdExpiresAt: string | null;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(amount);
}

export function buildReservationCreatedEmailTemplate(
  input: ReservationCreatedEmailTemplateInput,
) {
  const subject = `Rezerwacja ${input.reservationNumber} oczekuje na platnosc`;
  const paymentText = input.paymentUrl
    ? "Ponizej znajdziesz link do platnosci, aby potwierdzic pobyt."
    : "Link do platnosci nie jest jeszcze gotowy. Nasza obsluga skontaktuje sie z Toba osobno.";

  const holdText = input.holdExpiresAt
    ? `Termin jest wstepnie zablokowany do: ${input.holdExpiresAt}.`
    : "Termin jest chwilowo zarezerwowany do czasu oplacenia zamowienia.";

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; background:#fcf6ed; color:#2a2118; padding:32px;">
      <div style="max-width:680px; margin:0 auto; background:#fffaf2; border:1px solid rgba(120,88,56,0.14); border-radius:24px; padding:32px;">
        <p style="margin:0 0 12px; color:#8a5419; letter-spacing:0.18em; text-transform:uppercase; font-size:12px;">Rezerwacja przyjeta</p>
        <h1 style="margin:0 0 18px; font-size:36px; line-height:1.05;">Dziekujemy za zlozenie rezerwacji</h1>
        <p style="margin:0 0 18px; color:#6f6052; line-height:1.7;">
          Czesc ${input.guestFirstName}, Twoja rezerwacja zostala zapisana w systemie i oczekuje na platnosc.
        </p>

        <div style="margin-top:24px; padding:20px; background:#f6f1e8; border-radius:18px;">
          <p style="margin:0 0 10px;"><strong>Numer rezerwacji:</strong> ${input.reservationNumber}</p>
          <p style="margin:0 0 10px;"><strong>Apartament:</strong> ${input.apartmentName}</p>
          <p style="margin:0 0 10px;"><strong>Termin:</strong> ${input.checkInDate} - ${input.checkOutDate}</p>
          <p style="margin:0 0 10px;"><strong>Liczba nocy:</strong> ${input.nightsCount}</p>
          <p style="margin:0 0 10px;"><strong>Liczba gosci:</strong> ${input.guestsCount}</p>
          <p style="margin:0 0 10px;"><strong>Kwota calkowita:</strong> ${formatMoney(input.totalAmount, input.currency)}</p>
          <p style="margin:0;"><strong>Do zaplaty teraz:</strong> ${formatMoney(input.amountToPayNow, input.currency)}</p>
        </div>

        <p style="margin:24px 0 0; color:#6f6052; line-height:1.7;">
          ${holdText}
        </p>
        <p style="margin:16px 0 0; color:#6f6052; line-height:1.7;">
          ${paymentText}
        </p>
        ${
          input.paymentUrl
            ? `<p style="margin:18px 0 0;"><a href="${input.paymentUrl}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#8a5419; color:#fffaf2; text-decoration:none; font-weight:700;">Przejdz do platnosci</a></p>`
            : ""
        }
      </div>
    </div>
  `;

  const text = [
    "Rezerwacja przyjeta",
    "",
    `Czesc ${input.guestFirstName}, Twoja rezerwacja zostala zapisana w systemie i oczekuje na platnosc.`,
    `Numer rezerwacji: ${input.reservationNumber}`,
    `Apartament: ${input.apartmentName}`,
    `Termin: ${input.checkInDate} - ${input.checkOutDate}`,
    `Liczba nocy: ${input.nightsCount}`,
    `Liczba gosci: ${input.guestsCount}`,
    `Kwota calkowita: ${formatMoney(input.totalAmount, input.currency)}`,
    `Do zaplaty teraz: ${formatMoney(input.amountToPayNow, input.currency)}`,
    holdText,
    paymentText,
    ...(input.paymentUrl ? [`Link do platnosci: ${input.paymentUrl}`] : []),
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
