-- Safe Paws schema. Migrations run in order and each runs once (see src/migrate.ts).
-- Ids are text so seed data can keep readable ids ("luna") and new rows use UUIDs.

create table users (
  id            text primary key,
  name          text not null,
  role          text not null check (role in ('coordinator', 'vet', 'fosterer', 'sponsor')),
  title         text not null,
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table animals (
  id            text primary key,
  name          text not null check (length(name) between 1 and 40),
  species       text not null check (species in ('dog', 'cat')),
  sex           text not null check (sex in ('female', 'male')),
  age_value     numeric(6, 2) not null check (age_value > 0),
  age_unit      text not null check (age_unit in ('weeks', 'months', 'years')),
  age_estimated boolean not null,
  neutered      text not null check (neutered in ('yes', 'no', 'unknown')),
  weight_kg     numeric(5, 2) check (weight_kg > 0),
  area          text not null,
  about         text not null default '',
  stage         text not null check (stage in ('reported', 'vet', 'recovering', 'ready', 'adopted')),
  -- Order within the stage's column; 0 is the top.
  position      integer not null,
  updated_at    timestamptz not null default now(),
  updated_by    text references users (id),
  created_at    timestamptz not null default now()
);
create index animals_stage_position on animals (stage, position);

create table animal_followers (
  animal_id text not null references animals (id) on delete cascade,
  user_id   text not null references users (id) on delete cascade,
  primary key (animal_id, user_id)
);

-- Dated updates ("Mange treatment started...").
create table notes (
  id        text primary key,
  animal_id text not null references animals (id) on delete cascade,
  author_id text not null references users (id),
  text      text not null check (length(text) between 1 and 1000),
  at        timestamptz not null default now()
);
create index notes_animal on notes (animal_id, at);

-- Every uploaded file, whether or not it ended up attached to an animal.
create table uploads (
  id          text primary key,
  kind        text not null check (kind in ('photo', 'video')),
  mime_type   text not null,
  name        text not null,
  size_bytes  bigint not null,
  uploaded_by text not null references users (id),
  at          timestamptz not null default now()
);

-- Which uploads belong to which animal, in display order.
create table animal_media (
  animal_id text not null references animals (id) on delete cascade,
  upload_id text not null references uploads (id),
  position  integer not null,
  added_by  text not null references users (id),
  at        timestamptz not null default now(),
  primary key (animal_id, upload_id)
);

create table notifications (
  id        bigserial primary key,
  user_id   text not null references users (id) on delete cascade,
  kind      text not null check (kind in ('moved', 'note', 'registered', 'details')),
  animal_id text not null references animals (id) on delete cascade,
  actor_id  text not null references users (id),
  text      text not null,
  at        timestamptz not null default now(),
  read      boolean not null default false
);
-- The bell loads a person's newest 50.
create index notifications_user_newest on notifications (user_id, id desc);

create table push_tokens (
  token      text primary key,
  user_id    text not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);
