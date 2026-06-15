# SQL MVP do Supabase

Ten dokument prowadzi przez utworzenie podstawowej struktury bazy danych
bezposrednio w projekcie online `Supabase`.

Cel biznesowy:
- szybko uruchomic tabele potrzebne do rezerwacji online,
- nie blokowac sie na bardziej technicznym procesie migracji,
- przygotowac baze pod panel admina, platnosci i kalendarz.

## Co dostajesz

Plik SQL do uruchomienia:
- [supabase-mvp-schema.sql](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/docs/sql/supabase-mvp-schema.sql>)

## Jak uruchomic skrypt w Supabase

1. Wejdz do projektu `ApartSlot` w `Supabase`.
2. Kliknij `SQL Editor`.
3. Utworz nowe zapytanie, np. `MVP schema`.
4. Otworz plik `supabase-mvp-schema.sql`.
5. Skopiuj cala zawartosc.
6. Wklej do edytora SQL w `Supabase`.
7. Kliknij `Run`.

## Jaki bedzie efekt

Powstana tabele:
- `apartments`
- `guests`
- `reservations`
- `payments`
- `pricing_rules`
- `calendar_blocks`
- `email_logs`
- `app_settings`
- `admin_users`

Powstana tez:
- typy statusow i slownikow,
- indeksy przyspieszajace wyszukiwanie,
- automatyczna aktualizacja pola `updated_at`.

## Jak sprawdzic, czy zadzialalo

Po wykonaniu skryptu:
1. Wejdz w `Table Editor`.
2. Sprawdz, czy widzisz wymienione tabele.
3. Otworz `apartments` i `reservations`.
4. Sprawdz, czy kolumny wygladaja sensownie i nie ma bledu wykonania.

## Wazna uwaga o Prisma

Ten skrypt tworzy baze bezposrednio w `Supabase`.

To jest dobre na start, ale oznacza, ze pozniej trzeba bedzie
"zsynchronizowac historie migracji" z `Prisma`, zeby narzedzia techniczne
wiedzialy, ze te tabele juz istnieja.

Prosto mowiac:
- teraz zyskujemy szybki start online,
- pozniej zrobimy porzadek techniczny, zeby kolejne zmiany byly latwe.

## Czego ten skrypt jeszcze nie ustawia

Na tym etapie nie ustawiamy jeszcze:
- polityk RLS dla publicznego API `Supabase`,
- kont uzytkownikow `Supabase Auth`,
- triggerow do wysylek, webhookow ani automatyzacji.

To jest celowe. Najpierw stawiamy stabilna baze MVP.
