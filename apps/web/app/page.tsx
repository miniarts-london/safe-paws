import { redirect } from "next/navigation";

/** The board is the app. Signed-out visitors are sent on to /login by proxy.ts. */
export default function Home() {
  redirect("/board");
}
