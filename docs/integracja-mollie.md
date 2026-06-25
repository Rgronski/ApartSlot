# Integracja Mollie

Cel biznesowy:
- przyjmowac platnosci online metodami przyjaznymi dla klientow z Polski,
- obslugiwac m.in. BLIK i Przelewy24, jesli sa aktywne na koncie Mollie,
- potwierdzac rezerwacje dopiero po oficjalnym statusie platnosci z Mollie.

## Gdzie znajduje sie kod

- tworzenie platnosci: `services/payments/create-mollie-payment.ts`
- webhook Mollie: `app/api/webhooks/mollie/route.ts`
- obsluga statusow: `services/payments/handle-mollie-webhook.ts`
- strona klienta: `app/pay/[token]/page.tsx`

## Jak dziala proces

1. Klient otwiera link `/pay/[token]`.
2. Klika `Zaplac online`.
3. Aplikacja tworzy platnosc w Mollie.
4. Klient przechodzi do bezpiecznego checkoutu Mollie.
5. Mollie wysyla webhook na `/api/webhooks/mollie`.
6. Aplikacja pobiera aktualny status platnosci z Mollie API.
7. Dopiero status `paid` lub `authorized` potwierdza rezerwacje.

## Wymagane ustawienia w Vercel

- `APP_BASE_URL`
- `MOLLIE_API_KEY`
- `DATABASE_URL`
- `DIRECT_URL`

## Wymagana zmiana w Supabase

Przed wdrozeniem produkcyjnym trzeba dopisac operatora Mollie do typu bazy:

```sql
alter type payment_provider add value if not exists 'MOLLIE';
```

Gotowy plik:
- `docs/sql/add-mollie-payment-provider.sql`

## Webhook w Mollie

Przy tworzeniu platnosci aplikacja przekazuje Mollie adres:

```text
https://twoj-adres-aplikacji/api/webhooks/mollie
```

Mollie wysyla do aplikacji tylko ID platnosci. Aplikacja sama pobiera status z Mollie, co jest bezpieczniejsze niz ufanie samej wiadomosci webhooka.
