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

  const [{ layouts }, { board }] = await Promise.all([loadShelter({ publicOnly: true }), publicBoard()]);
  // Only the animals on a public layout (already limited to the ones at the shelter).
  const placed = new Set(layouts.flatMap((l) => l.placements.map((p) => p.animalId)));
  const animals = Object.fromEntries(Object.entries(board.animals).filter(([id]) => placed.has(id)));
  return <PublicShelter layouts={layouts} animals={animals} />;
}
