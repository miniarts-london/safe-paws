import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * In development the phone talks to your computer. Expo already knows its
 * address (it's how the phone loaded this app), so reuse that host with the
 * web app's and board server's ports. Override with EXPO_PUBLIC_* in production.
 */
function devHost() {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.hostname;
  return Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${devHost()}:3000`;
export const BOARD_WS_URL = process.env.EXPO_PUBLIC_BOARD_WS_URL ?? `ws://${devHost()}:8788`;
