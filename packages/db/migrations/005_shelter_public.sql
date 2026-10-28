-- A layout can be shown to everyone, members and visitors who aren't signed in included,
-- so people coming to the shelter know where to find the animal they want to see.
-- Off by default: a foster home's layout shouldn't be public.
alter table shelter_layouts add column public boolean not null default false;
