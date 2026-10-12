/**
 * Push notifications through Expo's push service, for people whose app is
 * closed or in the background. Tokens are stored in Postgres, so phones keep
 * getting pushes after the server restarts.
 */
import { addPushToken, pushTokensFor, removePushToken } from "@safe-paws/db";
import type { Notification } from "@safe-paws/shared/protocol";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const looksLikeExpoToken = (t: string) => /^Expo(nent)?PushToken\[.+\]$/.test(t);

export async function registerPushToken(userId: string, token: string) {
  if (!looksLikeExpoToken(token)) return false;
  await addPushToken(userId, token); // a device belongs to whoever signed in on it last
  return true;
}

export const unregisterPushToken = (userId: string, token: string) => removePushToken(token, userId);

type Ticket = { status: "ok" | "error"; details?: { error?: string } };

export async function sendPush(n: Notification) {
  try {
    const to = await pushTokensFor(n.userId);
    if (to.length === 0) return;
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        to.map((token) => ({ to: token, title: "Egypt Animal SOS", body: n.text, sound: "default", data: { animalId: n.animalId, kind: n.kind } })),
      ),
    });
    const json = (await res.json()) as { data?: Ticket[] };
    // Forget devices that have uninstalled the app or turned notifications off.
    await Promise.all(
      (json.data ?? []).map((ticket, i) =>
        ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? removePushToken(to[i]) : null,
      ),
    );
  } catch (err) {
    console.warn("[safe-paws] push failed:", (err as Error).message);
  }
}
