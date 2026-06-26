import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { APP_VERSION } from "@/lib/app-version";
import { buildMonthView } from "@/lib/calendar/month-view";
import { DomainError } from "@/lib/errors/domain-error";
import {
  deleteApartmentImage,
  getApartmentImages,
  uploadApartmentImage,
} from "@/services/admin/apartment-images";
import { getAdminDashboardData } from "@/services/admin/get-admin-dashboard-data";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readNumber(formData: FormData, key: string) {
  const rawValue = readString(formData, key).replace(",", ".");
  return Number(rawValue);
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

type AdminImagesPageProps = {
  searchParams?: Promise<{
    month?: string;
    status?: string;
    message?: string;
  }>;
};

export default async function AdminImagesPage({ searchParams }: AdminImagesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const status = params?.status;
  const message = params?.message;
  const monthCalendar = buildMonthView(params?.month);
  const adminMonthQuery = `month=${encodeURIComponent(monthCalendar.monthParam)}`;
  const dashboard = await getAdminDashboardData({
    monthStart: monthCalendar.monthStart,
    monthEnd: monthCalendar.monthEnd,
  });
  const images = await getApartmentImages();
  const apartments = dashboard.state === "ready" ? dashboard.apartments : [];
  const imagesByApartmentId = new Map<string, typeof images>();

  for (const image of images) {
    const current = imagesByApartmentId.get(image.apartmentId) ?? [];
    current.push(image);
    imagesByApartmentId.set(image.apartmentId, current);
  }

  async function createImageAction(formData: FormData) {
    "use server";

    try {
      const imageFile = formData.get("imageFile");

      if (!(imageFile instanceof File)) {
        throw new DomainError("INVALID_APARTMENT_IMAGE", "Wybierz zdjecie do wyslania.");
      }

      await uploadApartmentImage({
        apartmentId: readString(formData, "apartmentId"),
        imageFile,
        altText: readString(formData, "altText"),
        displayOrder: readNumber(formData, "displayOrder"),
        isCover: readBoolean(formData, "isCover"),
      });
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie zapisac zdjecia. Sprobuj ponownie.";

      redirect(
        `/admin/zdjecia?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`,
      );
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/zdjecia");
    redirect(`/admin/zdjecia?${adminMonthQuery}&status=image_created`);
  }

  async function deleteImageAction(formData: FormData) {
    "use server";

    try {
      await deleteApartmentImage(readString(formData, "imageId"));
    } catch (error) {
      const errorMessage =
        error instanceof DomainError
          ? error.message
          : "Nie udalo sie usunac zdjecia. Sprobuj ponownie.";

      redirect(
        `/admin/zdjecia?${adminMonthQuery}&status=error&message=${encodeURIComponent(errorMessage)}`,
      );
    }

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/zdjecia");
    redirect(`/admin/zdjecia?${adminMonthQuery}&status=image_deleted`);
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Panel administratora</p>
          <p className="version-chip">Wersja {APP_VERSION}</p>
          <h1>Zdjecia apartamentow</h1>
          <p className="lead">
            Tutaj dodajesz zdjecia, ktore klient zobaczy na stronie rezerwacji.
            Wybierz plik z telefonu albo komputera, a system zapisze go przy apartamencie.
          </p>
        </div>
        <div className="admin-hero-note">
          <p>
            Zdjecia sa przypisane do konkretnych apartamentow. Jedno zdjecie mozesz
            oznaczyc jako glowne, a kolejnosc ustalisz liczba.
          </p>
        </div>
      </section>

      <nav className="admin-card admin-section-menu" aria-label="Menu panelu administratora">
        <Link className="admin-section-link" href="/admin">
          Start
        </Link>
        <Link className="admin-section-link" href={`/admin/rezerwacje?${adminMonthQuery}`}>
          Rezerwacje
        </Link>
        <Link className="admin-section-link" href={`/admin/integracje?${adminMonthQuery}`}>
          Integracje
        </Link>
        <Link className="admin-section-link" href={`/admin/wiadomosci?${adminMonthQuery}`}>
          Wiadomosci
        </Link>
        <Link className="admin-section-link" href={`/admin/platnosci?${adminMonthQuery}`}>
          Platnosci
        </Link>
        <Link className="admin-section-link" href={`/admin/apartamenty?${adminMonthQuery}`}>
          Apartamenty
        </Link>
        <Link
          className="admin-section-link admin-section-link--active"
          href={`/admin/zdjecia?${adminMonthQuery}`}
        >
          Zdjecia
        </Link>
        <Link className="admin-section-link" href={`/admin/ustawienia?${adminMonthQuery}`}>
          Ustawienia
        </Link>
      </nav>

      {status === "image_created" ? (
        <div className="inline-notice inline-notice--success">
          <p>Zdjecie zostalo dodane poprawnie.</p>
        </div>
      ) : null}

      {status === "image_deleted" ? (
        <div className="inline-notice inline-notice--success">
          <p>Zdjecie zostalo usuniete.</p>
        </div>
      ) : null}

      {status === "error" && message ? (
        <div className="inline-notice inline-notice--danger">
          <p>{message}</p>
        </div>
      ) : null}

      {dashboard.state !== "ready" ? (
        <section className="admin-card admin-state-card">
          <h2>Zdjecia nie sa jeszcze gotowe do obslugi</h2>
          <p>{dashboard.message}</p>
        </section>
      ) : (
        <>
          <section className="admin-card admin-form-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Nowe zdjecie</p>
                <h2>Dodaj zdjecie apartamentu</h2>
              </div>
            </div>

            <form action={createImageAction} className="admin-form">
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>Apartament</span>
                  <select name="apartmentId" required defaultValue={apartments[0]?.id ?? ""}>
                    {apartments.map((apartment) => (
                      <option key={apartment.id} value={apartment.id}>
                        {apartment.name} | {apartment.ownerName ?? "brak wlasciciela"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-field">
                  <span>Zdjecie z telefonu lub komputera</span>
                  <input
                    name="imageFile"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>

                <label className="admin-field">
                  <span>Opis zdjecia</span>
                  <input
                    name="altText"
                    type="text"
                    placeholder="Np. Salon z aneksem"
                  />
                </label>

                <label className="admin-field">
                  <span>Kolejnosc</span>
                  <input name="displayOrder" type="number" step="1" defaultValue="0" />
                </label>
              </div>

              <label className="admin-toggle">
                <input name="isCover" type="checkbox" />
                <span>Ustaw jako zdjecie glowne tego apartamentu</span>
              </label>

              <div className="admin-form-actions">
                <button className="cta-button" type="submit">
                  Zapisz zdjecie
                </button>
                <p className="admin-form-note">
                  Dozwolone formaty: JPG, PNG i WEBP. Maksymalny rozmiar jednego zdjecia: 6 MB.
                </p>
              </div>
            </form>
          </section>

          <section className="admin-card admin-panel-card admin-page-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Galerie</p>
                <h2>Zdjecia przypisane do apartamentow</h2>
              </div>
            </div>

            <div className="admin-stack">
              {apartments.map((apartment) => {
                const apartmentImages = imagesByApartmentId.get(apartment.id) ?? [];

                return (
                  <article className="admin-row-card" key={apartment.id}>
                    <div className="admin-row-top">
                      <div>
                        <h3>{apartment.name}</h3>
                        <p>{apartment.city ?? "Miasto nieuzupelnione"}</p>
                      </div>
                      <span className="status-badge status-badge--warning">
                        {apartmentImages.length} zdjec
                      </span>
                    </div>

                    {apartmentImages.length === 0 ? (
                      <p className="inline-meta">Ten apartament nie ma jeszcze zdjec.</p>
                    ) : (
                      <div className="admin-image-grid">
                        {apartmentImages.map((image) => (
                          <article className="admin-image-card" key={image.id}>
                            <img
                              alt={image.altText ?? apartment.name}
                              src={image.imageUrl}
                            />
                            <p>{image.altText ?? "Zdjecie apartamentu"}</p>
                            <p className="inline-meta">
                              Kolejnosc: {image.displayOrder}
                              {image.isCover ? " | glowne" : ""}
                            </p>
                            <form action={deleteImageAction}>
                              <input name="imageId" type="hidden" value={image.id} />
                              <button className="cta-button cta-button--danger" type="submit">
                                Usun zdjecie
                              </button>
                            </form>
                          </article>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
