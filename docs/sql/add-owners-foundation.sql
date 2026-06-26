create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table apartments
  add column if not exists owner_id uuid references owners(id) on delete set null;

create index if not exists apartments_owner_id_idx on apartments(owner_id);
create index if not exists owners_email_idx on owners(email);

insert into owners (name, username, email)
values ('Domyslny wlasciciel', 'default-owner', null)
on conflict (username) do nothing;

update apartments
set owner_id = (
  select id
  from owners
  where username = 'default-owner'
  limit 1
)
where owner_id is null;
