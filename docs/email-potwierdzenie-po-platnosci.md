# E-mail potwierdzajacy po platnosci

Ten dokument opisuje automatyczna wysylke wiadomosci po potwierdzonej platnosci.

Cel biznesowy:
- poinformowac klienta, ze rezerwacja jest potwierdzona,
- zapisac historie wysylki w bazie,
- miec mozliwosc sprawdzenia, czy wiadomosc zostala wyslana.

## Co zostalo dodane

Pliki:
- [client.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/integrations/resend/client.ts>)
- [reservation-confirmed-email.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/emails/templates/reservation-confirmed-email.ts>)
- [send-reservation-confirmed-email.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/email/send-reservation-confirmed-email.ts>)

Webhook Stripe zostal rozszerzony o wywolanie wysylki:
- [handle-stripe-webhook.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/payments/handle-stripe-webhook.ts>)

## Jak dziala flow

1. Stripe potwierdza platnosc webhookiem
2. aplikacja oznacza rezerwacje jako `CONFIRMED`
3. aplikacja synchronizuje Google Calendar
4. aplikacja probuje wyslac e-mail potwierdzajacy przez Resend
5. zapisuje wynik do `email_logs`

## Co zapisujemy w email_logs

Przy kazdej probie:
- typ wiadomosci
- odbiorce
- temat
- status `PENDING`, `SENT` albo `FAILED`
- providerMessageId od Resend
- date wysylki
- ewentualny blad

## Najwazniejsza zasada

Wysylka e-maila nie moze cofnac rezerwacji.

To oznacza:
- jesli Resend chwilowo nie zadziala
- rezerwacja nadal pozostaje potwierdzona
- problem zapisujemy do logow i mozna go pozniej ponowic recznie

## Jakie dane dostaje klient

Wiadomosc zawiera:
- numer rezerwacji
- nazwe apartamentu
- termin pobytu
- liczbe nocy
- liczbe gosci
- kwote calkowita
- kwote potwierdzonej platnosci

## Jakie zmienne srodowiskowe sa potrzebne

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Co bedzie kolejnym krokiem

Po tym etapie najbezpieczniej przejsc do:
1. instrukcji konfiguracji Resend krok po kroku
2. panelu admina z podgladem logow e-mail
3. dodatkowych typow e-maili, np. link do platnosci i przypomnienie przed przyjazdem
