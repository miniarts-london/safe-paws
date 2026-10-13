import { ROLE_LABELS, STAFF_ROLES, type Member, type StaffRole } from "@safe-paws/shared/protocol";
import { approveSchema, TITLE_MAX } from "@safe-paws/shared/schemas";
import { useBoard, useIsCoordinator } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Empty } from "@/components/ui";
import { useConnection } from "@/lib/connection";
import { useTheme } from "@/lib/theme";

const ROLE_HINT: Record<StaffRole, string> = {
  coordinator: "Runs the rescue; reviews new members",
  vet: "Hears when animals need a check",
  fosterer: "Hears when an animal needs a place to recover",
  sponsor: "Supports animals and follows their progress",
};

/** Coordinators only: new sign-ups waiting to be made staff or kept as members. Same as the website's Members dialog. */
export default function MembersScreen() {
  const t = useTheme();
  const isCoordinator = useIsCoordinator();
  const members = useBoard((s) => s.members);
  const waiting = members.filter((m) => m.reviewedAt === null);
  const kept = members.filter((m) => m.reviewedAt !== null);
  if (!isCoordinator) return <Empty>Only coordinators review members.</Empty>;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={{ color: t.ink2, fontSize: 14.5, lineHeight: 21 }}>
        Anyone can sign up and see the board. Make volunteers staff so they can update it.
      </Text>
      <Text style={[styles.section, { color: t.ink2 }]}>WAITING FOR REVIEW{waiting.length ? ` (${waiting.length})` : ""}</Text>
      {waiting.length === 0 ? (
        <Text style={{ color: t.ink2 }}>Nobody new. When someone signs up, they&apos;ll appear here.</Text>
      ) : (
        waiting.map((m) => <MemberRow key={m.id} member={m} />)
      )}
      {kept.length > 0 && (
        <>
          <Text style={[styles.section, { color: t.ink2 }]}>KEPT AS MEMBERS (LAST 30 DAYS)</Text>
          {kept.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function MemberRow({ member }: { member: Member }) {
  const t = useTheme();
  const { send } = useConnection();
  const now = useNow();
  const [role, setRole] = useState<StaffRole>("fosterer");
  const [title, setTitle] = useState(member.title === "New member" ? "" : member.title);
  const [error, setError] = useState("");

  const approve = () => {
    const parsed = approveSchema.safeParse({ userId: member.id, role, title });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the details.");
    setError("");
    send({ type: "member.approve", ...parsed.data });
  };

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
      <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16 }}>{member.name}</Text>
      <Text style={{ color: t.ink2, fontSize: 13.5 }} selectable>
        {member.email} · joined {timeAgo(member.joinedAt, now)}
      </Text>
      {member.title !== "New member" && <Text style={{ color: t.ink }}>“{member.title}”</Text>}
      <View style={styles.roles} accessibilityRole="radiogroup">
        {STAFF_ROLES.map((r) => {
          const active = r === role;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setRole(r)}
              style={[styles.role, { borderColor: active ? t.sea : t.rule, backgroundColor: active ? t.sea : "transparent" }]}
            >
              <Text style={{ color: active ? t.onSea : t.ink, fontWeight: "600" }}>{ROLE_LABELS[r]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: t.ink2, fontSize: 13 }}>{ROLE_HINT[role]}</Text>
      <TextInput
        value={title}
        onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
        placeholder="Shown under their name, e.g. Foster carer, Smouha"
        placeholderTextColor={t.ink2}
        accessibilityLabel="Shown under their name"
        style={[styles.input, { borderColor: error ? "#c62828" : t.rule, color: t.ink, backgroundColor: t.ground }]}
      />
      {!!error && <Text style={{ color: "#c62828", fontSize: 13 }}>{error}</Text>}
      <View style={[styles.roles, { justifyContent: "flex-end" }]}>
        {member.reviewedAt === null && (
          <Button label="Keep as member" variant="quiet" onPress={() => send({ type: "member.keep", userId: member.id })} />
        )}
        <Button label="Make staff" variant="primary" onPress={approve} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginTop: 6 },
  card: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 8 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  role: { minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  input: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, fontSize: 15 },
});
