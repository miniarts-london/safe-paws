import { PASSWORD_MIN, registerSchema, TITLE_MAX } from "@safe-paws/shared/schemas";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

/** Create an account from the app. Everyone joins as a member; a coordinator can make them staff. Same rules as the website. */
export default function Join() {
  const t = useTheme();
  const { join } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", title: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
    setBusy(true);
    setError(await join({ ...parsed.data, title: parsed.data.title ?? "" }));
    setBusy(false);
  };

  const input = [styles.input, { backgroundColor: t.ground, borderColor: t.rule, color: t.ink }];
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1, backgroundColor: t.ground }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
            <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">
              Join Egypt Animal SOS
            </Text>
            <Text style={{ color: t.ink2, fontSize: 15, lineHeight: 22 }}>
              See every animal in our care and follow the ones you love. If you volunteer with the rescue, a coordinator can give you
              access to update the board.
            </Text>
            <Text style={[styles.label, { color: t.ink2 }]}>Your name</Text>
            <TextInput style={input} value={form.name} onChangeText={set("name")} textContentType="name" autoComplete="name" accessibilityLabel="Your name" />
            <Text style={[styles.label, { color: t.ink2 }]}>Email</Text>
            <TextInput
              style={input}
              value={form.email}
              onChangeText={set("email")}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              accessibilityLabel="Email"
            />
            <Text style={[styles.label, { color: t.ink2 }]}>Password</Text>
            <TextInput
              style={input}
              value={form.password}
              onChangeText={set("password")}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              accessibilityLabel="Password"
            />
            <Text style={{ color: t.ink2, fontSize: 12.5 }}>At least {PASSWORD_MIN} characters.</Text>
            <Text style={[styles.label, { color: t.ink2 }]}>How would you like to help? (optional)</Text>
            <TextInput
              style={input}
              value={form.title}
              onChangeText={(v) => set("title")(v.slice(0, TITLE_MAX))}
              placeholder="e.g. Foster carer, Smouha"
              placeholderTextColor={t.ink2}
              accessibilityLabel="How would you like to help?"
            />
            {error && (
              <Text accessibilityRole="alert" style={{ color: t.signal, fontSize: 14 }}>
                {error}
              </Text>
            )}
            <Button label="Create account" variant="primary" busy={busy} onPress={submit} style={{ marginTop: 8 }} />
            <Button label="I already have an account" variant="quiet" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: 16 },
  card: { padding: 20, borderWidth: 1, borderRadius: 16, gap: 8 },
  title: { fontSize: 24, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, fontSize: 16 },
});
