create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum (
      'DRAFT',
      'PENDING_PAYMENT',
      'CONFIRMED',
      'CANCELLED',
      'EXPIRED',
      'MANUAL_BLOCK',
      'COMPLETED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'CREATED',
      'LINK_SENT',
      'PENDING',
      'PAID',
      'FAILED',
      'CANCELLED',
      'EXPIRED',
      'REFUNDED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_source') then
    create type reservation_source as enum (
      'WEBSITE',
      'ADMIN',
      'PHONE',
      'EMAIL',
      'MESSENGER',
      'WHATSAPP',
      'BOOKING',
      'AIRBNB',
      'MANUAL',
      'OTHER'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type payment_provider as enum (
      'MOLLIE',
      'STRIPE',
      'PRZELEWY24',
      'PAYU',
      'TPAY',
      'MANUAL_TRANSFER',
      'OTHER'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'pricing_rule_type') then
    create type pricing_rule_type as enum (
      'SEASONAL',
      'WEEKEND',
      'EVENT',
      'CUSTOM'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'email_log_status') then
    create type email_log_status as enum (
      'PENDING',
      'SENT',
      'FAILED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_user_role') then
    create type admin_user_role as enum (
      'ADMIN',
      'MANAGER',
      'STAFF'
    );
  end if;
end
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists apartments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  city text,
  description text,
  max_guests integer not null,
  base_price_per_night numeric(10, 2) not null,
  cleaning_fee numeric(10, 2) not null,
  deposit_amount numeric(10, 2) not null,
  currency text not null default 'PLN',
  minimum_nights integer not null default 1,
  default_check_in_time text,
  default_check_out_time text,
  google_calendar_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  country text,
  city text,
  language text default 'pl',
  marketing_consent boolean not null default false,
  terms_accepted boolean not null default false,
  rodo_accepted boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_number text not null unique,
  apartment_id uuid not null references apartments(id) on delete restrict,
  guest_id uuid not null references guests(id) on delete restrict,
  check_in_date date not null,
  check_out_date date not null,
  nights_count integer not null,
  guests_count integer not null,
  price_per_night numeric(10, 2) not null,
  accommodation_amount numeric(10, 2) not null,
  cleaning_fee numeric(10, 2) not null,
  deposit_amount numeric(10, 2) not null,
  discount_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null,
  amount_to_pay_now numeric(10, 2) not null,
  paid_amount numeric(10, 2) not null default 0,
  currency text not null default 'PLN',
  status reservation_status not null default 'DRAFT',
  payment_status payment_status not null default 'CREATED',
  source reservation_source not null default 'WEBSITE',
  created_by_type text not null default 'customer',
  calendar_event_id text,
  hold_expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  customer_notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  provider payment_provider not null default 'MOLLIE',
  provider_payment_id text,
  payment_token text not null unique,
  payment_url text,
  amount numeric(10, 2) not null,
  currency text not null default 'PLN',
  status payment_status not null default 'CREATED',
  payment_expires_at timestamptz,
  payment_link_sent_at timestamptz,
  payment_link_sent_to text,
  payment_link_opened_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  raw_webhook_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  name text not null,
  rule_type pricing_rule_type not null default 'CUSTOM',
  date_from date not null,
  date_to date not null,
  price_per_night numeric(10, 2) not null,
  minimum_nights integer,
  days_of_week jsonb,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  reason text,
  calendar_event_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id) on delete set null,
  guest_id uuid references guests(id) on delete set null,
  type text not null,
  recipient_email text not null,
  subject text not null,
  status email_log_status not null default 'PENDING',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  type text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role admin_user_role not null default 'ADMIN',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apartments_is_active_idx on apartments(is_active);
create index if not exists guests_email_idx on guests(email);
create index if not exists guests_phone_idx on guests(phone);
create index if not exists reservations_apartment_check_dates_idx on reservations(apartment_id, check_in_date, check_out_date);
create index if not exists reservations_status_idx on reservations(status);
create index if not exists reservations_payment_status_idx on reservations(payment_status);
create index if not exists reservations_hold_expires_at_idx on reservations(hold_expires_at);
create index if not exists reservations_source_idx on reservations(source);
create index if not exists payments_reservation_id_idx on payments(reservation_id);
create index if not exists payments_provider_payment_id_idx on payments(provider_payment_id);
create index if not exists payments_status_idx on payments(status);
create index if not exists payments_payment_expires_at_idx on payments(payment_expires_at);
create index if not exists pricing_rules_apartment_dates_idx on pricing_rules(apartment_id, date_from, date_to);
create index if not exists pricing_rules_is_active_idx on pricing_rules(is_active);
create index if not exists pricing_rules_priority_idx on pricing_rules(priority);
create index if not exists calendar_blocks_apartment_dates_idx on calendar_blocks(apartment_id, date_from, date_to);
create index if not exists email_logs_reservation_id_idx on email_logs(reservation_id);
create index if not exists email_logs_guest_id_idx on email_logs(guest_id);
create index if not exists email_logs_status_idx on email_logs(status);
create index if not exists admin_users_role_idx on admin_users(role);
create index if not exists admin_users_is_active_idx on admin_users(is_active);

drop trigger if exists apartments_set_updated_at on apartments;
create trigger apartments_set_updated_at
before update on apartments
for each row execute function set_updated_at();

drop trigger if exists guests_set_updated_at on guests;
create trigger guests_set_updated_at
before update on guests
for each row execute function set_updated_at();

drop trigger if exists reservations_set_updated_at on reservations;
create trigger reservations_set_updated_at
before update on reservations
for each row execute function set_updated_at();

drop trigger if exists payments_set_updated_at on payments;
create trigger payments_set_updated_at
before update on payments
for each row execute function set_updated_at();

drop trigger if exists pricing_rules_set_updated_at on pricing_rules;
create trigger pricing_rules_set_updated_at
before update on pricing_rules
for each row execute function set_updated_at();

drop trigger if exists calendar_blocks_set_updated_at on calendar_blocks;
create trigger calendar_blocks_set_updated_at
before update on calendar_blocks
for each row execute function set_updated_at();

drop trigger if exists email_logs_set_updated_at on email_logs;
create trigger email_logs_set_updated_at
before update on email_logs
for each row execute function set_updated_at();

drop trigger if exists app_settings_set_updated_at on app_settings;
create trigger app_settings_set_updated_at
before update on app_settings
for each row execute function set_updated_at();

drop trigger if exists admin_users_set_updated_at on admin_users;
create trigger admin_users_set_updated_at
before update on admin_users
for each row execute function set_updated_at();
