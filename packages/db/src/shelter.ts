import {
  AREAS_MAX,
  LAYOUTS_MAX,
  SHELTER_STAGES,
  SHELTER_TIME_ZONE,
  clampArea,
  clampPoint,
  type ShelterChange,
  type ShelterLayout,
  type ShelterState,
} from "@safe-paws/shared/shelter";
import type { Role } from "@safe-paws/shared/protocol";
import { pool, transaction, type Tx } from "./pool";

/** A change the person asked for that can't be made (not a bug): its message is shown to them. */
export class ShelterError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/**
 * Every layout with its areas and placements, oldest layout first. Small, so it's read in one go.
 *
 * `publicOnly`: what members and visitors see. Only layouts marked public, and only
 * the animals the rescue has at the moment (at the vet, recovering or ready for adoption).
 */
export async function loadShelter({ publicOnly = false } = {}): Promise<ShelterState> {
  const db = pool();
  const stages = publicOnly ? SHELTER_STAGES : null;
  const [layouts, areas, placements, staff] = await Promise.all([
    db.query<{ id: string; name: string; public: boolean; main: boolean }>(
      `select id, name, public, main from shelter_layouts ${publicOnly ? "where public" : ""} order by created_at, id`,
    ),
    db.query<{ id: string; layout_id: string; label: string; x: number; y: number; w: number; h: number }>(
      "select id, layout_id, label, x, y, w, h from shelter_areas order by layout_id, id",
    ),
    db.query<{ animal_id: string; layout_id: string; x: number; y: number }>(
      `select p.animal_id, p.layout_id, p.x, p.y from shelter_placements p
         ${stages ? "join animals a on a.id = p.animal_id where a.stage = any($1)" : ""}
        order by p.placed_at, p.animal_id`,
      stages ? [stages] : [],
    ),
    // Today's check-ins only: yesterday's have lapsed.
    db.query<{ user_id: string; layout_id: string; x: number; y: number; name: string; role: Role }>(
      `select s.user_id, s.layout_id, s.x, s.y, u.name, u.role
         from shelter_staff s join users u on u.id = s.user_id
        where s.checked_in_at >= (date_trunc('day', now() at time zone $1) at time zone $1)
          and u.role <> 'member'
        order by s.checked_in_at, s.user_id`,
      [SHELTER_TIME_ZONE],
    ),
  ]);
  const byId = new Map<string, ShelterLayout>(
    layouts.rows.map((l) => [l.id, { id: l.id, name: l.name, public: l.public, main: l.main, areas: [], placements: [], staff: [] }]),
  );
  for (const a of areas.rows) byId.get(a.layout_id)?.areas.push({ id: a.id, label: a.label, x: a.x, y: a.y, w: a.w, h: a.h });
  for (const p of placements.rows) byId.get(p.layout_id)?.placements.push({ animalId: p.animal_id, x: p.x, y: p.y });
  for (const s of staff.rows) byId.get(s.layout_id)?.staff.push({ userId: s.user_id, name: s.name, role: s.role, x: s.x, y: s.y });
  return { layouts: [...byId.values()] };
}

async function touch(tx: Tx, layoutId: string, userId: string) {
  const { rowCount } = await tx.query("update shelter_layouts set updated_at = now(), updated_by = $2 where id = $1", [layoutId, userId]);
  if (!rowCount) throw new ShelterError("That layout has been deleted.", 404);
}

/** Applies one change in a transaction. Matches applyShelterChange in @safe-paws/shared/shelter. */
export async function changeShelter(change: ShelterChange, userId: string): Promise<void> {
  await transaction(async (tx) => {
    switch (change.op) {
      case "layout.create": {
        const { rows } = await tx.query<{ n: number }>("select count(*)::int as n from shelter_layouts");
        if (rows[0].n >= LAYOUTS_MAX) throw new ShelterError(`There can be up to ${LAYOUTS_MAX} layouts.`);
        // The first layout starts as the main shelter.
        await tx.query(
          `insert into shelter_layouts (id, name, updated_by, main)
           values ($1, $2, $3, not exists (select 1 from shelter_layouts where main))
           on conflict (id) do nothing`,
          [change.id, change.name, userId],
        );
        return;
      }
      case "layout.rename":
        await touch(tx, change.layoutId, userId);
        await tx.query("update shelter_layouts set name = $2 where id = $1", [change.layoutId, change.name]);
        return;
      case "layout.main":
        await touch(tx, change.layoutId, userId);
        // One at a time: the index allows only one main layout.
        await tx.query("update shelter_layouts set main = false where main and id <> $1", [change.layoutId]);
        await tx.query("update shelter_layouts set main = true where id = $1", [change.layoutId]);
        return;
      case "layout.public":
        await touch(tx, change.layoutId, userId);
        await tx.query("update shelter_layouts set public = $2 where id = $1", [change.layoutId, change.public]);
        return;
      case "layout.delete":
        // Areas and placements go with it (on delete cascade).
        await tx.query("delete from shelter_layouts where id = $1", [change.layoutId]);
        return;
      case "area.save": {
        await touch(tx, change.layoutId, userId);
        const area = clampArea(change.area);
        const before = await tx.query<{ layout_id: string; x: number; y: number; w: number; h: number }>(
          "select layout_id, x, y, w, h from shelter_areas where id = $1 for update",
          [area.id],
        );
        const old = before.rows[0];
        if (old && old.layout_id !== change.layoutId) throw new ShelterError("That area is on another layout.", 409);
        if (!old) {
          const { rows } = await tx.query<{ n: number }>("select count(*)::int as n from shelter_areas where layout_id = $1", [
            change.layoutId,
          ]);
          if (rows[0].n >= AREAS_MAX) throw new ShelterError(`A layout can have up to ${AREAS_MAX} areas.`);
        }
        await tx.query(
          `insert into shelter_areas (id, layout_id, label, x, y, w, h) values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set label = excluded.label, x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h`,
          [area.id, change.layoutId, area.label, area.x, area.y, area.w, area.h],
        );
        // Moving an area carries the animals and staff in it along.
        const dx = old ? area.x - old.x : 0;
        const dy = old ? area.y - old.y : 0;
        if (old && (dx !== 0 || dy !== 0)) {
          const inArea = await tx.query<{ animal_id: string; x: number; y: number }>(
            `select animal_id, x, y from shelter_placements
              where layout_id = $1 and x between $2 and $2 + $4 and y between $3 and $3 + $5`,
            [change.layoutId, old.x, old.y, old.w, old.h],
          );
          for (const p of inArea.rows) {
            const spot = clampPoint(p.x + dx, p.y + dy);
            await tx.query("update shelter_placements set x = $2, y = $3 where animal_id = $1", [p.animal_id, spot.x, spot.y]);
          }
          const staffInArea = await tx.query<{ user_id: string; x: number; y: number }>(
            `select user_id, x, y from shelter_staff
              where layout_id = $1 and x between $2 and $2 + $4 and y between $3 and $3 + $5`,
            [change.layoutId, old.x, old.y, old.w, old.h],
          );
          for (const p of staffInArea.rows) {
            const spot = clampPoint(p.x + dx, p.y + dy);
            await tx.query("update shelter_staff set x = $2, y = $3 where user_id = $1", [p.user_id, spot.x, spot.y]);
          }
        }
        return;
      }
      case "area.delete":
        await touch(tx, change.layoutId, userId);
        await tx.query("delete from shelter_areas where id = $1 and layout_id = $2", [change.areaId, change.layoutId]);
        return;
      case "place": {
        await touch(tx, change.layoutId, userId);
        const animal = await tx.query("select 1 from animals where id = $1", [change.animalId]);
        if (!animal.rowCount) throw new ShelterError("That animal has been deleted.", 404);
        const spot = clampPoint(change.x, change.y);
        await tx.query(
          `insert into shelter_placements (animal_id, layout_id, x, y, placed_by) values ($1, $2, $3, $4, $5)
           on conflict (animal_id) do update
             set layout_id = excluded.layout_id, x = excluded.x, y = excluded.y, placed_at = now(), placed_by = excluded.placed_by`,
          [change.animalId, change.layoutId, spot.x, spot.y, userId],
        );
        return;
      }
      case "unplace":
        await tx.query("delete from shelter_placements where animal_id = $1", [change.animalId]);
        return;
      case "checkin": {
        // Who comes from the session (userId), never from the change itself.
        // On any layout, one at a time: checking in somewhere else moves you there.
        const layout = await tx.query("select 1 from shelter_layouts where id = $1", [change.layoutId]);
        if (!layout.rowCount) throw new ShelterError("That layout has been deleted.", 404);
        const spot = clampPoint(change.x, change.y);
        // Moving yourself keeps today's check-in time; checking in on a new day starts a new one.
        await tx.query(
          `insert into shelter_staff (user_id, layout_id, x, y) values ($1, $2, $3, $4)
           on conflict (user_id) do update
             set layout_id = excluded.layout_id, x = excluded.x, y = excluded.y,
                 checked_in_at = case when shelter_staff.checked_in_at >= (date_trunc('day', now() at time zone $5) at time zone $5)
                                      then shelter_staff.checked_in_at else now() end`,
          [userId, change.layoutId, spot.x, spot.y, SHELTER_TIME_ZONE],
        );
        return;
      }
      case "checkout":
        await tx.query("delete from shelter_staff where user_id = $1", [userId]);
        return;
    }
  });
}
