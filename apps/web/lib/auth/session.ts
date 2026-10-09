import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "@safe-paws/shared/session";

export async function createSession(userId: string) {
  const { token, expires } = createSessionToken(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript, so an XSS bug can't steal it
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For pages that need a signed-in person: returns their id or sends them to /login. */
export async function requireUserId() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.uid;
}
