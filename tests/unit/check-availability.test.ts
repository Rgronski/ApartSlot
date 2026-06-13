import { describe, expect, it } from "vitest";

import { DomainError } from "@/lib/errors/domain-error";
import { checkAvailability } from "@/services/availability";

const apartmentId = "apt-1";

describe("checkAvailability", () => {
  it("blokuje ten sam termin", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-13",
      reservations: [
        {
          id: "res-1",
          apartmentId,
          checkInDate: new Date("2026-07-10"),
          checkOutDate: new Date("2026-07-13"),
          status: "CONFIRMED",
        },
      ],
    });

    expect(result.isAvailable).toBe(false);
    expect(result.conflicts).toHaveLength(1);
  });

  it("pozwala zaczac nowa rezerwacje w dniu wyjazdu poprzedniej", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-07-13",
      checkOutDate: "2026-07-16",
      reservations: [
        {
          id: "res-1",
          apartmentId,
          checkInDate: new Date("2026-07-10"),
          checkOutDate: new Date("2026-07-13"),
          status: "CONFIRMED",
        },
      ],
    });

    expect(result.isAvailable).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("pozwala zakonczyc nowa rezerwacje w dniu przyjazdu kolejnej", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-07-07",
      checkOutDate: "2026-07-10",
      reservations: [
        {
          id: "res-1",
          apartmentId,
          checkInDate: new Date("2026-07-10"),
          checkOutDate: new Date("2026-07-13"),
          status: "CONFIRMED",
        },
      ],
    });

    expect(result.isAvailable).toBe(true);
  });

  it("blokuje czesciowe nachodzenie terminu", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-07-12",
      checkOutDate: "2026-07-15",
      reservations: [
        {
          id: "res-1",
          apartmentId,
          checkInDate: new Date("2026-07-10"),
          checkOutDate: new Date("2026-07-13"),
          status: "PENDING_PAYMENT",
        },
      ],
    });

    expect(result.isAvailable).toBe(false);
  });

  it("blokuje termin, ktory calkowicie obejmuje inna rezerwacje", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-07-09",
      checkOutDate: "2026-07-14",
      reservations: [
        {
          id: "res-1",
          apartmentId,
          checkInDate: new Date("2026-07-10"),
          checkOutDate: new Date("2026-07-13"),
          status: "CONFIRMED",
        },
      ],
    });

    expect(result.isAvailable).toBe(false);
  });

  it("ignoruje rezerwacje cancelled i expired", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-13",
      reservations: [
        {
          id: "res-1",
          apartmentId,
          checkInDate: new Date("2026-07-10"),
          checkOutDate: new Date("2026-07-13"),
          status: "CANCELLED",
        },
        {
          id: "res-2",
          apartmentId,
          checkInDate: new Date("2026-07-10"),
          checkOutDate: new Date("2026-07-13"),
          status: "EXPIRED",
        },
      ],
    });

    expect(result.isAvailable).toBe(true);
  });

  it("blokuje reczna blokade kalendarza", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-08-01",
      checkOutDate: "2026-08-03",
      calendarBlocks: [
        {
          id: "block-1",
          apartmentId,
          dateFrom: new Date("2026-08-02"),
          dateTo: new Date("2026-08-05"),
          reason: "Remont",
        },
      ],
    });

    expect(result.isAvailable).toBe(false);
    expect(result.conflicts[0]?.source).toBe("calendar_block");
  });

  it("blokuje termin zajety w Google Calendar", () => {
    const result = checkAvailability({
      apartmentId,
      checkInDate: "2026-08-01",
      checkOutDate: "2026-08-03",
      googleCalendarBusy: true,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.conflicts[0]?.source).toBe("google_calendar");
  });

  it("zwraca blad dla niepoprawnego zakresu dat", () => {
    expect(() =>
      checkAvailability({
        apartmentId,
        checkInDate: "2026-08-03",
        checkOutDate: "2026-08-03",
      }),
    ).toThrowError(DomainError);
  });
});
