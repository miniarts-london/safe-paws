import { isStaff } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { HomeContent } from "@/components/HomeContent";

/** Home for people signed in: shortcuts for staff, the donation message for everyone else. */
export default function HomeScreen() {
  const me = useBoard((s) => s.users.find((u) => u.id === s.me));
  return <HomeContent staff={!!me && isStaff(me.role)} coordinator={me?.role === "coordinator"} />;
}
