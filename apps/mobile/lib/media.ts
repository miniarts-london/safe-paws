import type { Media } from "@safe-paws/shared/protocol";
import { useAuth } from "./auth";
import { API_URL } from "./config";

/**
 * Image source for an uploaded photo. Media is only served to signed-in
 * people, so the app sends its token with the request.
 */
export function useMediaSource() {
  const { state } = useAuth();
  const token = state.status === "signedIn" ? state.session.token : null;
  return (m: Media) => ({ uri: `${API_URL}${m.url}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
}
