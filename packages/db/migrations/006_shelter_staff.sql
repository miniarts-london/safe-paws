-- Staff on duty: each person checks in on a layout and drags themselves to where they're
-- working, so visitors know who to ask. One row per person. A check-in only counts on the
-- day it was made (Egypt time), so people drop off overnight without having to check out.
create table shelter_staff (
  user_id       text primary key references users (id) on delete cascade,
  layout_id     text not null references shelter_layouts (id) on delete cascade,
  x             double precision not null,
  y             double precision not null,
  checked_in_at timestamptz not null default now()
);
create index shelter_staff_layout on shelter_staff (layout_id);
