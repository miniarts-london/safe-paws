import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import BoardApp from "@/components/BoardClient";
import { getUser } from "@safe-paws/db";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `Meet our animals · ${SITE_NAME}`,
  description: "Every animal in the rescue's care, with their details. Follow, like, or offer to adopt or sponsor.",
};

/** Read-only list of every animal, for everyone signed in (members and staff). */
export default async function AnimalsPage() {
  const userId = await requireUserId();
  const user = await getUser(userId);
  if (!user) redirect("/api/session/gone");
  return <BoardApp initialMe={user} view="animals" />;
}
