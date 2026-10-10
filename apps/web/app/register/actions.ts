"use server";

import { randomUUID } from "node:crypto";
import { createMember } from "@safe-paws/db";
import { registerSchema, type RegisterInput } from "@safe-paws/shared/schemas";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth/accounts";
import { createSession } from "@/lib/auth/session";
import { safeNext } from "@/lib/next";

export type RegisterResult = { error: string; field?: keyof RegisterInput } | undefined;

/**
 * Everyone joins as a member: they can see the board and follow animals.
 * A coordinator makes them staff before they can change anything.
 */
/** `next`: where to go afterwards, e.g. back to the animal they wanted to help (only paths on this site). */
export async function register(input: RegisterInput, next?: string): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check the form and try again.", field: issue?.path[0] as keyof RegisterInput };
  }
  const { name, email, password, title } = parsed.data;

  const user = await createMember({
    id: randomUUID(),
    name,
    email,
    title: title || "New member",
    passwordHash: await hashPassword(password),
  });
  if (!user) return { field: "email", error: "There's already an account with that email. Sign in instead." };

  await createSession(user.id);
  const back = safeNext(next);
  redirect(back ? `${back}${back.includes("?") ? "&" : "?"}welcome=1` : "/board?welcome=1");
}
