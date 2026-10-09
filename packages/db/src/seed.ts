import { createSeedBoard, seedUsers } from "@safe-paws/shared/seed";
import type { StageId } from "@safe-paws/shared/protocol";
import { pool, transaction } from "./pool";

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
    for (const u of seedUsers) {
      const acct = DEMO_ACCOUNTS[u.id];
      await tx.query(
        "insert into users (id, name, role, title, email, password_hash, reviewed_at) values ($1, $2, $3, $4, $5, $6, now())",
        [u.id, u.name, u.role, u.title, acct.email, acct.passwordHash],
      );
    }
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
  });
  log(`[db] seeded ${seedUsers.length} people and ${Object.keys(board.animals).length} animals`);
}

/** Drops everything and starts again from the sample data. Development only. */
export async function dropAll() {
  await pool().query("drop schema public cascade; create schema public;");
}
