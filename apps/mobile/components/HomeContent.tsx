import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { HORIZON_HEIGHT, NatureBackdrop } from "@/components/NatureBackdrop";
import { useTheme } from "@/lib/theme";

/**
 * Home, like the website's home page on a phone: the desert scene and the
 * headline. Staff get big shortcuts to their work; everyone else gets the
 * donation message with Donate and Meet our animals. Visitors who aren't
 * signed in see it too (Meet our animals then asks them to sign in).
 */
export function HomeContent({ staff = false, coordinator = false, visitor = false }: { staff?: boolean; coordinator?: boolean; visitor?: boolean }) {
  const t = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <NatureBackdrop />
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={[styles.headline, { color: t.ink }]} accessibilityRole="header">
          Helping abandoned Dogs of Egypt.
        </Text>

        {staff ? (
          <View style={styles.stack} accessibilityLabel="Shortcuts">
            <Shortcut icon="paw-outline" label="Animals" to="/animals" />
            <Shortcut icon="albums-outline" label="Rescue board" to="/board" />
            {coordinator && <Shortcut icon="megaphone-outline" label="Social media post" to="/social" />}
            <Shortcut
              icon="add"
              label="Register a new animal"
              primary
              onPress={() => {
                // Like the website: the board, with the register form open over it.
                router.navigate("/board");
                router.push("/animal-form");
              }}
            />
          </View>
        ) : (
          <>
            <Text style={[styles.copy, { color: t.ink2 }]}>
              Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet visits and
              many other essentials.
            </Text>
            <Text style={[styles.copy, { color: t.ink2 }]}>
              Your contribution is greatly appreciated and makes a huge difference to our animals’ lives.
            </Text>
            <View style={styles.stack}>
              <Shortcut icon="heart-outline" label="Donate" to="/donate" primary centred />
              <Shortcut
                icon="arrow-forward"
                label="Meet our animals"
                onPress={() => (visitor ? router.push("/login") : router.navigate("/animals"))}
                centred
                iconAfter
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

type ShortcutProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  to?: Href;
  onPress?: () => void;
  primary?: boolean;
  centred?: boolean;
  iconAfter?: boolean;
};

/** A big, full-width button. The plain ones are see-through over the sky: white by day, deep plum at night. */
function Shortcut({ icon, label, to, onPress, primary, centred, iconAfter }: ShortcutProps) {
  const t = useTheme();
  const dark = useColorScheme() === "dark";
  const ink = primary ? t.onSea : t.sea;
  const glyph = <Ionicons name={icon} size={22} color={ink} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ?? (() => to && router.navigate(to))}
      style={({ pressed }) => [
        styles.shortcut,
        {
          justifyContent: centred ? "center" : "flex-start",
          borderColor: t.sea,
          backgroundColor: primary
            ? t.sea
            : dark
              ? `rgba(56, 18, 36, ${pressed ? 0.8 : 0.5})`
              : `rgba(255, 255, 255, ${pressed ? 0.85 : 0.55})`,
          opacity: primary && pressed ? 0.85 : 1,
        },
      ]}
    >
      {!iconAfter && glyph}
      <Text style={[styles.shortcutText, { color: ink }]}>{label}</Text>
      {iconAfter && glyph}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
    // Room at the bottom for the dunes and palm.
    paddingBottom: HORIZON_HEIGHT + 16,
    gap: 24,
    alignItems: "center",
  },
  headline: { fontSize: 40, fontWeight: "300", lineHeight: 44, letterSpacing: -1.2, textAlign: "center", maxWidth: 380 },
  copy: { fontSize: 18, lineHeight: 29, textAlign: "center", maxWidth: 640 },
  stack: { alignSelf: "stretch", gap: 12, paddingTop: 8 },
  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  shortcutText: { fontSize: 18, fontWeight: "600" },
});
