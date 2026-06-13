# Model bazy danych MVP

Ten dokument opisuje prostym jezykiem, jakie tabele sa potrzebne na start
oraz po co one istnieja.

Cel biznesowy:
- miec jedno pewne miejsce przechowywania danych,
- uniknac podwojnych rezerwacji,
- przygotowac projekt pod platnosci Stripe, e-maile i Google Calendar.

## Najwazniejsza zasada

Glownym zrodlem prawdy jest baza danych.

To oznacza:
- rezerwacja najpierw trafia do bazy,
- platnosc aktualizuje baze,
- Google Calendar tylko pokazuje i pomaga, ale nie decyduje samodzielnie.

## Jakie tabele wchodza do MVP

### 1. apartments

Po co jest:
- przechowuje dane apartamentu

Co trzyma:
- nazwe
- ceny bazowe
- oplaty dodatkowe
- limity gosci
- ID kalendarza Google

Dlaczego wazne:
- nawet jesli na start jest jeden apartament, od razu przygotowujemy system na wiecej

### 2. guests

Po co jest:
- przechowuje dane osoby rezerwujacej

Co trzyma:
- imie i nazwisko
- e-mail
- telefon
- zgody formalne

Dlaczego wazne:
- jeden gosc moze w przyszlosci miec wiecej niz jedna rezerwacje

### 3. reservations

Po co jest:
- to glowna tabela calej aplikacji

Co trzyma:
- terminy pobytu
- liczbe nocy
- liczbe gosci
- kwoty
- status rezerwacji
- status platnosci
- informacje o blokadzie terminu

Dlaczego wazne:
- to wlasnie na tej tabeli bedziemy sprawdzac, czy termin jest wolny

### 4. payments

Po co jest:
- przechowuje platnosci powiazane z rezerwacja

Co trzyma:
- token platnosci
- link do platnosci
- kwote
- status
- dane Stripe

Dlaczego wazne:
- rezerwacja moze miec wiecej niz jedna probe platnosci

### 5. pricing_rules

Po co jest:
- pozwala wprowadzac rozne ceny zalezne od terminu

Co trzyma:
- sezon
- weekend
- wydarzenie
- minimalna liczbe nocy
- priorytet reguly

Dlaczego wazne:
- bez tej tabeli kazda zmiana cen musialaby byc wpisywana recznie w kodzie
- mozna ustawic osobna cene np. na koncert, targi, festiwal albo dlugi weekend

### 6. calendar_blocks

Po co jest:
- zapisuje reczne blokady terminow

Przyklady:
- pobyt wlasciciela
- remont
- sprzatanie techniczne

Dlaczego wazne:
- nie wszystkie blokady wynikaja z rezerwacji klienta

### 7. email_logs

Po co jest:
- zapisuje historie wyslanych wiadomosci

Przyklady:
- link do platnosci
- potwierdzenie rezerwacji
- mail do administratora

Dlaczego wazne:
- latwo sprawdzic, czy mail zostal wyslany albo dlaczego nie doszedl

### 8. app_settings

Po co jest:
- trzyma ustawienia aplikacji bez potrzeby zmiany kodu

Przyklady:
- ile minut trwa blokada online
- jaki jest procent zaliczki
- jaki jest e-mail administratora

Dlaczego wazne:
- pozwala zarzadzac ustawieniami bardziej biznesowo niz technicznie

### 9. admin_users

Po co jest:
- przechowuje osoby, ktore beda korzystac z panelu admina

Dlaczego wazne:
- nawet jesli na start bedziesz korzystac tylko Ty, warto od razu zostawic miejsce na role i dostepy

## Najwazniejsze statusy

### Rezerwacja

- `PENDING_PAYMENT` - termin jest zablokowany i czeka na platnosc
- `CONFIRMED` - rezerwacja jest potwierdzona
- `CANCELLED` - rezerwacja anulowana
- `EXPIRED` - blokada wygasla bez platnosci

### Platnosc

- `CREATED` - platnosc zostala utworzona
- `LINK_SENT` - link zostal wyslany
- `PENDING` - klient rozpoczal platnosc
- `PAID` - Stripe potwierdzil platnosc
- `FAILED` - platnosc nieudana
- `EXPIRED` - link wygasl

## Co jest najwazniejsze dla logiki rezerwacji

Termin ma byc uznany za zajety, gdy:
- inna rezerwacja nachodzi na wybrany zakres
- i ma status blokujacy termin
- albo istnieje reczna blokada terminu

Statusy, ktore blokuja termin:
- `PENDING_PAYMENT`
- `CONFIRMED`
- `MANUAL_BLOCK`

Statusy, ktore nie blokuja terminu:
- `CANCELLED`
- `EXPIRED`

## Co zostalo juz zapisane w projekcie

Pelny schemat MVP znajduje sie tutaj:
- [schema.prisma](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/prisma/schema.prisma>)

## Co bedzie kolejnym krokiem

Po modelu danych najbezpieczniej przejsc do:
1. logiki sprawdzania dostepnosci terminow
2. logiki wyceny pobytu
3. tworzenia rezerwacji `PENDING_PAYMENT`
