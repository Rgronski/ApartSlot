# Logika dostepnosci terminow

Ten dokument opisuje, jak aplikacja ma podejmowac decyzje, czy termin jest wolny.

Cel biznesowy:
- nie dopuscic do podwojnej rezerwacji,
- poprawnie obslugiwac wyjazd i przyjazd tego samego dnia,
- uwzglednic zarowno rezerwacje, jak i reczne blokady.

## Gdzie znajduje sie logika

Plik z glowna funkcja:
- [check-availability.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/availability/check-availability.ts>)

Testy:
- [check-availability.test.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/tests/unit/check-availability.test.ts>)

## Jak dziala sprawdzanie terminu

System analizuje 3 rzeczy:
- rezerwacje w bazie
- reczne blokady terminow
- opcjonalnie zajetosc z Google Calendar

Termin jest zajety, jesli:
- inna rezerwacja nachodzi na wybrany zakres
- albo istnieje reczna blokada terminu
- albo Google Calendar zwroci zajetosc

## Najwazniejsza regula nachodzenia dat

Uzywamy tej zasady:

```text
existing.start < requested.checkOutDate
AND existing.end > requested.checkInDate
```

Dlaczego to jest dobre:
- wyjazd i przyjazd tego samego dnia sa dozwolone
- czesciowe nachodzenie jest blokowane
- calkowite objecie innej rezerwacji tez jest blokowane

## Jakie statusy blokuja termin

- `PENDING_PAYMENT`
- `CONFIRMED`
- `MANUAL_BLOCK`

## Jakie statusy nie blokuja terminu

- `CANCELLED`
- `EXPIRED`

## Jakie bledy sa obslugiwane

Funkcja zwraca blad, gdy:
- brakuje identyfikatora apartamentu
- data przyjazdu jest niepoprawna
- data wyjazdu jest niepoprawna
- data wyjazdu nie jest pozniejsza od daty przyjazdu

## Co juz jest przetestowane

Przygotowalem testy dla:
- tego samego terminu
- rozpoczecia nowej rezerwacji w dniu wyjazdu poprzedniej
- zakonczenia nowej rezerwacji w dniu przyjazdu kolejnej
- czesciowego nachodzenia
- calkowitego objecia innej rezerwacji
- ignorowania `CANCELLED` i `EXPIRED`
- recznej blokady kalendarza
- zajetosci z Google Calendar
- niepoprawnego zakresu dat

## Co bedzie kolejnym krokiem

Po tej logice mozemy przejsc do:
1. wyceny pobytu
2. tworzenia rezerwacji `PENDING_PAYMENT`
3. pozniejszego podpiecia bazy i zapytan Prisma
