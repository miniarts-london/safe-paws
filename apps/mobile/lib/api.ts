import { Platform } from "react-native";
import { useAuth } from "./auth";
import { API_URL } from "./config";

/** The signed-in person's token, sent as a Bearer token to the website's API. */
export function useToken() {
  const { state } = useAuth();
  return state.status === "signedIn" ? state.session.token : null;
}

/** JSON from the website's API, with the error message it sends when something's wrong. */
export async function api<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json;
}

/** Adds a local file (a photo or a recording) to a form upload. React Native sends it from its uri; the web preview needs the bytes. */
export async function appendFile(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append(field, new File([blob], name, { type: blob.type || type }));
  } else {
    form.append(field, { uri, name, type } as unknown as Blob);
  }
}
