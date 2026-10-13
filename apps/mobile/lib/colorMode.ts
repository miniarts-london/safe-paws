import * as SecureStore from "expo-secure-store";
import { Appearance, Platform } from "react-native";

/**
 * The light/dark switch. Until someone chooses, the app follows the phone's setting;
 * the choice is remembered on this phone, like the website's switch in the browser.
 */
const KEY = "safe-paws.color-mode";
const web = Platform.OS === "web";
/** Phones only: the web preview has no app-wide override (it follows the browser). */
export const canSwitchColorMode = typeof Appearance.setColorScheme === "function" && !web;

export async function restoreColorMode() {
  try {
    if (!canSwitchColorMode) return;
    const saved = await SecureStore.getItemAsync(KEY);
    if (canSwitchColorMode && (saved === "light" || saved === "dark")) Appearance.setColorScheme(saved);
  } catch {
    // Nothing saved, or storage unavailable: follow the phone.
  }
}

export async function setColorMode(mode: "light" | "dark") {
  if (!canSwitchColorMode) return;
  Appearance.setColorScheme(mode);
  try {
    await SecureStore.setItemAsync(KEY, mode);
  } catch {
    // Still switched for now, just not remembered.
  }
}
