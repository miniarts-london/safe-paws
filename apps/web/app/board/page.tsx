import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import BoardApp from "@/components/screens/board/BoardClient";
import { getUser } from "@safe-paws/db";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `Rescue board · ${SITE_NAME}`,
  description: "Track each rescued animal from street to home, with live updates for everyone involved.",
};

export default async function BoardPage() {
  // The board server checks the same cookie; this just lets the page render the right header straight away.
  const userId = await requireUserId();
  const user = await getUser(userId);
  // A valid cookie for an account that no longer exists.
  if (!user) redirect("/api/session/gone");
  return <BoardApp initialMe={user} />;
}
