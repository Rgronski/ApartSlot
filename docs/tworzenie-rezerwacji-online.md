# Tworzenie rezerwacji online

Ten dokument opisuje, jak aplikacja ma utworzyc rezerwacje online po stronie klienta.

Cel biznesowy:
- przyjac dane klienta,
- sprawdzic wolny termin,
- policzyc cene,
- zablokowac termin na czas platnosci,
- wygenerowac bezpieczny link do platnosci.

## Gdzie znajduje sie logika

Plik z glowna funkcja:
- [create-online-reservation.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/reservations/create-online-reservation.ts>)

Testy:
- [create-online-reservation.test.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/tests/unit/create-online-reservation.test.ts>)

## Jak dziala flow

1. klient wybiera daty pobytu
2. klient podaje liczbe gosci
3. klient wpisuje dane kontaktowe
4. system sprawdza zgody formalne
5. system sprawdza dostepnosc terminu
6. system liczy cene pobytu
7. system znajduje istniejacego goscia albo przygotowuje nowego
8. system tworzy szkic rezerwacji `PENDING_PAYMENT`
9. system tworzy szkic platnosci `CREATED`
10. system generuje bezpieczny token i link `/pay/[token]`
11. termin jest blokowany do `holdExpiresAt`

## Co juz robi ta logika

Aktualny modul przygotowuje:
- dane goscia
- dane rezerwacji
- dane platnosci
- podsumowanie dla klienta

To jest bezpieczny etap posredni:
- jeszcze nie zapisujemy nic do prawdziwej bazy
- ale cala logika biznesowa jest juz zebrana w jednym miejscu

## Co jest wazne bezpieczenstwa

- token platnosci jest losowy i trudny do odgadniecia
- termin nie przejdzie dalej, jesli jest zajety
- rezerwacja startuje jako `PENDING_PAYMENT`
- platnosc startuje jako `CREATED`
- nic nie ustawia `CONFIRMED` bez dalszego kroku platnosci

## Co juz jest przetestowane

Przygotowalem testy dla:
- poprawnego utworzenia szkicu rezerwacji
- wykorzystania istniejacego goscia
- blokady zajetego terminu
- braku akceptacji regulaminu
- przekroczenia maksymalnej liczby gosci

## Czego jeszcze tu nie ma

Na razie nie ma jeszcze:
- zapisu do Prisma / Supabase
- webhooka Stripe
- zapisu do Google Calendar
- wysylki e-maila

To jest celowe, bo najpierw budujemy pewny proces, a dopiero potem podpinamy integracje.

## Co bedzie kolejnym krokiem

Po tej logice najbezpieczniej przejsc do:
1. podpiecia rezerwacji do bazy danych
2. przygotowania endpointu API
3. utworzenia strony i flow platnosci
