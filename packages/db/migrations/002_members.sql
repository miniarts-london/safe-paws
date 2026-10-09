-- Anyone can sign up as a member (view only). A coordinator reviews new members
-- and either makes them staff (coordinator, vet, fosterer, sponsor) or keeps them as members.

alter table users drop constraint users_role_check;
alter table users add constraint users_role_check
  check (role in ('coordinator', 'vet', 'fosterer', 'sponsor', 'member'));

alter table users add column reviewed_at timestamptz;
alter table users add column reviewed_by text references users (id);

-- Everyone who existed before sign-up was added was set up by hand, so counts as reviewed.
update users set reviewed_at = created_at;

-- The coordinator's "New members" list.
create index users_unreviewed on users (created_at desc) where reviewed_at is null;
