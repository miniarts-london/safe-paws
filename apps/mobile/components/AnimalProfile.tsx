import { animalFacts, photos } from "@safe-paws/shared/format";
import { stageLabel, type Animal } from "@safe-paws/shared/protocol";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { router } from "expo-router";
import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useMediaSource } from "@/lib/media";
import { useTheme } from "@/lib/theme";
import { AnimalActions } from "./AnimalActions";
import { Pill } from "./ui";

/** An animal on the Animals tab: its photo, facts and story, and the ways to help. Tap to open everything. */
export const AnimalProfile = memo(function AnimalProfile({ animal }: { animal: Animal }) {
  const t = useTheme();
  const source = useMediaSource();
  const now = useNow();
  const cover = photos(animal).at(-1);
  const latest = animal.notes.at(-1);
  const open = () => router.push({ pathname: "/animal/[id]", params: { id: animal.id, view: "details" } });

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${animal.name}`} onPress={open} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        {/* A photo gets room to be seen; without one, a slim coloured band with their initial. */}
        {cover ? (
          <Image source={source(cover)} style={[styles.cover, { backgroundColor: t.rule }]} accessibilityLabel={`Photo of ${animal.name}`} />
        ) : (
          <View style={[styles.band, { backgroundColor: animal.species === "dog" ? t.dog : t.cat }]} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={[styles.initial, { color: animal.species === "dog" ? t.onDog : t.onCat }]}>{animal.name[0]}</Text>
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.top}>
            <Text style={[styles.name, { color: t.ink }]}>{animal.name}</Text>
            <Pill>{stageLabel(animal.stage)}</Pill>
          </View>
          <Text style={[styles.facts, { color: t.ink2 }]}>
            {animalFacts(animal)} · found in {animal.area}
          </Text>
          {!!animal.about && (
            <Text style={[styles.about, { color: t.ink }]} numberOfLines={3}>
              {animal.about}
            </Text>
          )}
        </View>
      </Pressable>
      {latest && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${animal.name}'s updates`}
          onPress={() => router.push({ pathname: "/animal/[id]", params: { id: animal.id, view: "updates" } })}
          style={styles.updates}
          hitSlop={6}
        >
          <Text style={{ color: t.sea, fontSize: 14, fontWeight: "600" }}>
            {animal.notes.length === 1 ? "1 update" : `${animal.notes.length} updates`} · latest {timeAgo(latest.at, now)} ›
          </Text>
        </Pressable>
      )}
      <View style={styles.actions}>
        <AnimalActions animal={animal} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  cover: { width: "100%", height: 200 },
  band: { height: 72, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 32, fontWeight: "700" },
  body: { padding: 14, paddingBottom: 6, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 19, fontWeight: "700", flexShrink: 1 },
  facts: { fontSize: 13.5, lineHeight: 19 },
  about: { fontSize: 14.5, lineHeight: 21 },
  actions: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 6 },
  updates: { paddingHorizontal: 14, paddingVertical: 6, minHeight: 32, justifyContent: "center" },
});
