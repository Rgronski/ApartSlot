import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

export async function deletePricingRule(pricingRuleId: string) {
  const normalizedId = pricingRuleId.trim();

  if (!normalizedId) {
    throw new DomainError("INVALID_PRICING_RULE", "Brakuje identyfikatora reguly cenowej.");
  }

  return prisma.pricingRule.update({
    where: {
      id: normalizedId,
    },
    data: {
      isActive: false,
    },
  });
}
