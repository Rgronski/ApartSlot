import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

export type CreateOwnerInput = {
  name: string;
  username?: string;
  email?: string;
  phone?: string;
};

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createOwner(input: CreateOwnerInput) {
  const name = input.name.trim();

  if (!name) {
    throw new DomainError("INVALID_OWNER_DATA", "Nazwa wlasciciela jest wymagana.");
  }

  const username = slugify(input.username?.trim() || name);

  if (!username) {
    throw new DomainError(
      "INVALID_OWNER_DATA",
      "Nie udalo sie zbudowac poprawnego loginu wlasciciela.",
    );
  }

  try {
    return await prisma.owner.create({
      data: {
        name,
        username,
        email: normalizeText(input.email),
        phone: normalizeText(input.phone),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DomainError(
        "OWNER_USERNAME_TAKEN",
        "Taki login wlasciciela juz istnieje. Wybierz inny login.",
      );
    }

    throw error;
  }
}
