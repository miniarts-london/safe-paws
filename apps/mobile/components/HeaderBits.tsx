import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, useColorScheme } from "react-native";
import { canSwitchColorMode, setColorMode } from "@/lib/colorMode";
import { useTheme } from "@/lib/theme";

/** The rescue's name in the top bar. Tapping it goes home, like the name in the website's header. */
export function HomeTitle() {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Egypt Animal SOS, home" onPress={() => router.navigate("/")} hitSlop={8}>
      <Text style={{ color: t.headerInk, fontWeight: "700", fontSize: 19 }}>Egypt Animal SOS</Text>
    </Pressable>
  );
}

/** Light or dark, like the switch on the website. Phones only. */
export function ColorModeButton() {
  const t = useTheme();
  const dark = useColorScheme() === "dark";
  if (!canSwitchColorMode) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dark ? "Switch to light mode" : "Switch to dark mode"}
      onPress={() => setColorMode(dark ? "light" : "dark")}
      hitSlop={10}
    >
      <Ionicons name={dark ? "sunny-outline" : "moon-outline"} size={22} color={t.ink2} />
    </Pressable>
  );
}
