create table if not exists public.apartment_images (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  image_url text not null,
  alt_text text,
  display_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apartment_images_apartment_id_idx
  on public.apartment_images(apartment_id);

create index if not exists apartment_images_display_order_idx
  on public.apartment_images(apartment_id, display_order, created_at);

alter table public.apartment_images enable row level security;
