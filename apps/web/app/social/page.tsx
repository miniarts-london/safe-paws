import type { Metadata } from "next";
import { getUser } from "@safe-paws/db";
import { redirect } from "next/navigation";
import BoardApp from "@/components/screens/board/BoardClient";
import { getSession } from "@/lib/auth/session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Social post · ${SITE_NAME}` };

/** Coordinators only. Everyone else goes back to the board (the API routes check too). */
export default async function SocialPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsocial");
  const user = await getUser(session.uid);
  if (!user) redirect("/api/session/gone");
  if (user.role !== "coordinator") redirect("/board");
  return <BoardApp initialMe={user} view="social" />;
}
