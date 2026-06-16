import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

export async function deleteCalendarBlock(calendarBlockId: string) {
  const normalizedId = calendarBlockId.trim();

  if (!normalizedId) {
    throw new DomainError("INVALID_CALENDAR_BLOCK", "Brakuje identyfikatora blokady.");
  }

  return prisma.calendarBlock.delete({
    where: {
      id: normalizedId,
    },
  });
}
