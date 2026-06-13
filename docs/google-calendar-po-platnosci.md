# Google Calendar po potwierdzeniu platnosci

Ten dokument opisuje, jak rezerwacja trafia do Google Calendar po potwierdzonej platnosci Stripe.

Cel biznesowy:
- pokazac potwierdzone rezerwacje w kalendarzu operacyjnym,
- nie uzalezniac glownej logiki od dostepnosci Google,
- zachowac bezpieczne dane w bazie nawet przy problemie z integracja.

## Co zostalo dodane

Pliki:
- [client.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/integrations/google-calendar/client.ts>)
- [sync-confirmed-reservation-to-google-calendar.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/calendar/sync-confirmed-reservation-to-google-calendar.ts>)
- [index.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/calendar/index.ts>)

Webhook Stripe zostal tez rozszerzony o wywolanie tej synchronizacji:
- [handle-stripe-webhook.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/payments/handle-stripe-webhook.ts>)

## Jak dziala flow

1. Stripe wysyla webhook o potwierdzonej platnosci
2. aplikacja zmienia status platnosci i rezerwacji w bazie
3. dopiero po poprawnym zapisie do bazy uruchamia synchronizacje z Google Calendar
4. aplikacja tworzy albo aktualizuje wydarzenie
5. zapisuje `calendarEventId` w rezerwacji

## Najwazniejsza zasada

Google Calendar nie jest glowna baza danych.

To oznacza:
- najpierw zapisujemy prawde biznesowa w bazie
- dopiero potem probujemy zaktualizowac kalendarz
- jesli Google nie odpowie, rezerwacja i platnosc nadal pozostaja poprawne

## Jakie dane trafiaja do wydarzenia

Tytul:
- `[POTWIERDZONA] Imie Nazwisko | liczba nocy | kwota`

Opis:
- ID rezerwacji
- numer rezerwacji
- dane klienta
- telefon
- e-mail
- liczba gosci
- termin pobytu
- kwota
- status platnosci
- zrodlo rezerwacji

## Jakie zmienne srodowiskowe sa potrzebne

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_FALLBACK_ID`

## Jak to najlepiej ustawic

Najprostszy i najbezpieczniejszy wariant:
1. utworz kalendarz na koncie `apartslot@gmail.com`
2. utworz konto serwisowe w Google Cloud
3. udostepnij kalendarz temu kontu serwisowemu
4. wpisz dane konta serwisowego do zmiennych srodowiskowych

To jest wygodniejsze i bezpieczniejsze niz trzymanie logowania "na prywatnym koncie" w kodzie.

## Co bedzie kolejnym krokiem

Po tym etapie najbezpieczniej przejsc do:
1. wysylki e-maila potwierdzajacego
2. dodania recznych blokad i aktualizacji kalendarza z panelu admina
3. dopracowania konfiguracji Google krok po kroku
