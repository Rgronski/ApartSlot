import { describe, expect, it } from "vitest";

import { DomainError } from "@/lib/errors/domain-error";
import { calculateReservationPrice } from "@/services/pricing";

const apartmentId = "apt-1";

describe("calculateReservationPrice", () => {
  it("liczy zwykla cene bazowa", () => {
    const result = calculateReservationPrice({
      apartmentId,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-13",
      basePricePerNight: 350,
      cleaningFee: 150,
      depositAmount: 500,
      currency: "PLN",
    });

    expect(result.nightsCount).toBe(3);
    expect(result.accommodationAmount).toBe(1050);
    expect(result.totalAmount).toBe(1700);
    expect(result.amountToPayNow).toBe(1700);
  });

  it("stosuje cene sezonowa", () => {
    const result = calculateReservationPrice({
      apartmentId,
      checkInDate: "2026-08-10",
      checkOutDate: "2026-08-13",
      basePricePerNight: 350,
      cleaningFee: 150,
      depositAmount: 500,
      currency: "PLN",
      pricingRules: [
        {
          id: "rule-summer",
          apartmentId,
          name: "Wakacje",
          ruleType: "SEASONAL",
          dateFrom: "2026-08-01",
          dateTo: "2026-08-31",
          pricePerNight: 450,
          priority: 10,
          isActive: true,
        },
      ],
    });

    expect(result.accommodationAmount).toBe(1350);
    expect(result.totalAmount).toBe(2000);
    expect(result.nightlyBreakdown.every((night) => night.pricePerNight === 450)).toBe(true);
  });

  it("stosuje regule weekendowa", () => {
    const result = calculateReservationPrice({
      apartmentId,
      checkInDate: "2026-07-17",
      checkOutDate: "2026-07-20",
      basePricePerNight: 300,
      cleaningFee: 100,
      depositAmount: 0,
      currency: "PLN",
      pricingRules: [
        {
          id: "rule-weekend",
          apartmentId,
          name: "Weekend",
          ruleType: "WEEKEND",
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31",
          pricePerNight: 450,
          daysOfWeek: [5, 6],
          priority: 20,
          isActive: true,
        },
      ],
    });

    expect(result.nightlyBreakdown).toEqual([
      expect.objectContaining({ date: "2026-07-17", pricePerNight: 450 }),
      expect.objectContaining({ date: "2026-07-18", pricePerNight: 450 }),
      expect.objectContaining({ date: "2026-07-19", pricePerNight: 300 }),
    ]);
    expect(result.accommodationAmount).toBe(1200);
  });

  it("dolicza oplate za sprzatanie", () => {
    const result = calculateReservationPrice({
      apartmentId,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-11",
      basePricePerNight: 350,
      cleaningFee: 200,
      depositAmount: 0,
      currency: "PLN",
    });

    expect(result.accommodationAmount).toBe(350);
    expect(result.cleaningFee).toBe(200);
    expect(result.totalAmount).toBe(550);
  });

  it("liczy zaliczke procentowa", () => {
    const result = calculateReservationPrice({
      apartmentId,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-13",
      basePricePerNight: 350,
      cleaningFee: 150,
      depositAmount: 500,
      currency: "PLN",
      depositConfig: {
        type: "percent",
        value: 30,
      },
    });

    expect(result.totalAmount).toBe(1700);
    expect(result.amountToPayNow).toBe(510);
  });

  it("pilnuje minimalnej kwoty zaliczki", () => {
    const result = calculateReservationPrice({
      apartmentId,
      checkInDate: "2026-07-10",
      checkOutDate: "2026-07-11",
      basePricePerNight: 200,
      cleaningFee: 0,
      depositAmount: 0,
      currency: "PLN",
      depositConfig: {
        type: "percent",
        value: 20,
        minimumAmount: 150,
      },
    });

    expect(result.totalAmount).toBe(200);
    expect(result.amountToPayNow).toBe(150);
  });

  it("zwraca blad, gdy regula wymaga wiekszej liczby nocy", () => {
    expect(() =>
      calculateReservationPrice({
        apartmentId,
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-12",
        basePricePerNight: 350,
        cleaningFee: 150,
        depositAmount: 500,
        currency: "PLN",
        pricingRules: [
        {
          id: "rule-long-stay",
          apartmentId,
          name: "Dluzej taniej",
          ruleType: "CUSTOM",
          dateFrom: "2026-08-01",
          dateTo: "2026-08-31",
          pricePerNight: 300,
            minimumNights: 3,
            priority: 10,
            isActive: true,
          },
        ],
      }),
    ).toThrowError(DomainError);
  });

  it("pozwala, aby regula wydarzenia wygrala z regula sezonowa", () => {
    const result = calculateReservationPrice({
      apartmentId,
      checkInDate: "2026-08-15",
      checkOutDate: "2026-08-17",
      basePricePerNight: 350,
      cleaningFee: 100,
      depositAmount: 0,
      currency: "PLN",
      pricingRules: [
        {
          id: "rule-summer",
          apartmentId,
          name: "Wakacje",
          ruleType: "SEASONAL",
          dateFrom: "2026-08-01",
          dateTo: "2026-08-31",
          pricePerNight: 420,
          priority: 10,
          isActive: true,
        },
        {
          id: "rule-event",
          apartmentId,
          name: "Weekend festiwalowy",
          ruleType: "EVENT",
          dateFrom: "2026-08-15",
          dateTo: "2026-08-16",
          pricePerNight: 600,
          priority: 50,
          isActive: true,
        },
      ],
    });

    expect(result.nightlyBreakdown).toEqual([
      expect.objectContaining({
        date: "2026-08-15",
        pricePerNight: 600,
        pricingRuleName: "Weekend festiwalowy",
      }),
      expect.objectContaining({
        date: "2026-08-16",
        pricePerNight: 600,
        pricingRuleName: "Weekend festiwalowy",
      }),
    ]);
    expect(result.accommodationAmount).toBe(1200);
  });
});
