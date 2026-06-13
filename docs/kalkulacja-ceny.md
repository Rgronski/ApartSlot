# Kalkulacja ceny

Ten dokument opisuje, jak aplikacja ma liczyc cene pobytu.

Cel biznesowy:
- zawsze pokazywac klientowi poprawna kwote,
- zachowac spojnosc miedzy formularzem, rezerwacja i platnoscia,
- pozwolic na ceny sezonowe, weekendowe, wydarzeniowe i zaliczki.

## Gdzie znajduje sie logika

Plik z glowna funkcja:
- [calculate-reservation-price.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/pricing/calculate-reservation-price.ts>)

Testy:
- [calculate-reservation-price.test.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/tests/unit/calculate-reservation-price.test.ts>)

## Jak liczona jest cena

System liczy:
- liczbe nocy
- cene za kazda noc
- sume noclegow
- oplate za sprzatanie
- kaucje
- rabat
- kwote do zaplaty teraz

## Kolejnosc liczenia

1. system liczy liczbe nocy na podstawie `checkInDate` i `checkOutDate`
2. dla kazdej nocy sprawdza, czy pasuje regula cenowa
3. jesli nie ma reguly, bierze cene bazowa apartamentu
4. sumuje wszystkie noce
5. dolicza sprzatanie i kaucje
6. odejmuje rabat
7. wylicza kwote do zaplaty teraz

## Jak dzialaja reguly cenowe

Regula moze zmienic cene, jesli:
- pasuje do apartamentu
- jest aktywna
- data nocy miesci sie w zakresie reguly
- i jesli trzeba, pasuje tez dzien tygodnia

Jesli kilka regul pasuje jednoczesnie:
- wygrywa regula z wyzszym priorytetem

## Regula wydarzenie

Regula `wydarzenie` sluzy do sytuacji, gdy cena ma byc inna przez konkretny
event, na przyklad:
- koncert
- targi
- festiwal
- swieta
- dlugi weekend

Technicznie dziala tak samo jak inne reguly cenowe:
- ma zakres dat
- ma cene za noc
- ma priorytet

Roznica jest biznesowa:
- w danych od razu widac, ze zmiana ceny wynika z wydarzenia, a nie tylko z sezonu.

## Jak dzialaja weekendy

Weekend jest obslugiwany przez zwykla regule cenowa z lista dni tygodnia.

Przyklad:
- `5` = piatek
- `6` = sobota

To daje elastycznosc, bo mozna pozniej dodac tez inne reguly dzienne.

## Jak dziala zaliczka

Obslugiwane sa 2 warianty:
- procent calosci, np. `30%`
- stala kwota, np. `500 PLN`

Dodatkowo:
- dla zaliczki procentowej mozna ustawic minimalna kwote

Przyklad:
- 30% z 400 PLN to 120 PLN
- ale jesli minimum to 150 PLN, klient zaplaci 150 PLN

## Co juz jest przetestowane

Przygotowalem testy dla:
- zwyklej ceny bazowej
- ceny sezonowej
- ceny weekendowej
- ceny wydarzeniowej
- oplaty za sprzatanie
- zaliczki procentowej
- minimalnej kwoty zaliczki
- warunku minimalnej liczby nocy dla reguly

## Co bedzie kolejnym krokiem

Po kalkulacji ceny najbezpieczniej przejsc do:
1. tworzenia rezerwacji `PENDING_PAYMENT`
2. generowania linku platnosci
3. pozniejszego podpiecia Stripe
