import type { Member, StaffRole, User } from "@safe-paws/shared/protocol";
import { pool } from "./pool";

/** For sign-in: the stored hash for an email, or null. */
export async function findAccountByEmail(email: string) {
  const { rows } = await pool().query<{ id: string; password_hash: string }>(
    "select id, password_hash from users where email = lower($1)",
    [email.trim()],
  );
  return rows[0] ? { userId: rows[0].id, passwordHash: rows[0].password_hash } : null;
}

export async function userExists(id: string) {
  const { rowCount } = await pool().query("select 1 from users where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/** One person as everyone else sees them, or null. */
export async function getUser(id: string): Promise<User | null> {
  const { rows } = await pool().query<User>("select id, name, role, title from users where id = $1", [id]);
  return rows[0] ?? null;
}

/** For coordinators to get in touch, e.g. about an offer to adopt. */
export async function getUserEmail(id: string): Promise<string | null> {
  const { rows } = await pool().query<{ email: string }>("select email from users where id = $1", [id]);
  return rows[0]?.email ?? null;
}

/**
 * Signs someone up as a member (view only). Returns null when the email is
 * already registered, so the caller can say so without a second query racing it.
 */
export async function createMember(input: { id: string; name: string; email: string; title: string; passwordHash: string }) {
  const { rows } = await pool().query<User>(
    `insert into users (id, name, role, title, email, password_hash)
     values ($1, $2, 'member', $3, lower($4), $5)
     on conflict (email) do nothing
     returning id, name, role, title`,
    [input.id, input.name, input.title, input.email.trim(), input.passwordHash],
  );
  return rows[0] ?? null;
}

type MemberRow = User & { email: string; created_at: Date; reviewed_at: Date | null };
const toMember = (r: MemberRow): Member => ({
  id: r.id,
  name: r.name,
  role: r.role,
  title: r.title,
  email: r.email,
  joinedAt: r.created_at.getTime(),
  reviewedAt: r.reviewed_at?.getTime() ?? null,
});

/**
 * For coordinators: everyone still waiting for a review, plus members
 * from the last 30 days, so a recent decision can be seen and changed.
 */
export async function listMembers(): Promise<Member[]> {
  const { rows } = await pool().query<MemberRow>(
    `select id, name, role, title, email, created_at, reviewed_at
       from users
      where reviewed_at is null
         or (role = 'member' and created_at > now() - interval '30 days')
      order by created_at desc
      limit 200`,
  );
  return rows.map(toMember);
}

/** A coordinator makes a member staff. Returns the updated person, or null if they don't exist. */
export async function approveMember(userId: string, role: StaffRole, title: string, reviewerId: string) {
  const { rows } = await pool().query<User>(
    `update users set role = $2, title = $3, reviewed_at = now(), reviewed_by = $4
      where id = $1 and role = 'member'
      returning id, name, role, title`,
    [userId, role, title, reviewerId],
  );
  return rows[0] ?? null;
}

/** A coordinator keeps someone as a member; they leave the "new" list. */
export async function keepMember(userId: string, reviewerId: string) {
  const { rowCount } = await pool().query(
    "update users set reviewed_at = now(), reviewed_by = $2 where id = $1 and role = 'member'",
    [userId, reviewerId],
  );
  return (rowCount ?? 0) > 0;
}
