import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type StoredSession = { token: string; userId: string; expiresAt: number };

const KEY = "safe-paws.session";

/**
 * On a phone the session lives in the Keychain (iOS) or Keystore (Android).
 * The web preview has no secure store, so it falls back to localStorage,
 * which is fine for a demo but not for real accounts.
 */
const web = Platform.OS === "web";

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = web ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    return s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: StoredSession) {
  const raw = JSON.stringify(s);
  if (web) globalThis.localStorage?.setItem(KEY, raw);
  else await SecureStore.setItemAsync(KEY, raw);
}

export async function clearSession() {
  if (web) globalThis.localStorage?.removeItem(KEY);
  else await SecureStore.deleteItemAsync(KEY);
}
