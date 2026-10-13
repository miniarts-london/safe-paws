import { Ionicons } from "@expo/vector-icons";
import { animalFacts } from "@safe-paws/shared/format";
import { stageLabel } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Button } from "./ui";

/**
 * Coordinators: who offered to adopt or sponsor, how to reach them, and a short summary of the animal.
 * Opens from an offer notification, like the website's popup. Emails only ever reach coordinators.
 */
export function OfferContact({ offer, onClose }: { offer: { animalId: string; userId: string } | null; onClose: () => void }) {
  const t = useTheme();
  const now = useNow();
  const animal = useBoard((s) => (offer ? s.board?.animals[offer.animalId] : undefined));
  const person = useBoard((s) => s.users.find((u) => u.id === offer?.userId));
  const [copied, setCopied] = useState(false);
  const requests = animal?.requests.filter((r) => r.userId === offer?.userId) ?? [];
  const email = requests.find((r) => r.email)?.email;

  return (
    <Modal visible={!!offer} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.card }]} accessibilityViewIsModal>
          {!animal || requests.length === 0 ? (
            <Text style={{ color: t.ink2 }}>This offer isn&apos;t there any more.</Text>
          ) : (
            <>
              <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">
                {person?.name ?? "Someone"} would like to {requests.map((r) => r.kind).join(" and ")} {animal.name}
              </Text>
              {email && (
                <View style={styles.row}>
                  <Pressable
                    onPress={() => Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(`About ${animal.name}`)}`)}
                    accessibilityRole="link"
                    style={{ flex: 1 }}
                  >
                    <Text style={{ color: t.sea, fontSize: 16, fontWeight: "600" }}>{email}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={copied ? "Email copied" : "Copy email"}
                    onPress={async () => {
                      await Clipboard.setStringAsync(email);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={copied ? t.mint : t.ink2} />
                  </Pressable>
                </View>
              )}
              {requests.map(
                (r) =>
                  !!r.message && (
                    <Text key={r.kind} style={[styles.message, { color: t.ink, borderLeftColor: t.rule }]}>
                      {r.message}
                    </Text>
                  ),
              )}
              <Text style={{ color: t.ink2, fontSize: 13 }}>{timeAgo(requests.at(-1)!.at, now)}</Text>
              <View style={[styles.animal, { backgroundColor: t.ground }]}>
                <Text style={{ color: t.ink, fontWeight: "700" }}>{animal.name}</Text>
                <Text style={{ color: t.ink2 }}>
                  {animalFacts(animal)} · {stageLabel(animal.stage)} · found in {animal.area}
                </Text>
              </View>
              <View style={[styles.row, { justifyContent: "flex-end" }]}>
                <Button
                  label="See all details"
                  variant="quiet"
                  onPress={() => {
                    onClose();
                    router.push({ pathname: "/animal/[id]", params: { id: animal.id, view: "details" } });
                  }}
                />
                {email && (
                  <Button
                    label="Email them"
                    variant="primary"
                    onPress={() => Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(`About ${animal.name}`)}`)}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { padding: 20, paddingBottom: 32, gap: 12, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  title: { fontSize: 19, fontWeight: "700", lineHeight: 25 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  message: { fontSize: 15, lineHeight: 22, paddingLeft: 12, borderLeftWidth: 2 },
  animal: { padding: 12, borderRadius: 12, gap: 2 },
});
