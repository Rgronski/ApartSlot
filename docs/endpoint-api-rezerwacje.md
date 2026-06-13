# Endpoint API rezerwacje

Ten dokument opisuje publiczny endpoint do tworzenia rezerwacji online.

Cel biznesowy:
- dac formularzowi prosty punkt wysylki danych,
- zapisac rezerwacje i platnosc w bazie,
- zwrocic link do platnosci dla klienta.

## Gdzie znajduje sie endpoint

Plik:
- [route.ts](</C:/Users/Dell/Documents/Apka do wynajmu krotkoterminowego/app/api/reservations/route.ts>)

Adres:
- `POST /api/reservations`

## Co przyjmuje endpoint

Przykladowe dane:

```json
{
  "apartmentId": "apt_001",
  "checkInDate": "2026-07-10",
  "checkOutDate": "2026-07-13",
  "guestsCount": 2,
  "customerNotes": "Przyjazd wieczorem",
  "depositConfig": {
    "type": "percent",
    "value": 30,
    "minimumAmount": 200
  },
  "guest": {
    "firstName": "Jan",
    "lastName": "Nowak",
    "email": "jan@example.com",
    "phone": "+48 500 600 700",
    "termsAccepted": true,
    "rodoAccepted": true,
    "marketingConsent": false
  }
}
```

## Co robi endpoint

1. sprawdza dane przychodzace z formularza
2. ustala bazowy adres do platnosci
3. uruchamia logike rezerwacji z `Prisma`
4. zapisuje goscia, rezerwacje i platnosc w bazie
5. zwraca link do platnosci i podsumowanie

## Co zwraca przy sukcesie

Status:
- `201 Created`

Zwrot:
- numer rezerwacji
- status rezerwacji
- status platnosci
- data wygasniecia blokady
- link do platnosci
- podsumowanie kwoty

## Co zwraca przy bledzie

Przyklad:

```json
{
  "success": false,
  "error": {
    "code": "TERM_NOT_AVAILABLE",
    "message": "Wybrany termin jest juz zajety."
  }
}
```

## Najwazniejsze statusy HTTP

- `201` - rezerwacja utworzona
- `400` - zle dane z formularza
- `404` - nie znaleziono apartamentu
- `409` - termin juz zajety
- `500` - blad serwera

## Co jest wazne praktycznie

Endpoint sam:
- nie potwierdza rezerwacji jako oplaconej
- nie ustawia `CONFIRMED`
- nie zastepuje webhooka Stripe

On tylko:
- zapisuje rezerwacje `PENDING_PAYMENT`
- tworzy platnosc `CREATED`
- zwraca link do platnosci

## Co bedzie kolejnym krokiem

Po tym etapie najbezpieczniej przejsc do:
1. strony `/pay/[token]`
2. integracji Stripe
3. webhooka potwierdzajacego platnosc
