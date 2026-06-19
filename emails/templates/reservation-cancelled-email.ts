type ReservationCancelledEmailTemplateInput = {
  guestFirstName: string;
  apartmentName: string;
  checkInDate: string;
  checkOutDate: string;
  reservationNumber: string;
  cancellationReason: string;
  paidAmount: number;
  currency: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(amount);
}

export function buildReservationCancelledEmailTemplate(
  input: ReservationCancelledEmailTemplateInput,
) {
  const subject = `Anulowanie rezerwacji ${input.reservationNumber}`;
  const paymentInfo =
    input.paidAmount > 0
      ? `Zarejestrowana wplata: ${formatMoney(input.paidAmount, input.currency)}. W sprawie rozliczenia skontaktujemy sie osobno.`
      : "Do tej rezerwacji nie mamy zapisanej oplaconej kwoty.";

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; background:#fcf6ed; color:#2a2118; padding:32px;">
      <div style="max-width:680px; margin:0 auto; background:#fffaf2; border:1px solid rgba(120,88,56,0.14); border-radius:24px; padding:32px;">
        <p style="margin:0 0 12px; color:#8a5419; letter-spacing:0.18em; text-transform:uppercase; font-size:12px;">Rezerwacja anulowana</p>
        <h1 style="margin:0 0 18px; font-size:36px; line-height:1.05;">Twoja rezerwacja zostala anulowana</h1>
        <p style="margin:0 0 18px; color:#6f6052; line-height:1.7;">
          Czesc ${input.guestFirstName}, przesylamy potwierdzenie anulowania rezerwacji.
        </p>

        <div style="margin-top:24px; padding:20px; background:#f6f1e8; border-radius:18px;">
          <p style="margin:0 0 10px;"><strong>Numer rezerwacji:</strong> ${input.reservationNumber}</p>
          <p style="margin:0 0 10px;"><strong>Apartament:</strong> ${input.apartmentName}</p>
          <p style="margin:0 0 10px;"><strong>Termin:</strong> ${input.checkInDate} - ${input.checkOutDate}</p>
          <p style="margin:0;"><strong>Powod anulowania:</strong> ${input.cancellationReason}</p>
        </div>

        <p style="margin:24px 0 0; color:#6f6052; line-height:1.7;">
          ${paymentInfo}
        </p>
      </div>
    </div>
  `;

  const text = [
    "Rezerwacja anulowana",
    "",
    `Czesc ${input.guestFirstName}, przesylamy potwierdzenie anulowania rezerwacji.`,
    `Numer rezerwacji: ${input.reservationNumber}`,
    `Apartament: ${input.apartmentName}`,
    `Termin: ${input.checkInDate} - ${input.checkOutDate}`,
    `Powod anulowania: ${input.cancellationReason}`,
    paymentInfo,
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}
