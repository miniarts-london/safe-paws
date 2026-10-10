import type { Metadata } from "next";
import { getUser } from "@safe-paws/db";
import BoardApp from "@/components/BoardClient";
import { PublicAnimals } from "@/components/PublicAnimals";
import { getSession } from "@/lib/auth/session";
import { publicBoard } from "@/lib/publicBoard";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Meet our animals · ${SITE_NAME}`,
  description: "Every animal in the rescue's care, with their details. Follow, like, or offer to adopt or sponsor.",
};

/**
 * Every animal, for everyone. Signed in: live, inside the app, with Follow,
 * Like and offers. Visitors: a read-only snapshot; helping asks them to join.
 */
export default async function AnimalsPage() {
  const session = await getSession();
  const user = session ? await getUser(session.uid) : null;
  if (user) return <BoardApp initialMe={user} view="animals" />;
  return <PublicAnimals snapshot={await publicBoard()} />;
}
