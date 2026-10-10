import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import BoardApp from "@/components/BoardClient";
import { getAnimalName, getUser } from "@safe-paws/db";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = await getAnimalName((await params).id);
  return { title: `${name ?? "Animal"} · ${SITE_NAME}` };
}

/** One animal's page, read-only, for everyone signed in. */
export default async function AnimalPage({ params }: Props) {
  const userId = await requireUserId();
  const user = await getUser(userId);
  if (!user) redirect("/api/session/gone");
  const { id } = await params;
  return <BoardApp initialMe={user} view="animal" animalId={id} />;
}
