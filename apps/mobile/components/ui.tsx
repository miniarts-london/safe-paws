import type { Animal } from "@safe-paws/shared/protocol";
import type { ReactNode } from "react";
import { photos } from "@safe-paws/shared/format";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useMediaSource } from "@/lib/media";
import { useTheme } from "@/lib/theme";

export function Avatar({ animal, size = 44 }: { animal: Animal; size?: number }) {
  const t = useTheme();
  const source = useMediaSource();
  const photo = photos(animal).at(-1);
  if (photo) {
    return (
      <Image
        source={source(photo)}
        style={{ width: size, height: size, borderRadius: 10, backgroundColor: t.rule }}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View
      style={[styles.avatar, { width: size, height: size, backgroundColor: animal.species === "dog" ? t.dog : t.cat }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{animal.name[0]}</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "quiet";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** 44pt minimum height: a comfortable thumb target on both platforms. */
export function Button({ label, onPress, variant = "outline", disabled, busy, style, accessibilityLabel }: ButtonProps) {
  const t = useTheme();
  const look =
    variant === "primary"
      ? { backgroundColor: t.sea, borderColor: t.sea, color: t.onSea }
      : variant === "quiet"
        ? { backgroundColor: "transparent", borderColor: "transparent", color: t.ink2 }
        : { backgroundColor: "transparent", borderColor: t.sea, color: t.sea };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.backgroundColor, borderColor: look.borderColor, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={look.color} /> : <Text style={[styles.buttonText, { color: look.color }]}>{label}</Text>}
    </Pressable>
  );
}

export function Pill({ children, active }: { children: ReactNode; active?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: active ? t.seaSoft : t.ground }]}>
      <Text style={[styles.pillText, { color: active ? t.mint : t.ink2 }]}>{children}</Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { borderColor: t.rule }]}>
      <Text style={[styles.emptyText, { color: t.ink2 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", borderRadius: 10 },
  avatarText: { color: "#fff", fontWeight: "700" },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 15, fontWeight: "600" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  pillText: { fontSize: 12, fontWeight: "600" },
  empty: { margin: 16, padding: 20, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12 },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
});
