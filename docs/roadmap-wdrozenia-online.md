# Roadmap wdrozenia online

Ten dokument opisuje kolejnosc prac potrzebnych, zeby projekt stal sie
normalna aplikacja online, a nie tylko szkieletem technicznym.

Cel biznesowy:
- uruchomic MVP online w kontrolowany sposob,
- uniknac chaosu przy wdrozeniu,
- miec jasny podzial na testy i produkcje.

## Docelowa architektura

Rekomendowany zestaw:
- `GitHub` - kod i historia zmian
- `Vercel` - aplikacja online
- `Supabase` - baza danych PostgreSQL
- `Google Calendar` - pomocniczy widok rezerwacji
- `provider platnosci` - pobieranie platnosci i webhook
- `provider e-mail` - wysylka wiadomosci do klienta i admina

Najwazniejsza zasada:
- baza danych w `Supabase` jest glownym zrodlem prawdy
- `Google Calendar` jest tylko integracja pomocnicza

## Srodowiska

### Preview

Do czego sluzy:
- szybkie testy po kazdej zmianie
- sprawdzenie wygladu i podstawowych procesow

Zasada:
- tworzy sie automatycznie po zmianie w repozytorium

### Staging

Do czego sluzy:
- stabilne testy biznesowe online
- testowanie integracji przed produkcja

Kiedy warto:
- gdy chcesz miec jeden staly adres testowy
- gdy testy beda robione przez wiecej niz jedna osobe

### Production

Do czego sluzy:
- prawdziwa wersja dla klientow

Zasada:
- trafiaja tu tylko sprawdzone zmiany

## Etap 1. Konta i dostepy

Cel:
- zebrac wszystkie potrzebne uslugi i dostepy

Zakres:
- GitHub
- Vercel
- Supabase
- domena
- Google
- operator platnosci
- e-mail

Efekt:
- projekt nie zatrzyma sie przez brak konta lub klucza

## Etap 2. Podlaczenie projektu do Vercel

Cel:
- miec pierwsza publiczna wersje testowa online

Zakres:
- utworzenie projektu na Vercel
- podlaczenie repozytorium GitHub
- konfiguracja `Preview` i `Production`
- ustawienie podstawowych zmiennych srodowiskowych

Efekt:
- kazda zmiana moze dostac link testowy online

## Etap 3. Utworzenie projektu Supabase

Cel:
- miec gotowa baze danych do MVP

Zakres:
- projekt produkcyjny
- projekt testowy albo branching
- przygotowanie danych polaczeniowych
- plan migracji i kopii zapasowych

Efekt:
- mamy bezpieczny fundament danych

## Etap 4. Model danych i migracje

Cel:
- przygotowac tabele, relacje i statusy

Zakres:
- `apartments`
- `guests`
- `reservations`
- `payments`
- `pricing_rules`
- `calendar_blocks`
- `email_logs`
- `app_settings`

Efekt:
- aplikacja ma porzadna strukture danych

## Etap 5. Logika dostepnosci i ceny

Cel:
- nie dopuscic do podwojnych rezerwacji

Zakres:
- sprawdzanie zakresu dat
- blokowanie terminow
- liczenie liczby nocy
- wycena pobytu
- reguly sezonowe i weekendowe

Efekt:
- dziala serce procesu rezerwacji

## Etap 6. Rezerwacja online

Cel:
- klient moze sam zlozyc rezerwacje

Zakres:
- formularz wyboru terminu
- dane klienta
- walidacja danych
- zapis rezerwacji `PENDING_PAYMENT`
- generowanie linku do platnosci

Efekt:
- klient przechodzi pierwszy glowny proces samodzielnie

## Etap 7. Platnosci online

Cel:
- automatyczne potwierdzanie oplaconych rezerwacji

Zakres:
- integracja z jednym operatorem platnosci
- strona `/pay/[token]`
- webhook
- aktualizacja statusow platnosci i rezerwacji

Wazna zasada:
- rezerwacja staje sie `CONFIRMED` tylko po zweryfikowanym webhooku

Efekt:
- dziala bezpieczny proces sprzedazy

## Etap 8. Google Calendar

Cel:
- administrator widzi rezerwacje i blokady w kalendarzu

Zakres:
- tworzenie wpisu oczekujacego na platnosc
- zmiana wpisu po potwierdzeniu platnosci
- anulowanie lub oznaczanie wygaslych wpisow
- reczne blokady terminow

Efekt:
- latwiejsza codzienna obsluga

## Etap 9. E-maile

Cel:
- automatyczna komunikacja z klientem i administracja

Zakres:
- link do platnosci
- potwierdzenie rezerwacji
- powiadomienie o nowej rezerwacji
- logowanie prob wysylki

Efekt:
- mniej pracy recznej i mniej pomylek

## Etap 10. Panel administratora

Cel:
- obsluga rezerwacji bez potrzeby ingerencji programisty

Zakres:
- lista rezerwacji
- szczegoly rezerwacji
- reczne dodanie rezerwacji
- wysylka linku do platnosci
- anulowanie
- blokady kalendarza
- ustawienia podstawowe

Efekt:
- projekt jest uzyteczny w codziennej pracy

## Etap 11. Automatyzacje i porzadki

Cel:
- ograniczyc reczna obsluge i bledy

Zakres:
- wygaszanie nieoplaconych rezerwacji
- porzadkowanie wygaslych linkow
- logowanie bledow integracji
- podstawowy monitoring

Efekt:
- system jest stabilniejszy i tanszy w obsludze

## Etap 12. Start produkcyjny

Cel:
- uruchomic wersje dla klientow

Checklist przed startem:
- [ ] produkcyjna domena podpieta do Vercel
- [ ] produkcyjne zmienne srodowiskowe wpisane
- [ ] baza produkcyjna gotowa
- [ ] webhook produkcyjny ustawiony
- [ ] Google Calendar dziala
- [ ] e-maile dzialaja z prawdziwej domeny
- [ ] co najmniej 1 pelny test rezerwacji wykonany online
- [ ] wiemy, kto reaguje na problemy po starcie

Efekt:
- aplikacja moze przyjmowac prawdziwe rezerwacje

## Kolejnosc prac rekomendowana dla Ciebie

Najlepsza kolejnosc biznesowa:
1. konta i dostepy
2. Vercel i Supabase
3. baza danych
4. dostepnosc i wycena
5. rezerwacja online
6. platnosci
7. Google Calendar
8. e-mail
9. panel admina
10. automatyzacje

## Czego nie robic na poczatku

- nie wdrazac od razu wielu operatorow platnosci
- nie mieszac danych testowych z produkcyjnymi
- nie opierac logiki rezerwacji tylko o Google Calendar
- nie wrzucac hasel i kluczy do kodu
- nie publikowac produkcji bez testowego procesu rezerwacji online

## Szybka wersja MVP online

Jesli chcesz dojsc do dzialajacej wersji szybciej, minimalny zakres to:
- 1 apartament
- 1 operator platnosci
- 1 kalendarz Google
- 1 panel admina
- `Preview` i `Production`
- `Staging` mozna dodac chwile pozniej
