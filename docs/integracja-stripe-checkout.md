# Integracja Stripe Checkout

Ten dokument opisuje pierwszy etap prawdziwej integracji Stripe Checkout.

Cel biznesowy:
- przekierowac klienta z linku platnosci do bezpiecznej strony Stripe,
- zapisac ID sesji checkout w bazie,
- zaktualizowac status platnosci na `PENDING`,
- przygotowac grunt pod webhook potwierdzajacy platnosc.

## Co zostalo dodane

Glowne pliki:
- [create-stripe-checkout-session.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/payments/create-stripe-checkout-session.ts>)
- [route.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/app/pay/%5Btoken%5D/checkout/route.ts>)

Zmiany pomocnicze:
- [page.tsx](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/app/pay/%5Btoken%5D/page.tsx>)
- [globals.css](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/app/globals.css>)
- [.env.example](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/.env.example>)

## Jak dziala flow

1. klient otwiera `/pay/[token]`
2. klika przycisk `Zaplac teraz w Stripe`
3. formularz wysyla `POST` na `/pay/[token]/checkout`
4. serwer tworzy `Checkout Session` w Stripe
5. sesja checkout jest zapisywana w bazie jako `providerPaymentId`
6. status platnosci zmienia sie na `PENDING`
7. klient jest przekierowany na strone Stripe

## Co zapisujemy w Stripe

Do sesji checkout trafiaja miedzy innymi:
- e-mail klienta
- numer rezerwacji jako `client_reference_id`
- metadata z `paymentId`, `reservationId`, `paymentToken`
- kwota do zaplaty teraz

To pozniej bardzo pomaga przy webhooku i rozliczaniu platnosci.

## Co zapisujemy w naszej bazie

Po utworzeniu sesji checkout:
- `payments.providerPaymentId` = ID sesji Stripe
- `payments.paymentUrl` = URL Stripe Checkout
- `payments.status` = `PENDING`
- `reservations.paymentStatus` = `PENDING`

## Co jeszcze nie jest skonczone

To bardzo wazne:
- klient moze wejsc do Stripe Checkout
- ale rezerwacja nadal nie staje sie `CONFIRMED`

Potwierdzenie rezerwacji bedzie dopiero po:
- webhooku Stripe
- zweryfikowaniu, ze platnosc jest naprawde oplacona

## Dlaczego to jest bezpieczne

Nie ufamy samemu powrotowi klienta ze Stripe.

To oznacza:
- samo klikniecie checkout nie potwierdza rezerwacji
- sam powrot na strone sukcesu tez nie potwierdza rezerwacji
- dopiero webhook bedzie mogl ustawic `PAID` i `CONFIRMED`

To jest zgodne z zalecanym podejsciem Stripe Checkout.

## Wymagane zmienne srodowiskowe

- `APP_BASE_URL`
- `STRIPE_SECRET_KEY`
- `DATABASE_URL`
- `DIRECT_URL`

## Co bedzie kolejnym krokiem

Po tym etapie najbezpieczniej przejsc do:
1. webhooka Stripe
2. aktualizacji `Payment.status` i `Reservation.status`
3. wysylki e-maila potwierdzajacego
