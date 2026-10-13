import { randomUUID } from "node:crypto";
import { createMember } from "@safe-paws/db";
import { registerSchema } from "@safe-paws/shared/schemas";
import { createSessionToken } from "@safe-paws/shared/session";
import { appCors } from "@/lib/appCors";
import { hashPassword } from "@/lib/auth/accounts";

/**
 * Joining from the phone app: the same rules as the website's sign-up (everyone starts as a
 * member until a coordinator makes them staff), but the session comes back in the body, like
 * /api/auth/token, for the app to keep in secure storage.
 */
export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: appCors(req, "POST") });
}

export async function POST(req: Request) {
  const headers = appCors(req, "POST");
  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json({ error: issue?.message ?? "Check the form and try again.", field: issue?.path[0] }, { status: 400, headers });
  }
  const { name, email, password, title } = parsed.data;
  const user = await createMember({ id: randomUUID(), name, email, title: title || "New member", passwordHash: await hashPassword(password) });
  if (!user) {
    return Response.json({ error: "There's already an account with that email. Sign in instead.", field: "email" }, { status: 409, headers });
  }
  const { token, expires } = createSessionToken(user.id);
  return Response.json({ token, userId: user.id, expiresAt: expires.getTime() }, { status: 201, headers });
}
