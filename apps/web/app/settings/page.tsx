import type { Metadata } from "next";
import { getUser } from "@safe-paws/db";
import { redirect } from "next/navigation";
import BoardApp from "@/components/screens/board/BoardClient";
import { requireUserId } from "@/lib/auth/session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Settings · ${SITE_NAME}` };

/** Coordinators only: reviewing new members. Everyone else goes back to the Animals page. */
export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await getUser(userId);
  if (!user) redirect("/api/session/gone");
  if (user.role !== "coordinator") redirect("/animals");
  return <BoardApp initialMe={user} view="settings" />;
}
