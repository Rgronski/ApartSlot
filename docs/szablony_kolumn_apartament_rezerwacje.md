# Szablony kolumn i modeli danych - aplikacja rezerwacji apartamentu

## Zasady ogolne

Ten plik opisuje kolumny/tabele do wdrozenia w bazie danych aplikacji rezerwacji apartamentu.

Rekomendowana baza: PostgreSQL.
Rekomendowany ORM: Prisma.

Glowne zasady:
- baza danych jest glownym zrodlem prawdy,
- Google Calendar jest integracja pomocnicza,
- status rezerwacji i status platnosci sa osobnymi polami,
- aplikacja powinna byc gotowa na wiele apartamentow,
- kazda tabela powinna miec createdAt i updatedAt,
- daty rezerwacji przechowywac jako daty bez godziny, jezeli rozliczenie jest dobowe,
- checkOutDate nie liczy sie jako noc.

---

## ENUM: ReservationStatus

```text
DRAFT
PENDING_PAYMENT
CONFIRMED
CANCELLED
EXPIRED
MANUAL_BLOCK
COMPLETED
```

Opis:
- DRAFT - rozpoczecie procesu bez aktywnej blokady,
- PENDING_PAYMENT - termin zablokowany, oczekuje na platnosc,
- CONFIRMED - rezerwacja potwierdzona,
- CANCELLED - anulowana,
- EXPIRED - wygasla bez platnosci,
- MANUAL_BLOCK - blokada reczna,
- COMPLETED - pobyt zakonczony.

---

## ENUM: PaymentStatus

```text
CREATED
LINK_SENT
PENDING
PAID
FAILED
CANCELLED
EXPIRED
REFUNDED
```

Opis:
- CREATED - platnosc utworzona,
- LINK_SENT - link do platnosci wyslany,
- PENDING - klient rozpoczal platnosc,
- PAID - platnosc potwierdzona,
- FAILED - platnosc nieudana,
- CANCELLED - platnosc anulowana,
- EXPIRED - link/platnosc wygasla,
- REFUNDED - zwrocona.

---

## ENUM: ReservationSource

```text
WEBSITE
ADMIN
PHONE
EMAIL
MESSENGER
WHATSAPP
BOOKING
AIRBNB
MANUAL
OTHER
```

---

## ENUM: PaymentProvider

```text
MOLLIE
STRIPE
PRZELEWY24
PAYU
TPAY
MANUAL_TRANSFER
OTHER
```

---

## Tabela: apartments

Cel: przechowuje lokale/apartamenty dostepne do rezerwacji.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID apartamentu |
| name | String | tak | Nazwa apartamentu |
| slug | String | tak | Przyjazny adres URL |
| address | String | nie | Adres apartamentu |
| city | String | nie | Miasto |
| description | Text | nie | Opis apartamentu |
| maxGuests | Int | tak | Maksymalna liczba gosci |
| basePricePerNight | Decimal | tak | Cena bazowa za noc |
| cleaningFee | Decimal | tak | Oplata za sprzatanie |
| depositAmount | Decimal | tak | Kaucja zwrotna |
| currency | String | tak | Domyslnie PLN |
| minimumNights | Int | tak | Minimalna liczba nocy |
| defaultCheckInTime | String | nie | Np. 15:00 |
| defaultCheckOutTime | String | nie | Np. 11:00 |
| googleCalendarId | String | nie | ID kalendarza Google |
| isActive | Boolean | tak | Czy apartament aktywny |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Indeksy:
- unique(slug)
- index(isActive)

---

## Tabela: guests

Cel: dane osoby rezerwujacej.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID goscia |
| firstName | String | tak | Imie |
| lastName | String | tak | Nazwisko |
| email | String | tak | E-mail |
| phone | String | tak | Telefon |
| country | String | nie | Kraj |
| city | String | nie | Miasto |
| language | String | nie | Preferowany jezyk, np. pl |
| marketingConsent | Boolean | tak | Zgoda marketingowa |
| termsAccepted | Boolean | tak | Akceptacja regulaminu |
| rodoAccepted | Boolean | tak | Zgoda RODO / informacja o przetwarzaniu |
| notes | Text | nie | Notatki admina |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Indeksy:
- index(email)
- index(phone)

Uwaga:
Nie zbierac numeru dokumentu w MVP, jesli nie jest konieczny.

---

## Tabela: reservations

Cel: glowna tabela rezerwacji.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID rezerwacji |
| reservationNumber | String | tak | Czytelny numer, np. RES-2026-0001 |
| apartmentId | String/UUID | tak | Relacja do apartments |
| guestId | String/UUID | tak | Relacja do guests |
| checkInDate | Date | tak | Data przyjazdu |
| checkOutDate | Date | tak | Data wyjazdu |
| nightsCount | Int | tak | Liczba nocy |
| guestsCount | Int | tak | Liczba gosci |
| pricePerNight | Decimal | tak | Cena bazowa/zapisana w momencie rezerwacji |
| accommodationAmount | Decimal | tak | Koszt noclegow |
| cleaningFee | Decimal | tak | Oplata za sprzatanie |
| depositAmount | Decimal | tak | Kaucja zwrotna |
| discountAmount | Decimal | tak | Rabat |
| totalAmount | Decimal | tak | Kwota calkowita |
| amountToPayNow | Decimal | tak | Kwota do zaplaty teraz |
| paidAmount | Decimal | tak | Kwota zaplacona |
| currency | String | tak | Waluta |
| status | ReservationStatus | tak | Status rezerwacji |
| paymentStatus | PaymentStatus | tak | Status platnosci pomocniczo |
| source | ReservationSource | tak | Zrodlo rezerwacji |
| createdByType | String | tak | customer/admin/system |
| calendarEventId | String | nie | ID wydarzenia Google Calendar |
| holdExpiresAt | DateTime | nie | Do kiedy termin zablokowany |
| confirmedAt | DateTime | nie | Data potwierdzenia |
| cancelledAt | DateTime | nie | Data anulowania |
| completedAt | DateTime | nie | Data zakonczenia pobytu |
| customerNotes | Text | nie | Notatka od klienta |
| adminNotes | Text | nie | Notatka admina |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Relacje:
- apartmentId -> apartments.id
- guestId -> guests.id

Indeksy:
- unique(reservationNumber)
- index(apartmentId, checkInDate, checkOutDate)
- index(status)
- index(paymentStatus)
- index(holdExpiresAt)
- index(source)

Kluczowa logika dostepnosci:
```text
existing.checkInDate < requested.checkOutDate
AND existing.checkOutDate > requested.checkInDate
AND existing.status IN (PENDING_PAYMENT, CONFIRMED, MANUAL_BLOCK)
```

---

## Tabela: payments

Cel: platnosci powiazane z rezerwacjami.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID platnosci |
| reservationId | String/UUID | tak | Relacja do reservations |
| provider | PaymentProvider | tak | Operator platnosci |
| providerPaymentId | String | nie | ID platnosci u operatora |
| paymentToken | String | tak | Bezpieczny token do /pay/[token] |
| paymentUrl | String | nie | Link platnosci lub link do strony platnosci |
| amount | Decimal | tak | Kwota platnosci |
| currency | String | tak | Waluta |
| status | PaymentStatus | tak | Status platnosci |
| paymentExpiresAt | DateTime | nie | Data wygasniecia platnosci/linku |
| paymentLinkSentAt | DateTime | nie | Kiedy wyslano link |
| paymentLinkSentTo | String | nie | Na jaki e-mail wyslano link |
| paymentLinkOpenedAt | DateTime | nie | Kiedy klient otworzyl link |
| paidAt | DateTime | nie | Kiedy potwierdzono platnosc |
| failedAt | DateTime | nie | Kiedy platnosc sie nie powiodla |
| refundedAt | DateTime | nie | Kiedy zwrocono platnosc |
| rawWebhookPayload | Json | nie | Surowy payload webhooka |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Relacje:
- reservationId -> reservations.id

Indeksy:
- unique(paymentToken)
- index(reservationId)
- index(providerPaymentId)
- index(status)
- index(paymentExpiresAt)

Uwaga:
Rezerwacja moze miec wiecej niz jedna platnosc, np. ponowienie linku albo doplata.

---

## Tabela: pricing_rules

Cel: reguly cenowe dla sezonow, weekendow i wyjatkow.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID reguly |
| apartmentId | String/UUID | tak | Relacja do apartments |
| name | String | tak | Nazwa reguly |
| dateFrom | Date | tak | Poczatek obowiazywania |
| dateTo | Date | tak | Koniec obowiazywania |
| pricePerNight | Decimal | tak | Cena za noc w tym okresie |
| minimumNights | Int | nie | Minimalna liczba nocy |
| daysOfWeek | String | nie | Np. FRI,SAT albo JSON |
| priority | Int | tak | Priorytet reguly |
| isActive | Boolean | tak | Czy regula aktywna |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Indeksy:
- index(apartmentId, dateFrom, dateTo)
- index(isActive)
- index(priority)

Zasada:
Jezeli kilka regul pasuje do daty, wygrywa najwyzszy priority.

---

## Tabela: calendar_blocks

Cel: reczne blokady terminow, np. pobyt wlasciciela, remont, serwis, przerwa techniczna.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID blokady |
| apartmentId | String/UUID | tak | Relacja do apartments |
| dateFrom | Date | tak | Poczatek blokady |
| dateTo | Date | tak | Koniec blokady |
| reason | String | nie | Powod blokady |
| calendarEventId | String | nie | ID wydarzenia Google Calendar |
| createdBy | String | nie | Kto utworzyl blokade |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Indeksy:
- index(apartmentId, dateFrom, dateTo)

Logika nachodzenia terminu:
```text
existing.dateFrom < requested.checkOutDate
AND existing.dateTo > requested.checkInDate
```

---

## Tabela: email_logs

Cel: historia wysylek e-mail.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID logu |
| reservationId | String/UUID | nie | Relacja do reservations |
| guestId | String/UUID | nie | Relacja do guests |
| type | String | tak | Typ e-maila |
| recipientEmail | String | tak | Odbiorca |
| subject | String | tak | Temat |
| status | String | tak | sent/failed/pending |
| providerMessageId | String | nie | ID wiadomosci u dostawcy |
| errorMessage | Text | nie | Blad wysylki |
| sentAt | DateTime | nie | Data wysylki |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Typy e-maili:
```text
PAYMENT_LINK
RESERVATION_CONFIRMED
RESERVATION_CANCELLED
CHECK_IN_REMINDER
ADMIN_NEW_RESERVATION
```

---

## Tabela: app_settings

Cel: ustawienia aplikacji bez zmian w kodzie.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID ustawienia |
| key | String | tak | Nazwa ustawienia |
| value | String/Text | tak | Wartosc |
| type | String | tak | string/number/boolean/json |
| description | String | nie | Opis ustawienia |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Przykladowe ustawienia:
```text
default_currency = PLN
online_hold_minutes = 15
manual_hold_hours = 24
default_deposit_type = percent
default_deposit_value = 30
minimum_deposit_amount = 200
admin_notification_email = example@example.com
payment_link_base_url = https://twojadomena.pl/pay
```

Indeksy:
- unique(key)

---

## Tabela: admin_users

Cel: uzytkownicy panelu administratora.

| Kolumna | Typ | Wymagana | Opis |
|---|---|---:|---|
| id | String/UUID | tak | Unikalne ID uzytkownika |
| email | String | tak | E-mail logowania |
| name | String | nie | Imie/nazwa |
| role | String | tak | ADMIN/MANAGER/STAFF |
| isActive | Boolean | tak | Czy aktywny |
| lastLoginAt | DateTime | nie | Ostatnie logowanie |
| createdAt | DateTime | tak | Data utworzenia |
| updatedAt | DateTime | tak | Data aktualizacji |

Indeksy:
- unique(email)
- index(role)
- index(isActive)

---

## Minimalny zestaw tabel dla MVP

Jesli chcesz wdrozyc najpierw najkrotsza wersje, zacznij od:

```text
apartments
guests
reservations
payments
pricing_rules
calendar_blocks
email_logs
app_settings
```

Admin users mozna dodac od razu, jesli panel admina ma miec logowanie.

---

## Pola krytyczne dla Codexa

Codex musi szczegolnie pilnowac tych pol:

```text
Reservation.status
Reservation.paymentStatus
Reservation.checkInDate
Reservation.checkOutDate
Reservation.holdExpiresAt
Reservation.calendarEventId
Payment.status
Payment.paymentToken
Payment.paymentUrl
Payment.paymentExpiresAt
Payment.providerPaymentId
Apartment.googleCalendarId
```

---

## Reguly biznesowe

1. Nie mozna utworzyc rezerwacji, jezeli termin nachodzi na aktywna rezerwacje albo blokade.
2. Status CONFIRMED mozna ustawic automatycznie tylko po zweryfikowanym webhooku platnosci.
3. Rezerwacja PENDING_PAYMENT blokuje termin do holdExpiresAt.
4. Rezerwacja EXPIRED nie blokuje terminu.
5. Rezerwacja CANCELLED nie blokuje terminu.
6. Link platnosci musi miec unikalny i trudny do odgadniecia token.
7. Google Calendar nie moze byc jedynym miejscem przechowywania rezerwacji.
8. Jesli Google Calendar jest niedostepny, aplikacja musi zachowac rezerwacje w bazie i zapisac blad do logow.
9. Rezerwacja reczna przez admina moze miec dluzszy czas blokady niz rezerwacja online.
10. Platnosc potwierdzona przez webhook musi aktualizowac Payment, Reservation i Google Calendar.

---

## Przykladowy rekord rezerwacji

```json
{
  "reservationNumber": "RES-2026-0001",
  "apartmentId": "apt_001",
  "guestId": "guest_001",
  "checkInDate": "2026-07-10",
  "checkOutDate": "2026-07-13",
  "nightsCount": 3,
  "guestsCount": 2,
  "pricePerNight": 350,
  "accommodationAmount": 1050,
  "cleaningFee": 150,
  "depositAmount": 500,
  "discountAmount": 0,
  "totalAmount": 1700,
  "amountToPayNow": 510,
  "paidAmount": 0,
  "currency": "PLN",
  "status": "PENDING_PAYMENT",
  "paymentStatus": "CREATED",
  "source": "PHONE",
  "createdByType": "admin",
  "holdExpiresAt": "2026-07-01T18:00:00.000Z"
}
```

---

## Przykladowy rekord platnosci

```json
{
  "reservationId": "res_001",
  "provider": "PRZELEWY24",
  "providerPaymentId": null,
  "paymentToken": "secure-random-token",
  "paymentUrl": "https://twojadomena.pl/pay/secure-random-token",
  "amount": 510,
  "currency": "PLN",
  "status": "CREATED",
  "paymentExpiresAt": "2026-07-01T18:00:00.000Z",
  "paymentLinkSentAt": null,
  "paymentLinkSentTo": null,
  "paidAt": null
}
```

---

## Widoki admina i wymagane kolumny

### Lista rezerwacji

| Kolumna UI | Zrodlo danych |
|---|---|
| Numer | reservations.reservationNumber |
| Klient | guests.firstName + guests.lastName |
| Telefon | guests.phone |
| E-mail | guests.email |
| Termin | checkInDate - checkOutDate |
| Noce | nightsCount |
| Goscie | guestsCount |
| Kwota | totalAmount + currency |
| Do zaplaty | amountToPayNow |
| Zaplacono | paidAmount |
| Status | status |
| Platnosc | paymentStatus |
| Zrodlo | source |
| Waznosc blokady | holdExpiresAt |
| Akcje | podglad / wyslij link / kopiuj link / anuluj |

### Szczegoly rezerwacji

Sekcje:
- Dane pobytu,
- Dane goscia,
- Kalkulacja ceny,
- Platnosc,
- Google Calendar,
- Historia e-maili,
- Notatki admina.

### Dodaj rezerwacje recznie

Pola formularza:
- apartmentId,
- checkInDate,
- checkOutDate,
- guestsCount,
- firstName,
- lastName,
- email,
- phone,
- source,
- customPrice opcjonalnie,
- discountAmount opcjonalnie,
- adminNotes,
- sendPaymentLinkNow boolean.

---

## Kolejnosc wdrozenia danych

1. Enumy.
2. apartments.
3. guests.
4. reservations.
5. payments.
6. pricing_rules.
7. calendar_blocks.
8. email_logs.
9. app_settings.
10. admin_users.

Po kazdym etapie wykonaj migracje i test relacji.
