import { HomeContent } from "@/components/HomeContent";

/** Home for visitors who aren't signed in, like the website's home page. Sign in is in the top bar. */
export default function WelcomeScreen() {
  return <HomeContent visitor />;
}
