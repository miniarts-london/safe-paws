-- Likes, and requests to adopt or sponsor an animal (anyone signed in can make them;
-- coordinators are notified).

create table animal_likes (
  animal_id text not null references animals (id) on delete cascade,
  user_id   text not null references users (id) on delete cascade,
  at        timestamptz not null default now(),
  primary key (animal_id, user_id)
);

create table animal_requests (
  id        bigserial primary key,
  animal_id text not null references animals (id) on delete cascade,
  user_id   text not null references users (id) on delete cascade,
  kind      text not null check (kind in ('adopt', 'sponsor')),
  message   text not null default '' check (length(message) <= 500),
  at        timestamptz not null default now(),
  -- One request of each kind per person per animal.
  unique (animal_id, user_id, kind)
);
create index animal_requests_animal on animal_requests (animal_id, at);

alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('moved', 'note', 'registered', 'details', 'request'));
