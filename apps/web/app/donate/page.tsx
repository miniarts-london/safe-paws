import type { Metadata } from "next";
import { getUser } from "@safe-paws/db";
import BoardApp from "@/components/screens/board/BoardClient";
import { DonatePage } from "@/components/screens/donate/DonatePage";
import { getSession } from "@/lib/auth/session";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Donate · ${SITE_NAME}`,
  description:
    "Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet visits and many other essentials.",
};

/**
 * Public: anyone can donate. Signed-in people see it inside the app, with the
 * same menu as the other pages; visitors see the public header.
 * The details live in lib/donation.ts.
 */
export default async function Donate() {
  const session = await getSession();
  const user = session ? await getUser(session.uid) : null;
  return user ? <BoardApp initialMe={user} view="donate" /> : <DonatePage />;
}
