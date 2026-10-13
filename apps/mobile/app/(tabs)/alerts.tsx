import type { Notification } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { OfferContact } from "@/components/OfferContact";
import { Empty } from "@/components/ui";
import { useConnection } from "@/lib/connection";
import { useTheme } from "@/lib/theme";

export default function AlertsScreen() {
  const t = useTheme();
  const notifications = useBoard((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;
  const { send } = useConnection();
  const now = useNow();

  const markRead = (ids: number[] | "all") => {
    useBoard.getState().markRead(ids); // optimistic; the server syncs your other devices
    send({ type: "notifications.read", ids });
  };

  const [offer, setOffer] = useState<{ animalId: string; userId: string } | null>(null);
  const open = (n: Notification) => {
    if (!n.read) markRead([n.id]);
    // Coordinators: an offer to adopt or sponsor shows who it's from and how to reach them.
    if (n.kind === "request") return setOffer({ animalId: n.animalId, userId: n.actorId });
    // A new update opens the animal's Updates; anything else its Details.
    router.push({ pathname: "/animal/[id]", params: { id: n.animalId, view: n.kind === "note" ? "updates" : "details" } });
  };

  return (
    <>
      <OfferContact offer={offer} onClose={() => setOffer(null)} />
      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListHeaderComponent={
          unread > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => markRead("all")} hitSlop={8} style={styles.markAll}>
              <Text style={{ color: t.sea, fontSize: 15, fontWeight: "600" }}>Mark all as read</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item: n }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${n.read ? "" : "Unread. "}${n.text}`}
            onPress={() => open(n)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: n.read ? t.card : t.seaSoft, borderColor: t.rule, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            {!n.read && <View style={[styles.dot, { backgroundColor: t.signal }]} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.text, { color: t.ink }]}>{n.text}</Text>
              <Text style={[styles.time, { color: t.ink2 }]}>{timeAgo(n.at, now)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Empty>Nothing yet. You&apos;ll hear here when an animal you follow, or one that needs you, changes.</Empty>}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  markAll: { alignSelf: "flex-end", paddingVertical: 4, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10, padding: 14, borderWidth: 1, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  text: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 12.5 },
});
