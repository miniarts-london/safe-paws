import { useBoard } from "@safe-paws/shared/store";
import { FlatList, StyleSheet, View } from "react-native";
import { AnimalCard } from "@/components/AnimalCard";
import { Empty } from "@/components/ui";

/** A feed of the animals you follow, newest news first. Sponsors mostly live here. */
export default function FollowingScreen() {
  const me = useBoard((s) => s.me);
  const animals = useBoard((s) => s.board?.animals);
  const mine = Object.values(animals ?? {})
    .filter((a) => me && a.followers.includes(me))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <FlatList
      data={mine}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <AnimalCard animal={item} showStage />}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        <Empty>You&apos;re not following any animals yet. Open one on the Board and tap Follow updates.</Empty>
      }
    />
  );
}

const styles = StyleSheet.create({ list: { padding: 16 } });
