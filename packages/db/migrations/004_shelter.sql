-- Shelter layouts: a rough plan of each place animals stay (the shelter, a foster home...),
-- drawn as labelled areas (kennels, rooms, the yard), and where each animal is on it.
-- Positions and sizes are percentages of the plan, so it scales with the screen.

create table shelter_layouts (
  id         text primary key,
  name       text not null check (length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text references users (id) on delete set null
);

create table shelter_areas (
  id        text primary key,
  layout_id text not null references shelter_layouts (id) on delete cascade,
  label     text not null check (length(label) between 1 and 40),
  x         double precision not null,
  y         double precision not null,
  w         double precision not null,
  h         double precision not null
);
create index shelter_areas_layout on shelter_areas (layout_id);

-- One row per animal, so an animal is only ever in one place.
create table shelter_placements (
  animal_id text primary key references animals (id) on delete cascade,
  layout_id text not null references shelter_layouts (id) on delete cascade,
  x         double precision not null,
  y         double precision not null,
  placed_at timestamptz not null default now(),
  placed_by text references users (id) on delete set null
);
create index shelter_placements_layout on shelter_placements (layout_id);
