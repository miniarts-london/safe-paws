"use server";

import { getPasswordHash, getUserEmail, setPasswordHash } from "@safe-paws/db";
import { demoLogins } from "@safe-paws/shared/seed";
import { changePasswordSchema, type ChangePasswordInput } from "@safe-paws/shared/schemas";
import { hashPassword, showDemoAccounts, verifyPassword } from "@/lib/auth/accounts";
import { getSession } from "@/lib/auth/session";

export type ChangePasswordResult = { ok: true } | { ok: false; error: string; field?: keyof ChangePasswordInput };

/** From the Profile page: your current password, then the new one. */
export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Your sign-in has expired. Sign in again." };
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the form.", field: issue?.path[0] as keyof ChangePasswordInput };
  }
  const stored = await getPasswordHash(session.uid);
  if (!stored || !(await verifyPassword(parsed.data.current, stored))) {
    return { ok: false, error: "That isn't your current password.", field: "current" };
  }
  // The demo accounts' password is on the sign-in page; changing it would lock everyone else out.
  const email = await getUserEmail(session.uid);
  if (showDemoAccounts() && demoLogins.some((d) => d.email === email)) {
    return { ok: false, error: "Demo accounts keep the demo password, so others can still try them." };
  }
  await setPasswordHash(session.uid, await hashPassword(parsed.data.next));
  return { ok: true };
}
