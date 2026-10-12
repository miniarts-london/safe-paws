import type { Metadata } from "next";
import { getUser } from "@safe-paws/db";
import { SITE_NAME } from "@/lib/site";
import { HomePage } from "@/components/screens/home/HomePage";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `${SITE_NAME} · Helping abandoned dogs of Egypt`,
  description:
    "Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet visits and many other essentials.",
};

/** The public home page. Donate goes to /donate. */
export default async function Home() {
  const session = await getSession();
  const user = session ? await getUser(session.uid) : null;
  return <HomePage signedIn={!!user} coordinator={user?.role === "coordinator"} />;
}
