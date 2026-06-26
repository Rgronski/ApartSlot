import { Prisma } from "@prisma/client";
import { Buffer } from "node:buffer";

import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors/domain-error";

export type ApartmentImage = {
  id: string;
  apartmentId: string;
  imageUrl: string;
  storagePath: string | null;
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

type UploadApartmentImageInput = Omit<CreateApartmentImageInput, "imageUrl"> & {
  imageFile: File;
};

const DEFAULT_BUCKET_NAME = "apartment-images";
const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function getSupabaseStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucketName = process.env.SUPABASE_APARTMENT_IMAGES_BUCKET?.trim() || DEFAULT_BUCKET_NAME;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new DomainError(
      "SUPABASE_STORAGE_NOT_CONFIGURED",
      "Brakuje konfiguracji wysylania zdjec. Dodaj w Vercel SUPABASE_URL oraz SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return {
    bucketName,
    serviceRoleKey,
    supabaseUrl,
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function getFileExtension(file: File) {
  if (file.type === "image/jpeg") {
    return "jpg";
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return null;
}

function normalizeStorageFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function uploadFileToSupabaseStorage(input: {
  apartmentId: string;
  imageFile: File;
}) {
  const fileExtension = getFileExtension(input.imageFile);

  if (!fileExtension || !ALLOWED_IMAGE_TYPES.has(input.imageFile.type)) {
    throw new DomainError(
      "INVALID_APARTMENT_IMAGE",
      "Zdjecie musi byc plikiem JPG, PNG albo WEBP.",
    );
  }

  if (input.imageFile.size <= 0) {
    throw new DomainError("INVALID_APARTMENT_IMAGE", "Wybierz zdjecie do wyslania.");
  }

  if (input.imageFile.size > MAX_IMAGE_SIZE_BYTES) {
    throw new DomainError(
      "INVALID_APARTMENT_IMAGE",
      "Zdjecie jest za duze. Maksymalny rozmiar to 6 MB.",
    );
  }

  const { bucketName, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const safeOriginalName = normalizeStorageFilename(input.imageFile.name) || "zdjecie";
  const storagePath = `${input.apartmentId}/${Date.now()}-${safeOriginalName}.${fileExtension}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}/${encodeStoragePath(storagePath)}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": input.imageFile.type,
      "x-upsert": "false",
    },
    body: Buffer.from(await input.imageFile.arrayBuffer()),
  });

  if (!uploadResponse.ok) {
    throw new DomainError(
      "SUPABASE_STORAGE_UPLOAD_FAILED",
      "Nie udalo sie wyslac zdjecia do Supabase Storage. Sprawdz bucket apartment-images i klucze w Vercel.",
    );
  }

  return {
    imageUrl: `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucketName)}/${encodeStoragePath(storagePath)}`,
    storagePath,
  };
}

async function deleteFileFromSupabaseStorage(storagePath: string | null) {
  if (!storagePath) {
    return;
  }

  const { bucketName, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const deleteResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}`,
    {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefixes: [storagePath],
      }),
    },
  );

  if (!deleteResponse.ok) {
    console.error("Supabase Storage delete failed", await deleteResponse.text());
  }
}

function isMissingImagesTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" ||
      (error.code === "P2010" && String(error.meta?.code ?? "") === "42P01"))
  );
}

function isMissingStoragePathColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    String(error.meta?.code ?? "") === "42703"
  );
}

export async function getApartmentImages() {
  try {
    return await prisma.$queryRaw<ApartmentImage[]>`
      select
        id::text as "id",
        apartment_id::text as "apartmentId",
        image_url as "imageUrl",
        storage_path as "storagePath",
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

    if (isMissingStoragePathColumnError(error)) {
      return await prisma.$queryRaw<ApartmentImage[]>`
        select
          id::text as "id",
          apartment_id::text as "apartmentId",
          image_url as "imageUrl",
          null as "storagePath",
          alt_text as "altText",
          display_order as "displayOrder",
          is_cover as "isCover",
          created_at as "createdAt"
        from apartment_images
        order by display_order asc, created_at asc
      `;
    }

    throw error;
  }
}

async function saveApartmentImage(input: CreateApartmentImageInput & { storagePath?: string | null }) {
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
        storage_path,
        alt_text,
        display_order,
        is_cover
      )
      values (
        cast(${apartmentId} as uuid),
        ${imageUrl},
        ${normalizeText(input.storagePath ?? undefined)},
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

    if (isMissingStoragePathColumnError(error)) {
      throw new DomainError(
        "APARTMENT_IMAGES_TABLE_MISSING",
        "Tabela zdjec wymaga aktualizacji. Wykonaj ponownie SQL z pliku docs/sql/add-apartment-images.sql.",
      );
    }

    throw error;
  }
}

export async function createApartmentImage(input: CreateApartmentImageInput) {
  await saveApartmentImage(input);
}

export async function uploadApartmentImage(input: UploadApartmentImageInput) {
  const apartmentId = input.apartmentId.trim();

  if (!apartmentId) {
    throw new DomainError("INVALID_APARTMENT_IMAGE", "Wybierz apartament dla zdjecia.");
  }

  const uploadResult = await uploadFileToSupabaseStorage({
    apartmentId,
    imageFile: input.imageFile,
  });

  try {
    await saveApartmentImage({
      apartmentId,
      imageUrl: uploadResult.imageUrl,
      storagePath: uploadResult.storagePath,
      altText: input.altText,
      displayOrder: input.displayOrder,
      isCover: input.isCover,
    });
  } catch (error) {
    await deleteFileFromSupabaseStorage(uploadResult.storagePath);
    throw error;
  }
}

export async function deleteApartmentImage(imageId: string) {
  const normalizedImageId = imageId.trim();

  if (!normalizedImageId) {
    throw new DomainError("INVALID_APARTMENT_IMAGE", "Brakuje identyfikatora zdjecia.");
  }

  try {
    let currentImages: Array<{ storagePath: string | null }> = [];

    try {
      currentImages = await prisma.$queryRaw<Array<{ storagePath: string | null }>>`
        select storage_path as "storagePath"
        from apartment_images
        where id = cast(${normalizedImageId} as uuid)
        limit 1
      `;
    } catch (error) {
      if (!isMissingStoragePathColumnError(error)) {
        throw error;
      }
    }

    await prisma.$executeRaw`
      delete from apartment_images
      where id = cast(${normalizedImageId} as uuid)
    `;

    await deleteFileFromSupabaseStorage(currentImages[0]?.storagePath ?? null);
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
