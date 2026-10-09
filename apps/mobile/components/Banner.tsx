import { useBoard, type Toast } from "@safe-paws/shared/store";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

function BannerItem({ toast }: { toast: Toast }) {
  const t = useTheme();
  const dismiss = useBoard((s) => s.dismissToast);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.key), 5000);
    return () => clearTimeout(timer);
  }, [toast.key, dismiss]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${toast.notification.text}. Opens the animal.`}
      onPress={() => {
        dismiss(toast.key);
        router.push({ pathname: "/animal/[id]", params: { id: toast.notification.animalId } });
      }}
      style={[styles.banner, { backgroundColor: t.ink }]}
    >
      <Text style={[styles.text, { color: t.ground }]}>{toast.notification.text}</Text>
    </Pressable>
  );
}

/** In-app banners for notifications that arrive while the app is open (no push is sent then). */
export function Banners() {
  const toasts = useBoard((s) => s.toasts);
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]} accessibilityLiveRegion="polite">
      {toasts.slice(-2).map((toast) => (
        <BannerItem key={toast.key} toast={toast} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, gap: 8, zIndex: 10 },
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { fontSize: 14.5, lineHeight: 20 },
});
