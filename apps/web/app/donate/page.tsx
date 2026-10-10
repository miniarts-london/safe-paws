import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { DonatePage } from "@/components/DonatePage";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `Donate · ${SITE_NAME}`,
  description:
    "Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet visits and many other essentials.",
};

/** Public: anyone can donate, signed in or not. The details live in lib/donation.ts. */
export default async function Donate() {
  return <DonatePage signedIn={!!(await getSession())} />;
}
