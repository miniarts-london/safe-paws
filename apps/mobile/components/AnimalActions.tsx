import { Ionicons } from "@expo/vector-icons";
import type { Animal, RequestKind } from "@safe-paws/shared/protocol";
import { REQUEST_MESSAGE_MAX } from "@safe-paws/shared/schemas";
import { useBoard } from "@safe-paws/shared/store";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useConnection } from "@/lib/connection";
import { useTheme } from "@/lib/theme";
import { Button, Pill } from "./ui";

const OFFERED: Record<RequestKind, string> = { adopt: "You offered to adopt", sponsor: "You offered to sponsor" };

/** Follow, offer to adopt or sponsor, and like: the same on the Animals cards and on an animal's screen. Same rules as the website. */
export function AnimalActions({ animal, showFollow = true }: { animal: Animal; showFollow?: boolean }) {
  const t = useTheme();
  const me = useBoard((s) => s.me);
  const { send } = useConnection();
  const [offering, setOffering] = useState(false);
  const following = !!me && animal.followers.includes(me);
  const liked = !!me && animal.likes.includes(me);
  const mine = animal.requests.filter((r) => r.userId === me).map((r) => r.kind);
  // Adopting is for animals ready for a home; sponsoring helps any animal still in care.
  const canAdopt = animal.stage === "ready" && !mine.includes("adopt");
  const canSponsor = animal.stage !== "adopted" && !mine.includes("sponsor");
  const offerLabel = canAdopt && canSponsor ? "Adopt or sponsor" : canAdopt ? "Adopt" : "Sponsor";

  return (
    <View style={{ gap: 10 }}>
      {mine.length > 0 && (
        <Text style={{ color: t.mint, fontWeight: "600", fontSize: 14 }}>
          {mine.map((k) => OFFERED[k]).join(" and ")} {animal.name}. A coordinator will be in touch.
        </Text>
      )}
      <View style={styles.row}>
        {showFollow && (
          <Button
            label={following ? "Following" : "Follow"}
            variant={following ? "primary" : "outline"}
            onPress={() => send({ type: "animal.follow", animalId: animal.id, follow: !following })}
            accessibilityLabel={following ? `Following ${animal.name}. Tap to stop.` : `Follow ${animal.name}`}
          />
        )}
        {(canAdopt || canSponsor) && <Button label={offerLabel} variant="primary" onPress={() => setOffering(true)} />}
        {animal.stage === "adopted" && <Pill active>Has a home</Pill>}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={`Like ${animal.name}, ${animal.likes.length} likes`}
          onPress={() => send({ type: "animal.like", animalId: animal.id, like: !liked })}
          hitSlop={8}
          style={styles.like}
        >
          <Ionicons name={liked ? "heart" : "heart-outline"} size={24} color={liked ? t.sea : t.ink2} />
          <Text style={{ color: t.ink2, fontSize: 14, minWidth: 14 }}>{animal.likes.length}</Text>
        </Pressable>
      </View>
      <OfferSheet animal={animal} open={offering} canAdopt={canAdopt} canSponsor={canSponsor} onClose={() => setOffering(false)} />
    </View>
  );
}

/** Offer to adopt or sponsor, with an optional message. Every coordinator is told and gets in touch. */
function OfferSheet({
  animal,
  open,
  canAdopt,
  canSponsor,
  onClose,
}: {
  animal: Animal;
  open: boolean;
  canAdopt: boolean;
  canSponsor: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const { send } = useConnection();
  const [kind, setKind] = useState<RequestKind>(canAdopt ? "adopt" : "sponsor");
  const [message, setMessage] = useState("");
  const chosen: RequestKind = kind === "adopt" && !canAdopt ? "sponsor" : kind === "sponsor" && !canSponsor ? "adopt" : kind;

  const submit = () => {
    if (send({ type: "animal.request", animalId: animal.id, kind: chosen, message: message.trim() })) {
      setMessage("");
      onClose();
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.card }]} accessibilityViewIsModal>
          <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">
            Help {animal.name}
          </Text>
          <View style={styles.row} accessibilityRole="radiogroup">
            {(["adopt", "sponsor"] as const).map((k) => {
              const allowed = k === "adopt" ? canAdopt : canSponsor;
              const active = chosen === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled: !allowed }}
                  disabled={!allowed}
                  onPress={() => setKind(k)}
                  style={[styles.choice, { borderColor: active ? t.sea : t.rule, backgroundColor: active ? t.sea : "transparent", opacity: allowed ? 1 : 0.4 }]}
                >
                  <Text style={{ color: active ? t.onSea : t.ink, fontWeight: "600" }}>{k === "adopt" ? "Adopt" : "Sponsor"}</Text>
                </Pressable>
              );
            })}
          </View>
          {!canAdopt && (
            <Text style={{ color: t.ink2, fontSize: 13 }}>
              {animal.stage === "ready" ? "You've already offered to adopt." : `${animal.name} isn't ready for adoption yet.`}
            </Text>
          )}
          <TextInput
            value={message}
            onChangeText={(v) => setMessage(v.slice(0, REQUEST_MESSAGE_MAX))}
            placeholder="A message for the coordinators (optional)"
            placeholderTextColor={t.ink2}
            multiline
            accessibilityLabel="Message for the coordinators"
            style={[styles.message, { borderColor: t.rule, color: t.ink, backgroundColor: t.ground }]}
          />
          <Text style={{ color: t.ink2, fontSize: 12, alignSelf: "flex-end" }}>
            {message.length} / {REQUEST_MESSAGE_MAX}
          </Text>
          <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>
            A coordinator will get in touch by email. You&apos;ll also start following {animal.name}.
          </Text>
          <View style={[styles.row, { justifyContent: "flex-end" }]}>
            <Button label="Cancel" variant="quiet" onPress={onClose} />
            <Button label={chosen === "adopt" ? "Offer to adopt" : "Offer to sponsor"} variant="primary" onPress={submit} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  like: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto", minHeight: 44, paddingHorizontal: 4 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { padding: 20, paddingBottom: 32, gap: 12, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  title: { fontSize: 20, fontWeight: "700" },
  choice: { minHeight: 44, paddingHorizontal: 18, justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  message: { minHeight: 90, padding: 12, borderWidth: 1, borderRadius: 12, fontSize: 15, textAlignVertical: "top" },
});
