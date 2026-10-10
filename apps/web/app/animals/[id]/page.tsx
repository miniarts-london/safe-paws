import type { Metadata } from "next";
import { getAnimalName, getUser } from "@safe-paws/db";
import BoardApp from "@/components/BoardClient";
import { PublicAnimals } from "@/components/PublicAnimals";
import { getSession } from "@/lib/auth/session";
import { publicBoard } from "@/lib/publicBoard";
import { SITE_NAME } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = await getAnimalName((await params).id);
  return { title: `${name ?? "Animal"} · ${SITE_NAME}` };
}

/** One animal's page, for everyone: live inside the app when signed in, read-only for visitors. */
export default async function AnimalPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const user = session ? await getUser(session.uid) : null;
  if (user) return <BoardApp initialMe={user} view="animal" animalId={id} />;
  return <PublicAnimals snapshot={await publicBoard()} animalId={id} />;
}
