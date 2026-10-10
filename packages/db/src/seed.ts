import { createSeedBoard, seedUsers } from "@safe-paws/shared/seed";
import type { StageId } from "@safe-paws/shared/protocol";
import { pool, transaction, type Tx } from "./pool";

/**
 * Demo accounts. Passwords are scrypt hashes of the demo password shown on
 * the login screens; real volunteers would sign up instead.
 */
const DEMO_ACCOUNTS: Record<string, { email: string; passwordHash: string }> = {
  mona: { email: "mona@rescue.example", passwordHash: "scrypt$0gXr0xrEpFLWx3pnnDfT6g$dj23nSabqgkg44L0fWJnT3pzcuNQjL_BdVAwkEoeF-w" },
  karim: { email: "karim@rescue.example", passwordHash: "scrypt$HmeJ9cpFWRqjPBG-wtFvvw$IvNtjUECu6-61W7u1WKhVGz7ulVfhjfioVknox7mWrY" },
  sara: { email: "sara@rescue.example", passwordHash: "scrypt$qccAZX2p5pxQEci8i1Arbg$6jUjViRXEeBPD9IICCrtcN6efDZSWIZrmS88p7B1lrM" },
  kaori: { email: "kaori@rescue.example", passwordHash: "scrypt$ZbwX3pomow---ChxsA0uxA$h9Wx6-fjGRGz8_6XABKiSi0gqkkkgqAVNTo5rPkmksc" },
};

export async function isEmpty() {
  const { rows } = await pool().query<{ n: string }>("select count(*) as n from users");
  return Number(rows[0].n) === 0;
}

/** Loads the sample people and animals. Run once on a fresh database. */
export async function seed(log = console.log) {
  const board = createSeedBoard();
  await transaction(async (tx) => {
    await insertDemoPeople(tx);
    await insertSampleAnimals(tx, board);
  });
  log(`[db] seeded ${seedUsers.length} people and ${Object.keys(board.animals).length} animals`);
}

/**
 * For a live site that already has real people: adds the demo accounts shown
 * on the sign-in page (skipping any that exist), and the sample animals if
 * the board is still empty. Never changes or removes anything.
 */
export async function seedDemo(log = console.log) {
  const board = createSeedBoard();
  await transaction(async (tx) => {
    const added = await insertDemoPeople(tx);
    log(added.length ? `[db] added demo accounts: ${added.join(", ")}` : "[db] demo accounts already there");

    const { rows } = await tx.query<{ n: string }>("select count(*) as n from animals");
    if (Number(rows[0].n) > 0) return log("[db] the board already has animals, so no sample animals added");

    const ids = seedUsers.map((u) => u.id);
    const present = await tx.query<{ id: string }>("select id from users where id = any($1)", [ids]);
    if (present.rowCount !== ids.length) {
      return log("[db] a demo account's email belongs to someone else, so no sample animals added");
    }
    await insertSampleAnimals(tx, board);
    log(`[db] added ${Object.keys(board.animals).length} sample animals`);
  });
}

/** Demo people, already reviewed. Skips any whose id or email is taken. Returns the names added. */
async function insertDemoPeople(tx: Tx) {
  const added: string[] = [];
  for (const u of seedUsers) {
    const acct = DEMO_ACCOUNTS[u.id];
    const { rowCount } = await tx.query(
      `insert into users (id, name, role, title, email, password_hash, reviewed_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict do nothing`,
      [u.id, u.name, u.role, u.title, acct.email, acct.passwordHash],
    );
    if (rowCount) added.push(u.name);
  }
  return added;
}

async function insertSampleAnimals(tx: Tx, board: ReturnType<typeof createSeedBoard>) {
  for (const stage of Object.keys(board.columns) as StageId[]) {
    for (const [position, id] of board.columns[stage].entries()) {
      const a = board.animals[id];
      await tx.query(
        `insert into animals (id, name, species, sex, age_value, age_unit, age_estimated, neutered, weight_kg,
           area, about, stage, position, updated_at, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,to_timestamp($14 / 1000.0),$15)`,
        [a.id, a.name, a.species, a.sex, a.age.value, a.age.unit, a.age.estimated, a.neutered, a.weightKg,
         a.area, a.about, stage, position, a.updatedAt, a.updatedBy],
      );
      for (const userId of a.followers) {
        await tx.query("insert into animal_followers (animal_id, user_id) values ($1, $2)", [a.id, userId]);
      }
      for (const n of a.notes) {
        await tx.query("insert into notes (id, animal_id, author_id, text, at) values ($1,$2,$3,$4,to_timestamp($5 / 1000.0))", [
          n.id, a.id, n.authorId, n.text, n.at,
        ]);
      }
    }
  }
}

/** Drops everything and starts again from the sample data. Development only. */
export async function dropAll() {
  await pool().query("drop schema public cascade; create schema public;");
}
