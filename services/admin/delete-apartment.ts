import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

export async function deleteApartment(apartmentId: string) {
  const normalizedApartmentId = apartmentId.trim();

  if (!normalizedApartmentId) {
    throw new DomainError("INVALID_APARTMENT_ID", "Brakuje identyfikatora apartamentu.");
  }

  const apartment = await prisma.apartment.findUnique({
    where: {
      id: normalizedApartmentId,
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          reservations: true,
          pricingRules: true,
          calendarBlocks: true,
        },
      },
    },
  });

  if (!apartment) {
    throw new DomainError("APARTMENT_NOT_FOUND", "Nie znaleziono apartamentu do usuniecia.");
  }

  if (apartment._count.reservations > 0) {
    throw new DomainError(
      "APARTMENT_HAS_RESERVATIONS",
      "Nie mozna usunac tego apartamentu, bo ma juz zapisane rezerwacje. Najpierw trzeba je zakonczyc lub anulowac.",
    );
  }

  await prisma.$transaction([
    prisma.pricingRule.deleteMany({
      where: {
        apartmentId: normalizedApartmentId,
      },
    }),
    prisma.calendarBlock.deleteMany({
      where: {
        apartmentId: normalizedApartmentId,
      },
    }),
    prisma.apartment.delete({
      where: {
        id: normalizedApartmentId,
      },
    }),
  ]);

  return {
    deletedApartmentName: apartment.name,
    deletedPricingRules: apartment._count.pricingRules,
    deletedCalendarBlocks: apartment._count.calendarBlocks,
  };
}
