# Webhook Stripe

Ten dokument opisuje kluczowy etap potwierdzania platnosci Stripe.

Cel biznesowy:
- uznac rezerwacje za oplacona tylko po oficjalnym sygnale ze Stripe,
- zaktualizowac status platnosci i rezerwacji,
- zachowac bezpieczny i powtarzalny proces.

## Gdzie znajduje sie webhook

Endpoint:
- [route.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/app/api/webhooks/stripe/route.ts>)

Logika:
- [handle-stripe-webhook.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/payments/handle-stripe-webhook.ts>)

Adres:
- `POST /api/webhooks/stripe`

## Co robi webhook

1. odbiera surowy payload ze Stripe
2. pobiera naglowek `Stripe-Signature`
3. weryfikuje podpis webhooka przez `constructEvent`
4. rozpoznaje typ zdarzenia
5. aktualizuje dane w bazie

## Jakie zdarzenia obslugujemy

### `checkout.session.completed`

Co oznacza:
- checkout zostal zakonczony sukcesem

Efekt:
- `payments.status = PAID`
- `payments.paidAt` zostaje zapisane
- `reservations.status = CONFIRMED`
- `reservations.paymentStatus = PAID`
- `reservations.confirmedAt` zostaje zapisane

### `checkout.session.async_payment_succeeded`

Co oznacza:
- platnosc opozniona finalnie zakonczyla sie sukcesem

Efekt:
- taki sam jak wyzej

### `checkout.session.async_payment_failed`

Co oznacza:
- opozniona platnosc nie udala sie

Efekt:
- `payments.status = FAILED`
- `reservations.paymentStatus = FAILED`

### `checkout.session.expired`

Co oznacza:
- sesja Stripe wygasla

Efekt:
- `payments.status = EXPIRED`
- `reservations.status = EXPIRED`
- `reservations.paymentStatus = EXPIRED`

## Dlaczego to jest bezpieczne

Najwazniejsza zasada:
- nie ufamy samemu powrotowi klienta ze Stripe

To oznacza:
- klikniecie checkout nie potwierdza platnosci
- strona sukcesu nie potwierdza platnosci
- tylko webhook moze ustawic `PAID` i `CONFIRMED`

To jest zgodne z zaleceniami Stripe.

## Co trzeba ustawic w Stripe

W panelu Stripe trzeba dodac endpoint webhooka:
- `https://twoj-adres-online/api/webhooks/stripe`

Trzeba tez skopiowac:
- `STRIPE_WEBHOOK_SECRET`

## Wymagane zmienne srodowiskowe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `DATABASE_URL`
- `DIRECT_URL`

## Co bedzie kolejnym krokiem

Po tym etapie najbezpieczniej przejsc do:
1. integracji Google Calendar po potwierdzeniu platnosci
2. wysylki e-maila potwierdzajacego
3. strony sukcesu lub drobnego dopracowania UX
