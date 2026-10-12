import { animalFacts, NEUTERED_LABEL, photos } from "@safe-paws/shared/format";
import { STAGES, stageLabel } from "@safe-paws/shared/protocol";
import { useBoard, useCanEdit } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimalActions } from "@/components/AnimalActions";
import { SpeakButton } from "@/components/SpeakButton";
import { Avatar, Button, Empty, Pill } from "@/components/ui";
import { useConnection } from "@/lib/connection";
import { useMediaSource } from "@/lib/media";
import { useTheme } from "@/lib/theme";

export default function AnimalScreen() {
  const t = useTheme();
  // Two screens in one, like the website's two panels: the animal's details, or its updates.
  const { id, view: viewParam } = useLocalSearchParams<{ id: string; view?: string }>();
  const [view, setView] = useState<"details" | "updates">(viewParam === "updates" ? "updates" : "details");
  const animal = useBoard((s) => s.board?.animals[id]);
  const users = useBoard((s) => s.users);
  const me = useBoard((s) => s.me);
  const canEdit = useCanEdit();
  const { send } = useConnection();
  const source = useMediaSource();
  const now = useNow();
  const [draft, setDraft] = useState("");

  if (!animal) return <Empty>This animal isn&apos;t on the board any more.</Empty>;

  const following = !!me && animal.followers.includes(me);
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? uid;
  const post = () => {
    if (draft.trim() && send({ type: "animal.note", animalId: animal.id, text: draft })) setDraft("");
  };
  /** Spoken text goes after anything already typed, ready to check and post. */
  const addSpoken = (spoken: string) => setDraft((typed) => (typed.trim() ? `${typed.trimEnd()} ${spoken}` : spoken));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: animal.name }} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Avatar animal={animal} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: t.ink }]} accessibilityRole="header">
              {animal.name}
            </Text>
            <Text style={[styles.facts, { color: t.ink2 }]}>
              {animalFacts(animal)} · found in {animal.area}
            </Text>
          </View>
        </View>

        <View style={[styles.segment, { backgroundColor: t.card, borderColor: t.rule }]} accessibilityRole="tablist">
          {(["details", "updates"] as const).map((v) => {
            const active = view === v;
            return (
              <Pressable
                key={v}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setView(v)}
                style={[styles.segmentItem, active && { backgroundColor: t.sea }]}
              >
                <Text style={{ color: active ? t.onSea : t.ink2, fontWeight: "600", fontSize: 15 }}>
                  {v === "details" ? "Details" : `Updates (${animal.notes.length})`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {view === "details" ? (
          <>
            <View style={styles.pills}>
              <Pill active={animal.neutered === "yes"}>{NEUTERED_LABEL[animal.neutered]}</Pill>
              {animal.weightKg === null && <Pill>Not weighed yet</Pill>}
            </View>

            {!!animal.about && <Text style={[styles.about, { color: t.ink }]}>{animal.about}</Text>}

            {photos(animal).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                {photos(animal).map((m) => (
                  <Image key={m.id} source={source(m)} accessibilityLabel={m.name} style={[styles.photo, { backgroundColor: t.rule }]} />
                ))}
              </ScrollView>
            )}
            {animal.media.some((m) => m.kind === "video") && (
              <Text style={{ color: t.ink2, fontSize: 13 }}>Videos can be watched on the website.</Text>
            )}

            <Text style={[styles.label, { color: t.ink2 }]}>STAGE</Text>
            {!canEdit ? (
              <Text style={{ color: t.ink, fontSize: 16, fontWeight: "600" }}>{stageLabel(animal.stage)}</Text>
            ) : (
              <View style={styles.stages} accessibilityRole="radiogroup">
                {STAGES.map((s) => {
                  const active = s.id === animal.stage;
                  return (
                    <Pressable
                      key={s.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => !active && send({ type: "animal.move", animalId: animal.id, toStage: s.id, toIndex: 0 })}
                      style={[styles.stage, { backgroundColor: active ? t.sea : t.card, borderColor: active ? t.sea : t.rule }]}
                    >
                      <Text style={{ color: active ? t.onSea : t.ink, fontWeight: "600", fontSize: 14 }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Like, and offer to adopt or sponsor, as on the Animals tab. */}
            <AnimalActions animal={animal} showFollow={false} />

            <Button
              label={following ? "Following ✓" : "Follow updates"}
              variant={following ? "primary" : "outline"}
              onPress={() => send({ type: "animal.follow", animalId: animal.id, follow: !following })}
              accessibilityLabel={following ? "Following. Tap to stop following." : "Follow updates"}
            />
            <Text style={[styles.followers, { color: t.ink2 }]}>
              {animal.followers.length === 0 ? "Nobody follows this animal yet." : `Followed by ${animal.followers.map(name).join(", ")}.`}
            </Text>
          </>
        ) : (
          <>
            {canEdit && (
              <>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={`How is ${animal.name} doing? Followers will be notified.`}
                  placeholderTextColor={t.ink2}
                  multiline
                  accessibilityLabel="Post an update"
                  style={[styles.compose, { backgroundColor: t.card, borderColor: t.rule, color: t.ink }]}
                />
                <View style={styles.composeRow}>
                  {/* Speak instead of typing (ElevenLabs, via the website); only shows when it's set up. */}
                  <SpeakButton onText={addSpoken} />
                  <Button label="Post update" variant="primary" disabled={!draft.trim()} onPress={post} style={{ marginLeft: "auto" }} />
                </View>
              </>
            )}

            {!canEdit && <Text style={[styles.label, { color: t.ink2 }]}>UPDATES</Text>}
            {animal.notes.length === 0 ? (
              <Text style={{ color: t.ink2 }}>No updates yet.</Text>
            ) : (
              [...animal.notes].reverse().map((n) => (
                <View key={n.id} style={[styles.note, { borderLeftColor: t.rule }]}>
                  <Text style={[styles.noteText, { color: t.ink }]}>{n.text}</Text>
                  <Text style={{ color: t.ink2, fontSize: 12.5 }}>
                    {name(n.authorId)} · {timeAgo(n.at, now)}
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  name: { fontSize: 24, fontWeight: "700" },
  facts: { fontSize: 14, lineHeight: 20 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  about: { fontSize: 15, lineHeight: 22 },
  photos: { gap: 8 },
  photo: { width: 140, height: 140, borderRadius: 12 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  stages: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stage: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 99 },
  followers: { fontSize: 13, marginTop: -4 },
  compose: { minHeight: 90, padding: 12, borderWidth: 1, borderRadius: 12, fontSize: 15, textAlignVertical: "top" },
  note: { gap: 4, paddingLeft: 12, borderLeftWidth: 2 },
  segment: { flexDirection: "row", padding: 4, borderWidth: 1, borderRadius: 12, gap: 4 },
  segmentItem: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  composeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noteText: { fontSize: 15, lineHeight: 22 },
});
