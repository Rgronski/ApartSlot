# Strona platnosci /pay/[token]

Ten dokument opisuje publiczna strone, ktora klient otwiera z linku platnosci.

Cel biznesowy:
- pokazac klientowi prawdziwy stan linku i rezerwacji,
- wyswietlic podsumowanie pobytu,
- przygotowac miejsce pod finalny checkout Stripe.

## Gdzie znajduje sie logika

Strona:
- [page.tsx](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/app/pay/%5Btoken%5D/page.tsx>)

Odczyt danych:
- [get-payment-page-data.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/services/payments/get-payment-page-data.ts>)

## Co robi strona

Po otwarciu tokenu strona:
1. pobiera platnosc z bazy po `paymentToken`
2. pobiera powiazana rezerwacje, apartament i dane goscia
3. rozpoznaje stan linku
4. pokazuje odpowiedni komunikat
5. pokazuje podsumowanie pobytu i platnosci

## Jakie stany obsluguje

### `active`

Co oznacza:
- link istnieje
- nie wygasl
- platnosc nie jest jeszcze potwierdzona

Efekt:
- klient widzi podsumowanie i miejsce na przyszly przycisk Stripe

### `expired`

Co oznacza:
- link lub rezerwacja wygasly

Efekt:
- klient dostaje informacje, ze trzeba odnowic link albo zrobic nowa rezerwacje

### `paid`

Co oznacza:
- platnosc jest juz potwierdzona albo rezerwacja jest `CONFIRMED`

Efekt:
- klient dostaje jasne potwierdzenie, ze nic nie musi juz robic

### `cancelled`

Co oznacza:
- rezerwacja albo platnosc zostaly anulowane

Efekt:
- klient widzi, ze ten link nie jest juz aktywny

### `failed`

Co oznacza:
- poprzednia proba platnosci nie udala sie

Efekt:
- po podpieciu Stripe bedzie mozna pokazac opcje ponownej proby

### `not_found`

Co oznacza:
- token nie istnieje

Efekt:
- klient dostaje czytelny komunikat zamiast pustej strony lub bledu technicznego

## Co juz jest gotowe

Strona pokazuje juz:
- numer rezerwacji
- apartament
- termin pobytu
- liczbe nocy
- liczbe gosci
- kwote calkowita
- kwote do zaplaty teraz
- ile juz zaplacono
- waznosc linku
- dane kontaktowe klienta

## Czego jeszcze nie ma

Na tym etapie nadal nie ma:
- prawdziwego przycisku checkout Stripe
- webhooka potwierdzajacego platnosc
- automatycznej zmiany statusu po powrocie od operatora

To jest celowe, bo najpierw zbudowalismy prawdziwa strone danych i stanow.

## Co bedzie kolejnym krokiem

Po tej stronie najbezpieczniej przejsc do:
1. integracji Stripe checkout
2. webhooka Stripe
3. aktualizacji statusow `Payment` i `Reservation`
