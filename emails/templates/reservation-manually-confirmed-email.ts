type ReservationManuallyConfirmedEmailTemplateInput = {
  guestFirstName: string;
  apartmentName: string;
  checkInDate: string;
  checkOutDate: string;
  nightsCount: number;
  guestsCount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  reservationNumber: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(amount);
}

export function buildReservationManuallyConfirmedEmailTemplate(
  input: ReservationManuallyConfirmedEmailTemplateInput,
) {
  const remainingAmount = Math.max(input.totalAmount - input.paidAmount, 0);
  const subject = `Rezerwacja ${input.reservationNumber} zostala potwierdzona`;

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; background:#fcf6ed; color:#2a2118; padding:32px;">
      <div style="max-width:680px; margin:0 auto; background:#fffaf2; border:1px solid rgba(120,88,56,0.14); border-radius:24px; padding:32px;">
        <p style="margin:0 0 12px; color:#8a5419; letter-spacing:0.18em; text-transform:uppercase; font-size:12px;">Rezerwacja potwierdzona przez obsluge</p>
        <h1 style="margin:0 0 18px; font-size:36px; line-height:1.05;">Twoj pobyt zostal potwierdzony</h1>
        <p style="margin:0 0 18px; color:#6f6052; line-height:1.7;">
          Czesc ${input.guestFirstName}, potwierdzilismy recznie Twoja rezerwacje w systemie.
        </p>

        <div style="margin-top:24px; padding:20px; background:#f6f1e8; border-radius:18px;">
          <p style="margin:0 0 10px;"><strong>Numer rezerwacji:</strong> ${input.reservationNumber}</p>
          <p style="margin:0 0 10px;"><strong>Apartament:</strong> ${input.apartmentName}</p>
          <p style="margin:0 0 10px;"><strong>Termin:</strong> ${input.checkInDate} - ${input.checkOutDate}</p>
          <p style="margin:0 0 10px;"><strong>Liczba nocy:</strong> ${input.nightsCount}</p>
          <p style="margin:0 0 10px;"><strong>Liczba gosci:</strong> ${input.guestsCount}</p>
          <p style="margin:0 0 10px;"><strong>Kwota calkowita:</strong> ${formatMoney(input.totalAmount, input.currency)}</p>
          <p style="margin:0 0 10px;"><strong>Oplacono do tej pory:</strong> ${formatMoney(input.paidAmount, input.currency)}</p>
          <p style="margin:0;"><strong>Pozostalo do rozliczenia:</strong> ${formatMoney(remainingAmount, input.currency)}</p>
        </div>

        <p style="margin:24px 0 0; color:#6f6052; line-height:1.7;">
          To potwierdzenie oznacza, ze termin zostal zaakceptowany przez obsluge. Jesli platnosc nie zostala jeszcze uregulowana, skontaktujemy sie z Toba w sprawie dalszego rozliczenia.
        </p>
      </div>
    </div>
  `;

  const text = [
    "Rezerwacja potwierdzona przez obsluge",
    "",
    `Czesc ${input.guestFirstName}, potwierdzilismy recznie Twoja rezerwacje w systemie.`,
    `Numer rezerwacji: ${input.reservationNumber}`,
    `Apartament: ${input.apartmentName}`,
    `Termin: ${input.checkInDate} - ${input.checkOutDate}`,
    `Liczba nocy: ${input.nightsCount}`,
    `Liczba gosci: ${input.guestsCount}`,
    `Kwota calkowita: ${formatMoney(input.totalAmount, input.currency)}`,
    `Oplacono do tej pory: ${formatMoney(input.paidAmount, input.currency)}`,
    `Pozostalo do rozliczenia: ${formatMoney(remainingAmount, input.currency)}`,
    "To potwierdzenie oznacza, ze termin zostal zaakceptowany przez obsluge. Jesli platnosc nie zostala jeszcze uregulowana, skontaktujemy sie z Toba w sprawie dalszego rozliczenia.",
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
