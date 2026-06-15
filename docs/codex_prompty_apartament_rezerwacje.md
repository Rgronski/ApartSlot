# Zestaw promptow do Codexa - aplikacja rezerwacji apartamentu

## Cel aplikacji
Zbuduj aplikacje webowa do przyjmowania, zapisywania i obslugi rezerwacji apartamentu do wynajmu krotkoterminowego.

Aplikacja ma obslugiwac:
- sprawdzanie wolnych terminow,
- integracje z Google Calendar,
- blokowanie terminow po rezerwacji,
- reczne tworzenie rezerwacji przez administratora,
- wysylanie linku do platnosci e-mailem,
- kalkulacje liczby nocy i kosztow,
- statusy rezerwacji i platnosci,
- panel administratora,
- webhook platnosci potwierdzajacy rezerwacje.

Zrodlem prawdy ma byc baza danych aplikacji. Google Calendar ma sluzyc jako integracja pomocnicza do widoku i blokowania terminow.

---

## Prompt 1 - analiza i plan projektu

Przeanalizuj wymagania aplikacji rezerwacji apartamentu do wynajmu krotkoterminowego.

Wymagania glowne:
1. Klient moze wybrac date przyjazdu i wyjazdu.
2. System sprawdza dostepnosc terminu w bazie danych oraz Google Calendar.
3. Klient podaje dane kontaktowe.
4. System wylicza liczbe nocy i calkowity koszt rezerwacji.
5. System tworzy rezerwacje ze statusem pending_payment.
6. System blokuje termin tymczasowo.
7. Klient moze oplacic rezerwacje online.
8. Po platnosci webhook zmienia status rezerwacji na confirmed.
9. System tworzy albo aktualizuje wydarzenie w Google Calendar.
10. Administrator moze recznie utworzyc rezerwacje i wyslac klientowi link do platnosci e-mailem.

Najpierw przygotuj:
- architekture aplikacji,
- proponowana strukture folderow,
- glowne modele danych,
- glowne endpointy API,
- flow rezerwacji online,
- flow rezerwacji recznej przez administratora,
- liste funkcji MVP,
- liste funkcji do kolejnych etapow.

Nie implementuj jeszcze kodu. Najpierw przedstaw plan techniczny.

---

## Prompt 2 - struktura projektu Next.js

Na podstawie zaakceptowanego planu przygotuj strukture projektu Next.js z TypeScript.

Stack:
- Next.js App Router,
- TypeScript,
- PostgreSQL,
- Prisma,
- Google Calendar API,
- provider platnosci obslugiwany przez warstwe abstrakcji,
- panel admina,
- wysylka e-maili.

Przygotuj:
- strukture katalogow,
- nazwy glownych plikow,
- podzial na warstwy: UI, API, services, database, integrations,
- miejsce na integracje Google Calendar,
- miejsce na integracje platnosci,
- miejsce na szablony e-mail,
- miejsce na panel admina.

Nie pisz jeszcze pelnej implementacji. Przygotuj czytelny szkielet projektu.

---

## Prompt 3 - Prisma schema i modele danych

Przygotuj plik Prisma schema dla aplikacji rezerwacji apartamentu.

Modele wymagane:
- Apartment,
- Guest,
- Reservation,
- Payment,
- PricingRule,
- CalendarBlock,
- EmailLog,
- AppSetting,
- AdminUser opcjonalnie.

Wymagania:
- aplikacja ma byc gotowa na wiele apartamentow, nawet jezeli na start bedzie jeden,
- Reservation musi przechowywac date przyjazdu, date wyjazdu, liczbe nocy, liczbe gosci, kwoty, statusy i ID wydarzenia w Google Calendar,
- Payment musi przechowywac link platnosci, token, status, kwote, walute, date wygasniecia i provider payment id,
- Guest musi przechowywac dane osoby rezerwujacej,
- PricingRule musi pozwalac na ceny sezonowe, weekendowe i minimalna liczbe nocy,
- CalendarBlock musi przechowywac reczne blokady terminow,
- EmailLog ma zapisywac wyslane wiadomosci.

Zadbaj o:
- relacje pomiedzy tabelami,
- enumy statusow,
- indeksy pod sprawdzanie dostepnosci,
- pola createdAt i updatedAt,
- czytelne nazwy pol.

Po przygotowaniu schematu wyjasnij krotko role kazdego modelu.

---

## Prompt 4 - logika dostepnosci terminu

Zaimplementuj logike sprawdzania dostepnosci terminu.

Wymagania:
- termin jest zajety, jezeli istnieje Reservation ze statusem pending_payment, confirmed albo manual_block, ktora nachodzi na wybrany zakres dat,
- termin jest zajety, jezeli istnieje CalendarBlock nachodzacy na wybrany zakres dat,
- dodatkowo system moze sprawdzac Google Calendar,
- check_out_date nie liczy sie jako noc,
- zakres nachodzi na siebie wedlug warunku:
  existing.checkInDate < requested.checkOutDate AND existing.checkOutDate > requested.checkInDate

Przygotuj:
- funkcje checkAvailability(apartmentId, checkInDate, checkOutDate),
- walidacje dat,
- obsluge bledow,
- testy jednostkowe dla przypadkow granicznych.

Przypadki testowe:
1. Ten sam termin jest zajety.
2. Nowa rezerwacja zaczyna sie w dniu wyjazdu poprzedniej - powinna byc dozwolona.
3. Nowa rezerwacja konczy sie w dniu przyjazdu kolejnej - powinna byc dozwolona.
4. Rezerwacja czesciowo nachodzi - powinna byc zablokowana.
5. Rezerwacja calkowicie obejmuje inna - powinna byc zablokowana.
6. Rezerwacje cancelled i expired nie blokuja terminu.

---

## Prompt 5 - kalkulacja ceny

Zaimplementuj kalkulacje ceny rezerwacji.

Wymagania:
- liczba nocy = checkOutDate - checkInDate,
- cena bazowa pochodzi z Apartment.basePricePerNight,
- PricingRule moze nadpisac cene za noc w okreslonym zakresie dat,
- weekendy moga miec inna cene, jezeli istnieje odpowiednia regula,
- do sumy doliczana jest oplata za sprzatanie,
- kaucja zwrotna ma byc liczona osobno,
- kwota do zaplaty teraz moze byc procentem calosci albo stala kwota minimalna.

Przygotuj funkcje calculateReservationPrice(input), ktora zwroci:
- nightsCount,
- nightlyBreakdown,
- accommodationAmount,
- cleaningFee,
- depositAmount,
- discountAmount,
- totalAmount,
- amountToPayNow,
- currency.

Dodaj testy dla:
- zwyklej ceny bazowej,
- ceny sezonowej,
- weekendu,
- oplaty sprzatajacej,
- zaliczki procentowej,
- minimalnej kwoty zaliczki.

---

## Prompt 6 - tworzenie rezerwacji online

Zaimplementuj endpoint/API action do tworzenia rezerwacji online przez klienta.

Flow:
1. Przyjmij dane: apartmentId, checkInDate, checkOutDate, guestsCount, dane klienta, zgody.
2. Zweryfikuj poprawnosci dat i danych klienta.
3. Sprawdz dostepnosc terminu.
4. Wylicz cene.
5. Utworz albo znajdz Guest po e-mail/telefonie.
6. Utworz Reservation ze statusem pending_payment i source = website.
7. Utworz Payment ze statusem created.
8. Wygeneruj bezpieczny payment token.
9. Utworz link do strony /pay/[token].
10. Utworz tymczasowe wydarzenie w Google Calendar.
11. Zwroc klientowi paymentUrl oraz podsumowanie rezerwacji.

Wymagania bezpieczenstwa:
- sprawdzenie dostepnosci i utworzenie rezerwacji powinno byc odporne na race condition,
- token platnosci nie moze byc latwy do odgadniecia,
- nie tworz confirmed bez potwierdzonej platnosci z webhooka.

---

## Prompt 7 - reczne tworzenie rezerwacji przez admina

Zaimplementuj funkcje recznego tworzenia rezerwacji przez administratora.

Flow:
1. Administrator wybiera apartament, daty i liczbe gosci.
2. Administrator wpisuje dane klienta.
3. System sprawdza dostepnosc terminu.
4. System wylicza cene.
5. Administrator moze zmienic kwote, dodac rabat albo notatke.
6. System tworzy Reservation ze statusem pending_payment i source = manual/phone/email.
7. System tworzy Payment z linkiem do platnosci.
8. System tworzy blokade w Google Calendar.
9. Administrator moze skopiowac link platnosci albo wyslac go e-mailem.

Dodaj endpointy:
- POST /api/admin/reservations
- POST /api/admin/reservations/[id]/send-payment-link
- POST /api/admin/reservations/[id]/regenerate-payment-link
- POST /api/admin/reservations/[id]/cancel

Dodaj widok admina do utworzenia takiej rezerwacji.

---

## Prompt 8 - strona platnosci /pay/[token]

Zaimplementuj publiczna strone /pay/[token].

Strona ma:
- odczytac Payment po tokenie,
- sprawdzic czy link istnieje,
- sprawdzic czy link nie wygasl,
- sprawdzic status platnosci i rezerwacji,
- pokazac podsumowanie rezerwacji,
- pokazac dane apartamentu,
- pokazac termin pobytu,
- pokazac liczbe nocy,
- pokazac kwote calkowita i kwote do zaplaty teraz,
- pokazac przycisk Zaplac teraz.

Stany strony:
1. Link aktywny - pokaz podsumowanie i przycisk platnosci.
2. Link wygasl - pokaz komunikat i kontakt do obslugi.
3. Rezerwacja juz oplacona - pokaz potwierdzenie.
4. Rezerwacja anulowana - pokaz komunikat.
5. Platnosc nieudana - pozwol sprobowac ponownie, jezeli link jest wazny.

---

## Prompt 9 - integracja z providerem platnosci

Przygotuj warstwe integracji platnosci jako abstrakcje, aby mozna bylo podmienic providera.

Na start przygotuj interfejs PaymentProvider:
- createPayment(input),
- getPaymentStatus(providerPaymentId),
- handleWebhook(payload, headers),
- refundPayment(providerPaymentId) opcjonalnie.

System ma obslugiwac:
- utworzenie platnosci,
- wygenerowanie paymentUrl,
- zapis providerPaymentId,
- odbior webhooka,
- weryfikacje podpisu webhooka,
- zmiane Payment.status na paid,
- zmiane Reservation.status na confirmed,
- aktualizacje Google Calendar,
- wyslanie e-maila potwierdzajacego.

Nie potwierdzaj rezerwacji na podstawie samego powrotu klienta ze strony platnosci. Potwierdzaj tylko na podstawie zweryfikowanego webhooka.

---

## Prompt 10 - Google Calendar service

Zaimplementuj service do integracji z Google Calendar.

Funkcje:
- getCalendarEvents(apartmentId, dateFrom, dateTo),
- createPendingReservationEvent(reservationId),
- confirmReservationEvent(reservationId),
- cancelReservationEvent(reservationId),
- createManualBlock(apartmentId, dateFrom, dateTo, reason),
- deleteCalendarEvent(calendarEventId).

Wydarzenie pending_payment:
Tytul: [OCZEKUJE NA PLATNOSC] Imie Nazwisko | liczba nocy | kwota

Wydarzenie confirmed:
Tytul: [POTWIERDZONA] Imie Nazwisko | liczba nocy | kwota

Opis wydarzenia:
- ID rezerwacji,
- dane klienta,
- telefon,
- e-mail,
- liczba gosci,
- termin,
- kwota,
- status platnosci,
- zrodlo rezerwacji.

Pamietaj:
- Google Calendar nie jest glowna baza danych,
- calendarEventId zapisz w Reservation,
- bledy Google Calendar loguj, ale nie niszcz danych rezerwacji.

---

## Prompt 11 - wysylka e-maili

Zaimplementuj system wysylki e-maili.

Wymagane typy wiadomosci:
1. Link do platnosci.
2. Potwierdzenie rezerwacji po platnosci.
3. Przypomnienie przed przyjazdem.
4. Informacja o anulowaniu rezerwacji.
5. Powiadomienie do administratora o nowej rezerwacji.

Na start zrob:
- template payment-link-email,
- template reservation-confirmed-email,
- EmailService,
- EmailLog zapisujacy kazda probe wysylki.

Szablon linku platnosci powinien zawierac:
- imie klienta,
- termin pobytu,
- liczbe nocy,
- liczbe gosci,
- kwote calkowita,
- kwote do zaplaty teraz,
- termin waznosci linku,
- przycisk Zaplac teraz,
- dane kontaktowe obslugi.

---

## Prompt 12 - panel administratora

Zaimplementuj panel administratora.

Widoki:
1. Dashboard.
2. Lista rezerwacji.
3. Szczegoly rezerwacji.
4. Dodaj rezerwacje recznie.
5. Kalendarz/blokady terminow.
6. Cennik.
7. Ustawienia apartamentu.

Lista rezerwacji ma pokazywac:
- numer rezerwacji,
- klienta,
- termin,
- liczbe nocy,
- kwote,
- status rezerwacji,
- status platnosci,
- zrodlo,
- akcje.

Akcje:
- podglad,
- wyslij link do platnosci,
- kopiuj link,
- potwierdz recznie,
- anuluj,
- odswiez status platnosci,
- aktualizuj Google Calendar.

---

## Prompt 13 - cron do wygaslych platnosci

Zaimplementuj zadanie cykliczne czyszczace wygasle rezerwacje.

Wymagania:
- znajdz rezerwacje pending_payment, ktorych holdExpiresAt juz minal,
- jezeli platnosc nie jest paid, ustaw Reservation.status = expired,
- ustaw Payment.status = expired,
- usun albo oznacz wydarzenie w Google Calendar jako wygasle,
- zapisz log operacji.

Uwzglednij:
- rezerwacje online moga miec krotki hold, np. 15 minut,
- rezerwacje reczne moga miec dluzszy hold, np. 24 godziny,
- zadanie powinno byc idempotentne.

---

## Prompt 14 - testy i zabezpieczenia

Dodaj testy i zabezpieczenia dla krytycznych flow.

Testy wymagane:
- sprawdzanie dostepnosci,
- kalkulacja ceny,
- tworzenie rezerwacji online,
- tworzenie rezerwacji recznej,
- wygasniecie linku platnosci,
- potwierdzenie webhooka,
- anulowanie rezerwacji,
- aktualizacja Google Calendar.

Zabezpieczenia:
- walidacja danych wejscowych,
- tokeny platnosci trudne do odgadniecia,
- webhook z weryfikacja podpisu,
- brak potwierdzania rezerwacji bez webhooka,
- ochrona panelu admina,
- logowanie bledow integracji.

---

## Prompt 15 - finalny przeglad MVP

Przeprowadz przeglad kodu MVP aplikacji rezerwacji apartamentu.

Sprawdz:
- czy baza danych jest spojna,
- czy nie mozna zrobic podwojnej rezerwacji,
- czy Google Calendar jest aktualizowany poprawnie,
- czy platnosc potwierdza rezerwacje tylko przez webhook,
- czy link do platnosci moze wygasnac,
- czy panel admina ma potrzebne akcje,
- czy e-maile sa wysylane i logowane,
- czy statusy rezerwacji i platnosci sa spojne,
- czy aplikacja jest gotowa na wiecej niz jeden apartament.

Na koniec wypisz:
- co jest gotowe,
- co wymaga poprawy,
- ryzyka,
- sugerowana kolejnosc kolejnych prac.
