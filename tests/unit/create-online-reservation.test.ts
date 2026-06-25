import { describe, expect, it } from "vitest";

import { DomainError } from "@/lib/errors/domain-error";
import { createOnlineReservation } from "@/services/reservations";

const apartment = {
  id: "apt-1",
  name: "Apartament Morski",
  slug: "apartament-morski",
  maxGuests: 4,
  basePricePerNight: 350,
  cleaningFee: 150,
  depositAmount: 500,
  currency: "PLN",
  minimumNights: 1,
};

const guest = {
  firstName: "Jan",
  lastName: "Nowak",
  email: "jan@example.com",
  phone: "+48 500 600 700",
  termsAccepted: true,
  rodoAccepted: true,
};

describe("createOnlineReservation", () => {
  it("tworzy szkic rezerwacji i platnosci dla wolnego terminu", () => {
    const result = createOnlineReservation({
      apartment,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-13",
      guestsCount: 2,
      guest,
      paymentBaseUrl: "https://rezerwacje.example.com/pay",
      depositConfig: {
        type: "percent",
        value: 30,
      },
      now: new Date("2026-07-01T12:00:00.000Z"),
    });

    expect(result.reservationDraft.status).toBe("PENDING_PAYMENT");
    expect(result.reservationDraft.paymentStatus).toBe("CREATED");
    expect(result.guestResolution.action).toBe("created");
    expect(result.reservationDraft.guestId).toBe(result.guestResolution.guest.id);
    expect(result.paymentDraft.provider).toBe("MOLLIE");
    expect(result.paymentDraft.paymentUrl).toContain("/pay/");
    expect(result.paymentDraft.paymentToken).toHaveLength(64);
    expect(result.summary.amountToPayNow).toBe(510);
  });

  it("wykorzystuje istniejacego goscia po emailu", () => {
    const result = createOnlineReservation({
      apartment,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-13",
      guestsCount: 2,
      guest,
      paymentBaseUrl: "https://rezerwacje.example.com/pay",
      existingGuests: [
        {
          id: "guest-existing",
          firstName: "Jan",
          lastName: "Nowak",
          email: "jan@example.com",
          phone: "+48 111 222 333",
        },
      ],
    });

    expect(result.guestResolution.action).toBe("reused");
    expect(result.reservationDraft.guestId).toBe("guest-existing");
  });

  it("blokuje utworzenie rezerwacji dla zajetego terminu", () => {
    expect(() =>
      createOnlineReservation({
        apartment,
        checkInDate: "2026-07-10",
        checkOutDate: "2026-07-13",
        guestsCount: 2,
        guest,
        paymentBaseUrl: "https://rezerwacje.example.com/pay",
        existingReservations: [
          {
            id: "res-1",
            apartmentId: apartment.id,
            checkInDate: new Date("2026-07-10"),
            checkOutDate: new Date("2026-07-13"),
            status: "CONFIRMED",
          },
        ],
      }),
    ).toThrowError(DomainError);
  });

  it("wymaga zgody na regulamin", () => {
    expect(() =>
      createOnlineReservation({
        apartment,
        checkInDate: "2026-07-10",
        checkOutDate: "2026-07-13",
        guestsCount: 2,
        guest: {
          ...guest,
          termsAccepted: false,
        },
        paymentBaseUrl: "https://rezerwacje.example.com/pay",
      }),
    ).toThrowError(DomainError);
  });

  it("pilnuje maksymalnej liczby gosci", () => {
    expect(() =>
      createOnlineReservation({
        apartment,
        checkInDate: "2026-07-10",
        checkOutDate: "2026-07-13",
        guestsCount: 5,
        guest,
        paymentBaseUrl: "https://rezerwacje.example.com/pay",
      }),
    ).toThrowError(DomainError);
  });
});
