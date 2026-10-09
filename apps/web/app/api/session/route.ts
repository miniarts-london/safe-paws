import { getSession } from "@/lib/auth/session";

/** Lets the board tell "you're signed out" apart from "the board server is down". */
export async function GET() {
  const session = await getSession();
  return session ? Response.json({ userId: session.uid }) : Response.json({ error: "Signed out" }, { status: 401 });
}
