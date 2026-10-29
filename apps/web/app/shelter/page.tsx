import type { Metadata } from "next";
import { getUser, loadShelter } from "@safe-paws/db";
import { redirect } from "next/navigation";
import BoardApp from "@/components/screens/board/BoardClient";
import { PublicShelter } from "@/components/screens/shelter/PublicShelter";
import { getSession } from "@/lib/auth/session";
import { publicBoard } from "@/lib/publicBoard";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Visiting the shelter · ${SITE_NAME}`,
  description: "Where to find each animal when you come to visit.",
};

/**
 * Staff arrange the shelter layouts here. Everyone else sees the layouts staff
 * made public, read-only: members inside the app, visitors on a public page.
 */
export default async function ShelterPage() {
  const session = await getSession();
  const user = session ? await getUser(session.uid) : null;
  if (session && !user) redirect("/api/session/gone");
  if (user) return <BoardApp initialMe={user} view="shelter" />;

  // The same snapshot as the public Animals page, so each animal's side panel can show everything visitors may see.
  const [{ layouts }, snapshot] = await Promise.all([loadShelter({ publicOnly: true }), publicBoard()]);
  return <PublicShelter layouts={layouts} snapshot={snapshot} />;
}
