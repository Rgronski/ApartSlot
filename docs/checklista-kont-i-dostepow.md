# Checklista kont i dostepow

Ten dokument sluzy jako prosta lista kontrolna przed wdrozeniem aplikacji
rezerwacji apartamentu do internetu.

Cel biznesowy:
- miec wszystkie potrzebne konta i dostepy,
- nie blokowac projektu przez brak jednego hasla lub klucza,
- rozdzielic testy od produkcji,
- ograniczyc ryzyko pomylek i utraty danych.

## 1. GitHub

Do czego sluzy:
- przechowuje kod projektu,
- zapisuje historie zmian,
- laczy sie z Vercel do automatycznych wdrozen.

Do sprawdzenia:
- [ ] jest jedno glowne repozytorium projektu
- [ ] masz dostep wlascicielski albo administracyjny do repo
- [ ] znasz konto GitHub, z ktorego bedzie laczyl sie Vercel
- [ ] ustalamy glowna galaz projektu, np. `main`

Wazne:
- nie wrzucamy hasel i kluczy API do repozytorium
- plik `.env` nie powinien byc wysylany do GitHub

## 2. Vercel

Do czego sluzy:
- publikuje aplikacje online,
- tworzy linki testowe po zmianach,
- trzyma zmienne srodowiskowe dla aplikacji.

Do sprawdzenia:
- [ ] masz konto Vercel
- [ ] konto Vercel jest polaczone z GitHub
- [ ] projekt w Vercel zostal utworzony albo jest gotowy do utworzenia
- [ ] masz dostep do ustawien projektu
- [ ] masz mozliwosc dodania domeny lub subdomeny

Srodowiska do przygotowania:
- [ ] `Preview` - testowe linki po zmianach
- [ ] `Production` - wersja dla klientow
- [ ] `Staging` opcjonalnie - staly adres testowy

## 3. Supabase

Do czego sluzy:
- przechowuje baze danych PostgreSQL,
- moze obslugiwac logowanie,
- moze przechowywac dodatkowe dane i logi.

Do sprawdzenia:
- [ ] masz konto Supabase
- [ ] jest projekt produkcyjny albo wiemy, gdzie go zalozyc
- [ ] mamy osobne srodowisko testowe albo plan branchingu
- [ ] masz dostep do `Project Settings`
- [ ] masz dostep do kluczy projektu i connection stringa do bazy

Wazne bezpieczenstwo:
- [ ] klucz `service_role` nie moze trafic do frontendu
- [ ] dane testowe i produkcyjne nie powinny mieszac sie w jednej bazie bez kontroli
- [ ] przed wiekszymi zmianami w bazie planujemy kopie zapasowa

## 4. Domena

Do czego sluzy:
- daje profesjonalny adres aplikacji,
- pozwala ustawic produkcje i testy na osobnych adresach,
- pomaga przy e-mailach i integracjach.

Do sprawdzenia:
- [ ] masz dostep do panelu domeny
- [ ] wiemy, jaka bedzie domena produkcyjna
- [ ] wiemy, jaka bedzie subdomena testowa

Przyklad:
- produkcja: `rezerwacje.twojadomena.pl`
- testy: `staging.rezerwacje.twojadomena.pl`

## 5. Google Calendar

Do czego sluzy:
- pokazuje rezerwacje i blokady w kalendarzu,
- pomaga administratorowi kontrolowac oblozenie.

Do sprawdzenia:
- [ ] masz konto Google, z ktorego bedziemy korzystac
- [ ] istnieje kalendarz dla apartamentu albo wiemy, kto go utworzy
- [ ] mamy dostep do Google Cloud Console, jesli bedzie potrzebna integracja API
- [ ] wiemy, kto ma miec dostep do kalendarza

Wazne:
- Google Calendar jest dodatkiem, nie glowna baza danych

## 6. Operator platnosci

Do czego sluzy:
- przyjmuje platnosci od klientow,
- wysyla webhook, czyli oficjalne potwierdzenie platnosci.

Do sprawdzenia:
- [ ] wybrany jest pierwszy operator platnosci
- [ ] masz konto testowe albo sandbox
- [ ] masz konto produkcyjne albo wiesz, jak je aktywowac
- [ ] mamy dostep do kluczy API
- [ ] mamy dostep do ustawienia webhooka
- [ ] znamy wymagania prowizji, rozliczen i dokumentow

Do decyzji:
- [ ] czy startujemy od zaliczki procentowej czy stalej kwoty
- [ ] czy klient placi tylko zaliczke, czy od razu cala kwote

## 7. E-mail

Do czego sluzy:
- wysylka linku do platnosci,
- wysylka potwierdzenia rezerwacji,
- powiadomienia dla administratora.

Do sprawdzenia:
- [ ] wybrana jest usluga do wysylki e-mail
- [ ] masz dostep do domeny nadawcy
- [ ] da sie ustawic rekordy SPF, DKIM i DMARC
- [ ] wiemy, z jakiego adresu beda wychodzily maile

Przyklad:
- `rezerwacje@twojadomena.pl`
- `kontakt@twojadomena.pl`

## 8. Konta administratorow

Do czego sluzy:
- pozwala kontrolowac, kto ma dostep do panelu admina.

Do sprawdzenia:
- [ ] wiemy, kto ma byc glownym administratorem
- [ ] wiemy, czy beda dodatkowi pracownicy
- [ ] ustalamy, kto ma pelny dostep, a kto ograniczony

## 9. Monitoring i logi

Do czego sluzy:
- pomaga szybko wykryc bledy,
- ulatwia diagnoze problemow z platnosciami i integracjami.

Do sprawdzenia:
- [ ] wiemy, gdzie bedziemy sprawdzac logi aplikacji
- [ ] wiemy, kto ma dostawac powiadomienia o awariach
- [ ] mamy plan, co robimy przy bledzie platnosci albo integracji

## 10. Zmienne srodowiskowe

To sa tajne ustawienia projektu, przechowywane poza kodem.

Przykladowa lista:
- [ ] `DATABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_CALENDAR_ID`
- [ ] `PAYMENT_PROVIDER_SECRET`
- [ ] `PAYMENT_WEBHOOK_SECRET`
- [ ] `EMAIL_PROVIDER_API_KEY`
- [ ] `APP_BASE_URL`

Wazne:
- osobne wartosci dla testow i produkcji
- nic z tej listy nie powinno trafic bezposrednio do kodu

## 11. Decyzje biznesowe do odhaczenia

- [ ] czy na start bedzie 1 apartament czy wiecej
- [ ] jaki operator platnosci idzie jako pierwszy
- [ ] czy uruchamiamy logowanie do panelu admina od MVP
- [ ] czy robimy od razu adres testowy `staging`
- [ ] kto odbiera e-maile o nowych rezerwacjach
- [ ] jak dlugo ma trwac blokada terminu online
- [ ] jak dlugo ma trwac blokada terminu przy rezerwacji recznej

## 12. Minimalny zestaw na start

Jesli chcesz wystartowac bez nadmiaru przygotowan, minimalny zestaw to:
- GitHub
- Vercel
- Supabase
- domena produkcyjna
- konto testowe operatora platnosci
- konto do Google Calendar
- usluga e-mail

## Status projektu

Uzyj tej sekcji do szybkiego odhaczania.

- [ ] GitHub gotowy
- [ ] Vercel gotowy
- [ ] Supabase gotowy
- [ ] domena gotowa
- [ ] Google Calendar gotowy
- [ ] platnosci gotowe
- [ ] e-mail gotowy
- [ ] decyzje biznesowe potwierdzone
