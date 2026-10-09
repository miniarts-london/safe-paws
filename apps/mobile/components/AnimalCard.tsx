import { animalFacts } from "@safe-paws/shared/format";
import { stageLabel, type Animal } from "@safe-paws/shared/protocol";
import { NEXT_ACTION, nextStage } from "@safe-paws/shared/stages";
import { useBoard, useCanEdit } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useConnection } from "@/lib/connection";
import { useTheme } from "@/lib/theme";
import { Avatar, Button, Pill } from "./ui";

/** One animal in a list. `showStage` is for the Following feed, where animals come from every stage. */
export const AnimalCard = memo(function AnimalCard({ animal, showStage = false }: { animal: Animal; showStage?: boolean }) {
  const t = useTheme();
  const me = useBoard((s) => s.me);
  const users = useBoard((s) => s.users);
  const { send } = useConnection();
  const now = useNow();
  const canEdit = useCanEdit();
  const next = canEdit ? nextStage(animal.stage) : null;
  const latest = animal.notes.at(-1);
  const by = users.find((u) => u.id === animal.updatedBy)?.name ?? "someone";
  const following = !!me && animal.followers.includes(me);

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${animal.name}`}
        onPress={() => router.push({ pathname: "/animal/[id]", params: { id: animal.id } })}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={styles.top}>
          <Avatar animal={animal} />
          <View style={styles.id}>
            <Text style={[styles.name, { color: t.ink }]}>{animal.name}</Text>
            <Text style={[styles.facts, { color: t.ink2 }]}>
              {animalFacts(animal)}
            </Text>
          </View>
          {showStage ? <Pill>{stageLabel(animal.stage)}</Pill> : following ? <Pill active>Following</Pill> : null}
        </View>
        {latest && (
          <Text style={[styles.note, { color: t.ink }]} numberOfLines={3}>
            {latest.text}
          </Text>
        )}
        <Text style={[styles.foot, { color: t.ink2 }]}>
          <Text style={{ color: t.ink, fontWeight: "600" }}>{animal.area}</Text> · {timeAgo(animal.updatedAt, now)} · {by}
        </Text>
      </Pressable>
      {next && !showStage && (
        <Button
          label={`${NEXT_ACTION[next]} →`}
          onPress={() => send({ type: "animal.move", animalId: animal.id, toStage: next, toIndex: 0 })}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14, borderWidth: 1, borderRadius: 14 },
  main: { gap: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  id: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: "700" },
  facts: { fontSize: 13 },
  note: { fontSize: 14.5, lineHeight: 21 },
  foot: { fontSize: 12.5 },
});
