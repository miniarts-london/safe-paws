import { Ionicons } from "@expo/vector-icons";
import { useCanEdit } from "@safe-paws/shared/store";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "@/lib/theme";

/** Staff only: a round "Register" button floating over a list, like the website's on phones. */
export function RegisterButton() {
  const t = useTheme();
  const canEdit = useCanEdit();
  if (!canEdit) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Register an animal"
      onPress={() => router.push("/animal-form")}
      style={({ pressed }) => [styles.fab, { backgroundColor: t.sea, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="add" size={22} color={t.onSea} />
      <Text style={{ color: t.onSea, fontWeight: "700", fontSize: 16 }}>Register</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    minHeight: 52,
    borderRadius: 26,
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
});
