"use server";

import { loginSchema, type LoginInput } from "@safe-paws/shared/schemas";
import { redirect } from "next/navigation";
import { checkCredentials } from "@/lib/auth/accounts";
import { createSession, deleteSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/next";

export type LoginResult = { error: string } | undefined;

/**
 * Called from the React Hook Form submit handler. The form has already
 * validated with the same schema, but the server never trusts that.
 */
/** `next`: where to go afterwards (checked: only paths on this site). */
export async function login(input: LoginInput, next?: string): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your email and password." };

  const userId = await checkCredentials(parsed.data.email, parsed.data.password);
  // One message for both cases, so the form doesn't reveal which emails have accounts.
  if (!userId) return { error: "That email and password don't match. Check them and try again." };

  await createSession(userId);
  redirect(safeNext(next) ?? "/board");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
