import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

export type ApartmentImage = {
  id: string;
  apartmentId: string;
  imageUrl: string;
  altText: string | null;
  displayOrder: number;
  isCover: boolean;
  createdAt: Date;
};

type CreateApartmentImageInput = {
  apartmentId: string;
  imageUrl: string;
  altText?: string;
  displayOrder?: number;
  isCover?: boolean;
};

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isMissingImagesTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" ||
      (error.code === "P2010" && String(error.meta?.code ?? "") === "42P01"))
  );
}

export async function getApartmentImages() {
  try {
    return await prisma.$queryRaw<ApartmentImage[]>`
      select
        id::text as "id",
        apartment_id::text as "apartmentId",
        image_url as "imageUrl",
        alt_text as "altText",
        display_order as "displayOrder",
        is_cover as "isCover",
        created_at as "createdAt"
      from apartment_images
      order by display_order asc, created_at asc
    `;
  } catch (error) {
    if (isMissingImagesTableError(error)) {
      return [];
    }

    throw error;
  }
}

export async function createApartmentImage(input: CreateApartmentImageInput) {
  const apartmentId = input.apartmentId.trim();
  const imageUrl = input.imageUrl.trim();
  const displayOrder = input.displayOrder ?? 0;

  if (!apartmentId) {
    throw new DomainError("INVALID_APARTMENT_IMAGE", "Wybierz apartament dla zdjecia.");
  }

  if (!imageUrl || !validateUrl(imageUrl)) {
    throw new DomainError(
      "INVALID_APARTMENT_IMAGE",
      "Wklej poprawny link do zdjecia zaczynajacy sie od http lub https.",
    );
  }

  if (!Number.isFinite(displayOrder)) {
    throw new DomainError("INVALID_APARTMENT_IMAGE", "Kolejnosc zdjecia musi byc liczba.");
  }

  try {
    if (input.isCover) {
      await prisma.$executeRaw`
        update apartment_images
        set is_cover = false
        where apartment_id = cast(${apartmentId} as uuid)
      `;
    }

    await prisma.$executeRaw`
      insert into apartment_images (
        apartment_id,
        image_url,
        alt_text,
        display_order,
        is_cover
      )
      values (
        cast(${apartmentId} as uuid),
        ${imageUrl},
        ${normalizeText(input.altText)},
        ${Math.round(displayOrder)},
        ${Boolean(input.isCover)}
      )
    `;
  } catch (error) {
    if (isMissingImagesTableError(error)) {
      throw new DomainError(
        "APARTMENT_IMAGES_TABLE_MISSING",
        "Brakuje tabeli zdjec w Supabase. Wykonaj SQL z pliku docs/sql/add-apartment-images.sql.",
      );
    }

    throw error;
  }
}

export async function deleteApartmentImage(imageId: string) {
  const normalizedImageId = imageId.trim();

  if (!normalizedImageId) {
    throw new DomainError("INVALID_APARTMENT_IMAGE", "Brakuje identyfikatora zdjecia.");
  }

  try {
    await prisma.$executeRaw`
      delete from apartment_images
      where id = cast(${normalizedImageId} as uuid)
    `;
  } catch (error) {
    if (isMissingImagesTableError(error)) {
      throw new DomainError(
        "APARTMENT_IMAGES_TABLE_MISSING",
        "Brakuje tabeli zdjec w Supabase. Wykonaj SQL z pliku docs/sql/add-apartment-images.sql.",
      );
    }

    throw error;
  }
}
