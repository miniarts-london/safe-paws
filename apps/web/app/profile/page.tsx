import type { Metadata } from "next";
import { getUser, getUserEmail } from "@safe-paws/db";
import { redirect } from "next/navigation";
import BoardApp from "@/components/screens/board/BoardClient";
import { requireUserId } from "@/lib/auth/session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `Profile · ${SITE_NAME}` };

/** Your name, the line under it, and your password. Everyone signed in. */
export default async function ProfilePage() {
  const userId = await requireUserId();
  const [user, email] = await Promise.all([getUser(userId), getUserEmail(userId)]);
  if (!user) redirect("/api/session/gone");
  return <BoardApp initialMe={user} view="profile" email={email ?? ""} />;
}
