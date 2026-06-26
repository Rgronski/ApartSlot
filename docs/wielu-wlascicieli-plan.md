# ApartSlot jako aplikacja dla wielu wlascicieli

Cel biznesowy:
- ApartSlot ma byc programem, z ktorego moze korzystac wielu wlascicieli apartamentow.
- Kazdy wlasciciel powinien docelowo widziec tylko swoje apartamenty, rezerwacje, platnosci i ustawienia.

## Etap 1: fundament danych

Dodajemy pojecie wlasciciela:

- tabela `owners`
- pole `apartments.owner_id`

To pozwala przypisac apartament do osoby lub firmy, bez przebudowywania calego systemu logowania od razu.

## Dlaczego nie tylko `nazwa_uzytkownika` w apartamencie

Sama nazwa uzytkownika jest tekstem i moze sie zmienic albo powtorzyc.

Bezpieczniejszy model:

```text
Owner
- id
- name
- username
- email

Apartment
- owner_id
- name
- city
- ceny
```

`owner_id` jest staly i jednoznacznie laczy apartament z wlascicielem.

## Etap 2: panel wlasciciela

Nastepnie panel admina powinien zaczac filtrowac dane po wlascicielu:

- apartamenty danego wlasciciela,
- jego rezerwacje,
- jego platnosci,
- jego kalendarze Google.

## Etap 3: logowanie

Docelowo trzeba dodac logowanie, aby system wiedzial:

- kto jest zalogowany,
- do ktorego wlasciciela nalezy,
- jakie dane moze zobaczyc.

## Etap 4: osobne integracje

W kolejnym kroku kazdy wlasciciel powinien miec swoje ustawienia:

- Mollie,
- Google Calendar,
- Resend,
- dane firmy,
- regulamin i wiadomosci.

## Bezpieczna migracja

Plik SQL:

- `docs/sql/add-owners-foundation.sql`

Tworzy domyslnego wlasciciela i przypisuje do niego istniejace apartamenty.
