-- Which layout is the main shelter, chosen by staff rather than worked out:
-- staff check in there ("I'm here"), and the app marks it as the main one.
-- At most one. Until now it was the first layout shown to visitors, so that one becomes main.
alter table shelter_layouts add column main boolean not null default false;
create unique index shelter_layouts_one_main on shelter_layouts (main) where main;
update shelter_layouts set main = true
 where id = (select id from shelter_layouts where public order by created_at, id limit 1);
