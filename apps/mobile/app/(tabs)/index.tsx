import { Ionicons } from "@expo/vector-icons";
import { isStaff, STAGE_IDS, STAGES, type Animal, type StageId } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimalProfile } from "@/components/AnimalProfile";
import { Empty } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/**
 * Every animal in the rescue's care, like the website's Animals page: search, filter,
 * and follow, like, adopt or sponsor. Where everyone lands after signing in.
 */
export default function AnimalsScreen() {
  const t = useTheme();
  const board = useBoard((s) => s.board);
  const me = useBoard((s) => s.users.find((u) => u.id === s.me));
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageId | "all">("all");
  const [species, setSpecies] = useState<Animal["species"] | "all">("all");

  // Board order: by stage, then as arranged within each column.
  const animals = useMemo(() => {
    if (!board) return [];
    const q = query.trim().toLowerCase();
    return STAGE_IDS.flatMap((s) => board.columns[s].map((id) => board.animals[id]))
      .filter(Boolean)
      .filter((a) => stage === "all" || a.stage === stage)
      .filter((a) => species === "all" || a.species === species)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.area.toLowerCase().includes(q));
  }, [board, query, stage, species]);

  if (!board) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={t.sea} />
      </View>
    );
  }
  const total = Object.keys(board.animals).length;

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? t.ink : t.card, borderColor: active ? t.ink : t.rule }]}
    >
      <Text style={[styles.chipText, { color: active ? t.card : t.ink2 }]}>{label}</Text>
    </Pressable>
  );

  return (
    <FlatList
      data={animals}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <AnimalProfile animal={item} />}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 12 }}>
          <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">
            Animals in our care
          </Text>
          <Text style={{ color: t.ink2, fontSize: 14.5, lineHeight: 21 }}>
            Follow an animal to get its news, or offer to adopt or sponsor and a coordinator will get in touch.
          </Text>
          {me && !isStaff(me.role) && (
            <Text style={[styles.member, { backgroundColor: t.card, borderColor: t.rule, color: t.ink }]}>
              You can see every animal and follow the ones you care about. If you volunteer with the rescue, a coordinator
              can give you access to update the board.
            </Text>
          )}
          <View style={[styles.search, { backgroundColor: t.card, borderColor: t.rule }]}>
            <Ionicons name="search" size={18} color={t.ink2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or area"
              placeholderTextColor={t.ink2}
              accessibilityLabel="Search by name or area"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[styles.searchInput, { color: t.ink }]}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chip("all-species", "All", species === "all", () => setSpecies("all"))}
            {chip("dog", "Dogs", species === "dog", () => setSpecies("dog"))}
            {chip("cat", "Cats", species === "cat", () => setSpecies("cat"))}
            <View style={[styles.divider, { backgroundColor: t.rule }]} />
            {chip("all-stages", "All stages", stage === "all", () => setStage("all"))}
            {STAGES.map((s) => chip(s.id, s.label, stage === s.id, () => setStage(s.id)))}
          </ScrollView>
          <Text style={{ color: t.ink2, fontSize: 13 }} accessibilityLiveRegion="polite">
            {animals.length === total ? `${total} animals` : `${animals.length} of ${total} animals`}
          </Text>
        </View>
      }
      ListEmptyComponent={<Empty>{total === 0 ? "No animals on the board yet." : "No animals match those filters."}</Empty>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: "700" },
  member: { fontSize: 14, lineHeight: 20, padding: 12, borderWidth: 1, borderRadius: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  chips: { gap: 8, paddingVertical: 2, alignItems: "center" },
  chip: { minHeight: 36, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 99 },
  chipText: { fontSize: 14, fontWeight: "600" },
  divider: { width: 1, height: 22, marginHorizontal: 2 },
});
