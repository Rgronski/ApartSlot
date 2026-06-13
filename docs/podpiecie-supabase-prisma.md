# Podpiecie logiki do Supabase i Prisma

Ten dokument opisuje, jak logika rezerwacji zostala podlaczona do prawdziwej
warstwy danych.

Cel biznesowy:
- zapisac rezerwacje i platnosc w bazie `Supabase`,
- nie polegac juz tylko na danych "w pamieci",
- przygotowac projekt pod dalsze kroki: API, Stripe i panel admina.

## Co zostalo dodane

Glowne pliki:
- [prisma.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/lib/db/prisma.ts>)
- [create-online-reservation-with-prisma.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/reservations/create-online-reservation-with-prisma.ts>)

Dodatkowo:
- skrypty Prisma w [package.json](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/package.json>)
- przykladowe polaczenia w [.env.example](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/.env.example>)

## Jak dziala zapis do bazy

Nowa usluga robi wszystko w jednej transakcji.

To oznacza:
- pobiera apartament z bazy
- pobiera aktywne reguly cenowe
- sprawdza nachodzace rezerwacje
- sprawdza reczne blokady
- znajduje istniejacego goscia
- buduje szkic rezerwacji i platnosci
- zapisuje goscia, rezerwacje i platnosc

Dzieje sie to w jednym kontrolowanym procesie.

## Dlaczego to wazne

Transakcja to bezpieczny "pakiet operacji".

W praktyce:
- albo zapisze sie wszystko,
- albo nie zapisze sie nic.

To jest bardzo wazne przy rezerwacjach i platnosciach, bo nie chcemy sytuacji:
- jest rezerwacja bez platnosci,
- jest platnosc bez rezerwacji,
- albo termin zostal zablokowany tylko czesciowo.

## Jakie dane trafiaja do bazy

Do `guests`:
- dane klienta
- zaktualizowane zgody

Do `reservations`:
- termin pobytu
- liczba nocy
- liczba gosci
- status `PENDING_PAYMENT`
- kwoty i blokada czasowa

Do `payments`:
- status `CREATED`
- token platnosci
- link do platnosci
- data wygasniecia linku

## Uwaga o Supabase i Vercel

Przy `Vercel` trzeba uwazac na polaczenie do bazy.

Z aktualnej dokumentacji Supabase wynika:
- `Vercel` jest srodowiskiem IPv4-only
- bez dodatku IPv4 nie nalezy tam polegac na bezposrednim polaczeniu IPv6
- dla serwerless najlepiej uzyc poolera `Supavisor` w trybie transakcyjnym

Dlatego w `.env.example` sa 2 adresy:
- `DATABASE_URL` - pod aplikacje
- `DIRECT_URL` - pod narzedzia i migracje

## Czego jeszcze nie ma

Na tym etapie nadal nie ma jeszcze:
- endpointu API
- zapisu do Google Calendar
- webhooka Stripe
- wysylki e-maili

To jest celowe. Najpierw zapis do bazy, potem integracje.

## Co bedzie kolejnym krokiem

Po tym etapie najbezpieczniej przejsc do:
1. przygotowania endpointu API
2. podpiecia strony formularza rezerwacji
3. przygotowania strony `/pay/[token]`
