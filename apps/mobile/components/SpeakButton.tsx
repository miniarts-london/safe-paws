import { Ionicons } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { appendFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { useTheme } from "@/lib/theme";

/** Long enough for any update, and well under the website's 4 MB upload limit. */
const MAX_MS = 180_000;

// Whether the website has speech to text set up (ELEVENLABS_API_KEY), asked once per app launch.
let available: Promise<boolean> | null = null;

/**
 * Say an update instead of typing it: records on the phone, the website's /api/transcribe
 * sends it to ElevenLabs, and the text comes back to `onText` to check before posting.
 * Shows nothing unless speech to text is set up on the website.
 */
export function SpeakButton({ onText, label = "Speak it" }: { onText: (text: string) => void; label?: string }) {
  const t = useTheme();
  const { state } = useAuth();
  const token = state.status === "signedIn" ? state.session.token : null;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { isRecording, durationMillis } = useAudioRecorderState(recorder, 250);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let live = true;
    available ??= fetch(`${API_URL}/api/transcribe`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((j: { available?: boolean }) => !!j.available)
      .catch(() => false);
    void available.then((ok) => live && setReady(ok));
    return () => {
      live = false;
    };
  }, [token]);

  const send = async (uri: string) => {
    setWorking(true);
    try {
      const form = new FormData();
      await appendFile(form, "audio", uri, Platform.OS === "web" ? "update.webm" : "update.m4a", Platform.OS === "web" ? "audio/webm" : "audio/m4a");
      const res = await fetch(`${API_URL}/api/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't turn that into text. Try again, or type the update.");
      if (!json.text) throw new Error("Didn't catch any words. Try again a little closer to the phone.");
      onText(json.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const stop = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (recorder.uri) await send(recorder.uri);
  };

  const start = async () => {
    setError("");
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("Microphone access is off. Turn it on for this app in Settings, then try again.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  // Stop on its own at the limit.
  useEffect(() => {
    if (isRecording && durationMillis >= MAX_MS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, durationMillis]);

  if (!ready) return null;
  const secs = Math.floor(durationMillis / 1000);

  return (
    <View style={{ gap: 6 }}>
      {working ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <ActivityIndicator color={t.sea} />
          <Text style={{ color: t.ink2 }}>Writing it down…</Text>
        </View>
      ) : isRecording ? (
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={stop} style={[styles.button, { backgroundColor: "#c62828", borderColor: "#c62828" }]}>
            <Ionicons name="stop" size={18} color="#fff" />
            <Text style={[styles.label, { color: "#fff" }]}>Stop</Text>
          </Pressable>
          <View style={[styles.dot, { backgroundColor: "#c62828" }]} />
          <Text style={{ color: t.ink, fontVariant: ["tabular-nums"] }} accessibilityLiveRegion="polite">
            Listening… {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label === "Speak it" ? "Speak the update" : label}
          onPress={start}
          style={({ pressed }) => [styles.button, { borderColor: t.sea, opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="mic-outline" size={18} color={t.sea} />
          <Text style={[styles.label, { color: t.sea }]}>{label}</Text>
        </Pressable>
      )}
      {!!error && (
        <Text style={{ color: "#c62828", fontSize: 13 }} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  button: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, alignSelf: "flex-start" },
  label: { fontSize: 15, fontWeight: "600" },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
