import { isStaff, STAGES, type StageId } from "@safe-paws/shared/protocol";
import { HOME_STAGE } from "@safe-paws/shared/stages";
import { useBoard } from "@safe-paws/shared/store";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimalCard } from "@/components/AnimalCard";
import { Empty } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** The rescue board: one stage at a time, like the website's phone layout, starting where this person is most needed. */
export default function BoardScreen() {
  const t = useTheme();
  const board = useBoard((s) => s.board);
  const me = useBoard((s) => s.users.find((u) => u.id === s.me));
  const [picked, setPicked] = useState<StageId | null>(null);
  const stage = picked ?? (me ? HOME_STAGE[me.role] : "reported");

  if (!board) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.sea} />
      </View>
    );
  }

  const ids = board.columns[stage];
  const hint = STAGES.find((s) => s.id === stage)!.hint;

  return (
    <FlatList
      data={ids.map((id) => board.animals[id]).filter(Boolean)}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <AnimalCard animal={item} />}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={
        <View style={{ gap: 6, marginBottom: 10 }}>
          {me && !isStaff(me.role) && (
            <Text style={[styles.member, { backgroundColor: t.card, borderColor: t.rule, color: t.ink }]}>
              You can see every animal and follow the ones you care about. A coordinator can give you access to update
              the board.
            </Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stages}
            accessibilityRole="tablist"
          >
            {STAGES.map((s) => {
              const active = s.id === stage;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPicked(s.id)}
                  style={[styles.stage, { backgroundColor: active ? t.ink : t.card, borderColor: active ? t.ink : t.rule }]}
                >
                  <Text style={[styles.stageText, { color: active ? t.card : t.ink2 }]}>
                    {s.label} <Text style={{ opacity: 0.7 }}>{board.columns[s.id].length}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.hint, { color: t.ink2 }]}>{hint}</Text>
        </View>
      }
      ListEmptyComponent={<Empty>No animals here right now.</Empty>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingTop: 10 },
  stages: { gap: 8, paddingVertical: 2 },
  stage: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 99 },
  stageText: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 13 },
  member: { fontSize: 14, lineHeight: 20, padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 4 },
});
