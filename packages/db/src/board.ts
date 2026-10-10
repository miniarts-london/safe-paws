import type {
  Animal,
  AnimalRequest,
  RequestKind,
  Board,
  Columns,
  Media,
  Note,
  Notification,
  NotificationKind,
  StageId,
  User,
} from "@safe-paws/shared/protocol";
import { STAGE_IDS } from "@safe-paws/shared/protocol";
import { pool, type Tx } from "./pool";

const ms = (d: Date) => d.getTime();
const num = (v: string | null) => (v === null ? null : Number(v));

/* ---------- reading ---------- */

type AnimalRow = {
  id: string; name: string; species: Animal["species"]; sex: Animal["sex"];
  age_value: string; age_unit: Animal["age"]["unit"]; age_estimated: boolean;
  neutered: Animal["neutered"]; weight_kg: string | null; area: string; about: string;
  stage: StageId; position: number; updated_at: Date; updated_by: string | null;
};

/** The whole board in one go. It's small (a rescue's animals in care), so the server keeps it in memory. */
export async function loadBoard(): Promise<{ users: User[]; board: Board }> {
  const db = pool();
  const [users, animals, followers, notes, media, likes, requests] = await Promise.all([
    db.query<User>("select id, name, role, title from users order by created_at, id"),
    db.query<AnimalRow>("select * from animals order by stage, position"),
    db.query<{ animal_id: string; user_id: string }>("select animal_id, user_id from animal_followers"),
    db.query<{ id: string; animal_id: string; author_id: string; text: string; at: Date }>(
      "select id, animal_id, author_id, text, at from notes order by at, id",
    ),
    db.query<{ animal_id: string; id: string; kind: Media["kind"]; name: string; added_by: string; at: Date }>(
      `select m.animal_id, u.id, u.kind, u.name, m.added_by, m.at
         from animal_media m join uploads u on u.id = m.upload_id
        order by m.animal_id, m.position`,
    ),
    db.query<{ animal_id: string; user_id: string }>("select animal_id, user_id from animal_likes order by at"),
    db.query<{ animal_id: string; user_id: string; kind: RequestKind; message: string; at: Date; email: string }>(
      `select r.animal_id, r.user_id, r.kind, r.message, r.at, u.email
         from animal_requests r join users u on u.id = r.user_id
        order by r.at, r.id`,
    ),
  ]);

  const columns = Object.fromEntries(STAGE_IDS.map((s) => [s, [] as string[]])) as Columns;
  const byId: Record<string, Animal> = {};
  for (const r of animals.rows) {
    byId[r.id] = {
      id: r.id,
      name: r.name,
      species: r.species,
      sex: r.sex,
      age: { value: Number(r.age_value), unit: r.age_unit, estimated: r.age_estimated },
      neutered: r.neutered,
      weightKg: num(r.weight_kg),
      area: r.area,
      about: r.about,
      media: [],
      stage: r.stage,
      followers: [],
      likes: [],
      requests: [],
      notes: [],
      updatedAt: ms(r.updated_at),
      updatedBy: r.updated_by ?? "",
    };
    columns[r.stage].push(r.id);
  }
  for (const f of followers.rows) byId[f.animal_id]?.followers.push(f.user_id);
  for (const l of likes.rows) byId[l.animal_id]?.likes.push(l.user_id);
  for (const q of requests.rows) {
    byId[q.animal_id]?.requests.push({ userId: q.user_id, kind: q.kind, message: q.message, at: ms(q.at), email: q.email });
  }
  for (const n of notes.rows) byId[n.animal_id]?.notes.push({ id: n.id, authorId: n.author_id, text: n.text, at: ms(n.at) });
  for (const m of media.rows) {
    byId[m.animal_id]?.media.push({ id: m.id, kind: m.kind, name: m.name, url: `/api/media/${m.id}`, addedBy: m.added_by, at: ms(m.at) });
  }
  return { users: users.rows, board: { version: 1, columns, animals: byId } };
}

/** Just the name, for an animal page's title. */
export async function getAnimalName(id: string) {
  const { rows } = await pool().query<{ name: string }>("select name from animals where id = $1", [id]);
  return rows[0]?.name ?? null;
}

/* ---------- writing (each takes the caller's transaction) ---------- */

/** Saves the order of whole columns in one statement. */
export async function saveColumns(tx: Tx, columns: Partial<Columns>) {
  const ids: string[] = [], stages: string[] = [], positions: number[] = [];
  for (const [stage, list] of Object.entries(columns)) {
    list?.forEach((id, i) => {
      ids.push(id);
      stages.push(stage);
      positions.push(i);
    });
  }
  if (ids.length === 0) return;
  await tx.query(
    `update animals a set stage = c.stage, position = c.position
       from unnest($1::text[], $2::text[], $3::int[]) as c(id, stage, position)
      where a.id = c.id`,
    [ids, stages, positions],
  );
}

export async function touchAnimal(tx: Tx, id: string, by: string, at: number) {
  await tx.query("update animals set updated_at = to_timestamp($2 / 1000.0), updated_by = $3 where id = $1", [id, at, by]);
}

const detailParams = (a: Animal) => [
  a.id, a.name, a.species, a.sex, a.age.value, a.age.unit, a.age.estimated, a.neutered, a.weightKg, a.area, a.about,
];

export async function insertAnimal(tx: Tx, a: Animal, position: number) {
  await tx.query(
    `insert into animals (id, name, species, sex, age_value, age_unit, age_estimated, neutered, weight_kg, area, about,
       stage, position, updated_at, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,to_timestamp($14 / 1000.0),$15)`,
    [...detailParams(a), a.stage, position, a.updatedAt, a.updatedBy],
  );
}

export async function updateAnimalDetails(tx: Tx, a: Animal) {
  await tx.query(
    `update animals set name=$2, species=$3, sex=$4, age_value=$5, age_unit=$6, age_estimated=$7, neutered=$8,
       weight_kg=$9, area=$10, about=$11, updated_at=to_timestamp($12 / 1000.0), updated_by=$13
     where id = $1`,
    [...detailParams(a), a.updatedAt, a.updatedBy],
  );
}

/**
 * Replaces an animal's photo/video list. The foreign key to `uploads` means
 * only files that were really uploaded can be attached.
 */
export async function replaceMedia(tx: Tx, animalId: string, media: Media[]) {
  await tx.query("delete from animal_media where animal_id = $1", [animalId]);
  for (const [i, m] of media.entries()) {
    await tx.query(
      "insert into animal_media (animal_id, upload_id, position, added_by, at) values ($1,$2,$3,$4,to_timestamp($5 / 1000.0))",
      [animalId, m.id, i, m.addedBy, m.at],
    );
  }
}

/** Notes, followers, likes, offers, media links and notifications go with it (on delete cascade). */
export async function deleteAnimal(tx: Tx, id: string) {
  await tx.query("delete from animals where id = $1", [id]);
}

export async function insertNote(tx: Tx, animalId: string, n: Note) {
  await tx.query("insert into notes (id, animal_id, author_id, text, at) values ($1,$2,$3,$4,to_timestamp($5 / 1000.0))", [
    n.id, animalId, n.authorId, n.text, n.at,
  ]);
}

export async function setFollower(tx: Tx, animalId: string, userId: string, follow: boolean) {
  await tx.query(
    follow
      ? "insert into animal_followers (animal_id, user_id) values ($1, $2) on conflict do nothing"
      : "delete from animal_followers where animal_id = $1 and user_id = $2",
    [animalId, userId],
  );
}

export async function setLike(tx: Tx, animalId: string, userId: string, like: boolean) {
  await tx.query(
    like
      ? "insert into animal_likes (animal_id, user_id) values ($1, $2) on conflict do nothing"
      : "delete from animal_likes where animal_id = $1 and user_id = $2",
    [animalId, userId],
  );
}

/** Returns false if this person already made this kind of request for this animal. */
export async function insertRequest(tx: Tx, animalId: string, r: AnimalRequest) {
  const { rowCount } = await tx.query(
    `insert into animal_requests (animal_id, user_id, kind, message, at)
     values ($1, $2, $3, $4, to_timestamp($5 / 1000.0))
     on conflict (animal_id, user_id, kind) do nothing`,
    [animalId, r.userId, r.kind, r.message, r.at],
  );
  return (rowCount ?? 0) > 0;
}

/* ---------- notifications ---------- */

type NotificationRow = {
  id: string; user_id: string; kind: NotificationKind; animal_id: string; actor_id: string; text: string; at: Date; read: boolean;
};
const toNotification = (r: NotificationRow): Notification => ({
  id: Number(r.id), userId: r.user_id, kind: r.kind, animalId: r.animal_id, actorId: r.actor_id, text: r.text, at: ms(r.at), read: r.read,
});

export async function insertNotifications(
  rows: { userId: string; text: string }[],
  kind: NotificationKind,
  animalId: string,
  actorId: string,
): Promise<Notification[]> {
  if (rows.length === 0) return [];
  const { rows: inserted } = await pool().query<NotificationRow>(
    `insert into notifications (user_id, kind, animal_id, actor_id, text)
     select u, $3, $4, $5, t from unnest($1::text[], $2::text[]) as x(u, t)
     returning *`,
    [rows.map((r) => r.userId), rows.map((r) => r.text), kind, animalId, actorId],
  );
  return inserted.map(toNotification);
}

export async function listNotifications(userId: string, limit = 50) {
  const { rows } = await pool().query<NotificationRow>(
    "select * from notifications where user_id = $1 order by id desc limit $2",
    [userId, limit],
  );
  return rows.map(toNotification);
}

export async function markNotificationsRead(userId: string, ids: number[] | "all") {
  if (ids === "all") await pool().query("update notifications set read = true where user_id = $1 and not read", [userId]);
  else await pool().query("update notifications set read = true where user_id = $1 and id = any($2::bigint[])", [userId, ids]);
}

/* ---------- push tokens ---------- */

/** A device belongs to whoever signed in on it most recently. */
export async function addPushToken(userId: string, token: string) {
  await pool().query(
    "insert into push_tokens (token, user_id) values ($1, $2) on conflict (token) do update set user_id = excluded.user_id, created_at = now()",
    [token, userId],
  );
}
export async function removePushToken(token: string, userId?: string) {
  await pool().query(userId ? "delete from push_tokens where token = $1 and user_id = $2" : "delete from push_tokens where token = $1", userId ? [token, userId] : [token]);
}
export async function pushTokensFor(userId: string) {
  const { rows } = await pool().query<{ token: string }>("select token from push_tokens where user_id = $1", [userId]);
  return rows.map((r) => r.token);
}
