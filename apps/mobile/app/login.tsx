import { DEMO_PASSWORD, demoLogins, seedUsers } from "@safe-paws/shared/seed";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

/** Demo buttons in development builds only, unless EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS says otherwise. */
const SHOW_DEMOS = process.env.EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS ? process.env.EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS === "true" : __DEV__;

export default function Login() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e = email, p = password) => {
    if (!e.trim() || !p) return setError("Enter your email and password.");
    setBusy(true);
    setError(await signIn(e.trim(), p));
    setBusy(false);
  };

  const input = [styles.input, { backgroundColor: t.ground, borderColor: t.rule, color: t.ink }];

  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={{ flex: 1, backgroundColor: t.ground }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
            <Text style={[styles.title, { color: t.ink }]} accessibilityRole="header">
              Egypt Animal SOS
            </Text>
            <Text style={[styles.lede, { color: t.ink2 }]}>
              Sign in to see the animals in care and get updates on the ones you follow.
            </Text>

            <Text style={[styles.label, { color: t.ink2 }]}>Email</Text>
            <TextInput
              style={input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              accessibilityLabel="Email"
              returnKeyType="next"
            />
            <Text style={[styles.label, { color: t.ink2 }]}>Password</Text>
            <TextInput
              style={input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              accessibilityLabel="Password"
              returnKeyType="go"
              onSubmitEditing={() => submit()}
            />
            {error && (
              <Text accessibilityRole="alert" style={[styles.error, { color: t.signal }]}>
                {error}
              </Text>
            )}
            <Button label="Sign in" variant="primary" busy={busy} onPress={() => submit()} style={{ marginTop: 8 }} />
            <Button label="New here? Create an account" variant="quiet" onPress={() => router.push("/join")} />

            {SHOW_DEMOS && (
              <View style={[styles.demo, { borderTopColor: t.rule }]}>
                <Text style={[styles.demoTitle, { color: t.ink }]}>Try it with a demo account</Text>
                <Text style={[styles.demoHint, { color: t.ink2 }]}>
                  Sign in as someone else on the web app at the same time to watch updates arrive here. Demo password:{" "}
                  {DEMO_PASSWORD}
                </Text>
                {demoLogins.map((d) => {
                  const user = seedUsers.find((u) => u.id === d.userId)!;
                  return (
                    <Pressable
                      key={d.email}
                      accessibilityRole="button"
                      accessibilityLabel={`Sign in as ${user.name}, ${user.title}`}
                      disabled={busy}
                      onPress={() => submit(d.email, DEMO_PASSWORD)}
                      style={({ pressed }) => [styles.demoBtn, { borderColor: t.rule, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={[styles.demoName, { color: t.ink }]}>{user.name}</Text>
                      <Text style={[styles.demoRole, { color: t.ink2 }]}>{user.title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: 16 },
  card: { gap: 6, padding: 22, borderWidth: 1, borderRadius: 18, maxWidth: 440, width: "100%", alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "700" },
  lede: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  input: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, fontSize: 16 },
  error: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  demo: { gap: 8, marginTop: 18, paddingTop: 16, borderTopWidth: 1 },
  demoTitle: { fontSize: 15, fontWeight: "700" },
  demoHint: { fontSize: 13, lineHeight: 19 },
  demoBtn: { minHeight: 52, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 12 },
  demoName: { fontSize: 15, fontWeight: "600" },
  demoRole: { fontSize: 13 },
});
