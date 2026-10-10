import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { HomePage } from "@/components/HomePage";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `${SITE_NAME} · Helping abandoned dogs of Egypt`,
  description:
    "Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet visits and many other essentials.",
};

/** The public home page. Donate goes to /donate. */
export default async function Home() {
  return <HomePage signedIn={!!(await getSession())} />;
}
