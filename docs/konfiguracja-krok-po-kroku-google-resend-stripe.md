# Konfiguracja krok po kroku: Google Calendar, Resend, Stripe i Vercel

Ten dokument jest praktyczna instrukcja uruchomienia najwazniejszych integracji
online dla tej aplikacji.

Cel biznesowy:
- uruchomic prawdziwy przeplyw rezerwacji online,
- podlaczyc platnosci, kalendarz i e-maile,
- zrobic to bez chaosu i bez zgadywania.

## Co bedzie potrzebne

Przed startem przygotuj:
- konto `Vercel`
- konto `Supabase`
- konto `Stripe`
- konto `Google`
- konto `Resend`
- dostep do domeny lub gotowosc do pracy na adresie Vercel

## Kolejnosc konfiguracji

Najlepsza kolejnosc:
1. `Vercel`
2. `Supabase`
3. `Stripe`
4. `Google Calendar`
5. `Resend`
6. wpisanie zmiennych srodowiskowych
7. test pelnego flow

## 1. Vercel

### Co zrobic

1. Zaloguj sie do `Vercel`.
2. Podlacz repozytorium GitHub z projektem.
3. Utworz projekt.
4. Skopiuj adres projektu, np.:
   - `https://twoj-projekt.vercel.app`

### Co bedzie potrzebne dalej

Ten adres wpiszesz jako:
- `APP_BASE_URL`

## 2. Supabase

### Co zrobic

1. Wejdz do swojego projektu `Supabase`.
2. Otworz ustawienia bazy danych.
3. Skopiuj 2 adresy polaczenia:
   - adres do aplikacji
   - adres bezposredni do migracji

### Co wpisac do zmiennych

- `DATABASE_URL`
- `DIRECT_URL`

### Jak to rozumiec

- `DATABASE_URL` sluzy aplikacji
- `DIRECT_URL` sluzy narzedziom `Prisma`, np. migracjom

## 3. Stripe

### Co zrobic

1. Zaloguj sie do `Stripe`.
2. Przejdz do kluczy API.
3. Skopiuj:
   - `Secret key`

### Co wpisac do zmiennych

- `STRIPE_SECRET_KEY`

### Konfiguracja webhooka

1. W `Stripe` przejdz do sekcji webhookow.
2. Dodaj endpoint:

```text
https://twoj-adres-online/api/webhooks/stripe
```

Przyklad:

```text
https://twoj-projekt.vercel.app/api/webhooks/stripe
```

3. Wybierz zdarzenia:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

4. Skopiuj sekret webhooka.

### Co wpisac do zmiennych

- `STRIPE_WEBHOOK_SECRET`

## 4. Google Calendar

### Konto kalendarza

Na start uzywamy:
- `apartslot@gmail.com`

### Co zrobic

1. Zaloguj sie na `apartslot@gmail.com`.
2. Utworz kalendarz dla rezerwacji, jesli jeszcze go nie ma.
3. Przejdz do `Google Cloud Console`.
4. Utworz projekt, jesli go jeszcze nie ma.
5. Wlacz `Google Calendar API`.
6. Utworz `Service Account`, czyli konto serwisowe.
   To jest techniczne konto dla aplikacji, nie dla klienta.
7. Wygeneruj klucz JSON dla tego konta.
8. Udostepnij kalendarz na `apartslot@gmail.com` temu kontu serwisowemu z prawem edycji.

### Co z pliku JSON bedzie potrzebne

Z klucza JSON wez:
- `client_email`
- `private_key`

### Co wpisac do zmiennych

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_FALLBACK_ID`

### Co wpisac jako fallback

Najprostsza wersja na start:

```text
GOOGLE_CALENDAR_FALLBACK_ID="apartslot@gmail.com"
```

Jesli pozniej utworzysz osobny kalendarz z osobnym ID, podmienimy to na jego identyfikator.

### Wazna uwaga

Klucz prywatny musi zostac wpisany z `\\n`, nie jako zwykle nowe linie.

Czyli w praktyce:

```text
-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n
```

## 5. Resend

### Co zrobic

1. Zaloguj sie do `Resend`.
2. Upewnij sie, ze masz aktywne konto i klucz API.
3. Dodaj lub potwierdz domenę nadawcy.
4. Przygotuj adres nadawcy, np.:
   - `rezerwacje@twojadomena.pl`

### Co wpisac do zmiennych

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Wazna uwaga

`RESEND_FROM_EMAIL` powinien nalezec do domeny zweryfikowanej w Resend.

## 6. Wpisanie zmiennych do Vercel

W `Vercel` przejdz do:
- `Project Settings`
- `Environment Variables`

Dodaj te zmienne:

```text
DATABASE_URL
DIRECT_URL
APP_BASE_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_CALENDAR_FALLBACK_ID
RESEND_API_KEY
RESEND_FROM_EMAIL
```

### Dobra praktyka

Na start wpisz je przynajmniej dla:
- `Preview`
- `Production`

## 7. Test pelnego flow

Po konfiguracji wykonaj test krok po kroku:

1. Utworz testowa rezerwacje online.
2. Odbierz link platnosci.
3. Wejdz na `/pay/[token]`.
4. Kliknij `Zaplac teraz w Stripe`.
5. Wykonaj testowa platnosc.
6. Sprawdz, czy webhook Stripe doszedl.
7. Sprawdz w bazie:
   - `Payment.status = PAID`
   - `Reservation.status = CONFIRMED`
8. Sprawdz, czy wydarzenie pojawilo sie w Google Calendar.
9. Sprawdz, czy klient dostal e-mail.
10. Sprawdz, czy `email_logs` ma wpis `SENT`.

## Jak sprawdzac bledy

### Jesli nie dziala Stripe

Sprawdz:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- poprawny adres webhooka
- czy Stripe wysyla zdarzenia na dobry endpoint

### Jesli nie dziala Google Calendar

Sprawdz:
- czy `Google Calendar API` jest wlaczone
- czy konto serwisowe ma dostep do kalendarza
- czy `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` jest poprawnie wklejony
- czy `GOOGLE_CALENDAR_FALLBACK_ID` jest poprawny

### Jesli nie dziala Resend

Sprawdz:
- `RESEND_API_KEY`
- czy domena jest zweryfikowana
- czy `RESEND_FROM_EMAIL` nalezy do tej domeny

## Minimalna wersja produkcyjna

Jesli chcesz po prostu uruchomic MVP, minimalny zestaw to:
- poprawny `APP_BASE_URL`
- dzialajacy `Stripe webhook`
- dzialajace `Supabase`
- dzialajacy `Google Calendar`
- dzialajacy `Resend`

## Co bedzie kolejnym krokiem

Po tej konfiguracji najbezpieczniej przejsc do:
1. panelu admina
2. recznych blokad kalendarza
3. ponownej wysylki linku do platnosci
