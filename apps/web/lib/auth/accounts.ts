import { randomBytes, scrypt as scryptCb, timingSafeEqual, type BinaryLike } from "node:crypto";
import { promisify } from "node:util";
import { findAccountByEmail } from "@safe-paws/db";
import { DEMO_PASSWORD, demoLogins, seedUsers } from "@safe-paws/shared/seed";

const scrypt = promisify(scryptCb) as (pw: BinaryLike, salt: BinaryLike, len: number) => Promise<Buffer>;

export { DEMO_PASSWORD };

/** Shown on the login page; the accounts themselves live in the users table. */
export const demoAccounts = demoLogins.map((a) => {
  const user = seedUsers.find((u) => u.id === a.userId)!;
  return { email: a.email, name: user.name, title: user.title };
});

// Hash to compare against when the email is unknown, so a wrong email takes
// as long as a wrong password and response time doesn't reveal who has an account.
const DUMMY_HASH = "scrypt$0gXr0xrEpFLWx3pnnDfT6g$dj23nSabqgkg44L0fWJnT3pzcuNQjL_BdVAwkEoeF-w";

async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Returns the user id for a correct email and password, otherwise null. */
export async function checkCredentials(email: string, password: string) {
  const account = await findAccountByEmail(email);
  const ok = await verifyPassword(password, account?.passwordHash ?? DUMMY_HASH);
  return ok && account ? account.userId : null;
}

/** Same format as the stored hashes: scrypt$<salt>$<hash>, both base64url. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
