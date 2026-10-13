import { Ionicons } from "@expo/vector-icons";
import { photos } from "@safe-paws/shared/format";
import type { Animal } from "@safe-paws/shared/protocol";
import { useBoard, useIsCoordinator } from "@safe-paws/shared/store";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Empty } from "@/components/ui";
import { api, useToken } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useMediaSource } from "@/lib/media";
import { useTheme } from "@/lib/theme";

const TONES = [
  ["heartfelt", "Heartfelt"],
  ["story", "Story"],
  ["appeal", "Appeal for help"],
  ["good-news", "Good news"],
  ["updates", "Updates"],
] as const;
type Tone = (typeof TONES)[number][0];
/** Either one of the animal's photos (on the website) or one from this phone. */
type Photo = { kind: "animal"; mediaId: string; url: string } | { kind: "local"; uri: string } | null;

/**
 * Coordinators: write a post with Claude (or yourself), then share it to Instagram, Facebook and more
 * through the phone's share menu. Like the website's Social post page.
 */
export default function SocialScreen() {
  const t = useTheme();
  const isCoordinator = useIsCoordinator();
  const token = useToken();
  const source = useMediaSource();
  const board = useBoard((s) => s.board);
  const scroll = useRef<ScrollView>(null);
  const [search, setSearch] = useState("");
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("heartfelt");
  const [post, setPost] = useState("");
  const [photo, setPhoto] = useState<Photo>(null);
  const [busy, setBusy] = useState<null | "draft" | "share">(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [postY, setPostY] = useState(0);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !board) return [];
    return Object.values(board.animals).filter((a) => a.name.toLowerCase().includes(q)).slice(0, 8);
  }, [search, board]);

  if (!isCoordinator) return <Empty>Only coordinators can see this page.</Empty>;

  const pickAnimal = (a: Animal | null) => {
    setAnimal(a);
    setSearch("");
    if (photo?.kind === "animal") setPhoto(null);
  };

  const draft = async () => {
    setNote(null);
    setBusy("draft");
    try {
      const form = new FormData();
      form.append("topic", topic);
      form.append("tone", tone);
      form.append("animalId", animal?.id ?? "");
      const { post: text } = await api<{ post: string }>("/api/social/generate", token, { method: "POST", body: form });
      setPost(text);
      scroll.current?.scrollTo({ y: postY - 12, animated: true });
    } catch (e) {
      setNote({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const choose = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setNote({ kind: "error", text: "Photo access is off. Turn it on for this app in Settings." });
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled) setPhoto({ kind: "local", uri: r.assets[0].uri });
  };

  /**
   * The phone's share menu: with the photo if there is one, otherwise the text. Instagram and Facebook
   * throw away text sent with a photo, so the caption is copied first, to paste in the app.
   */
  const share = async () => {
    setNote(null);
    setBusy("share");
    try {
      await Clipboard.setStringAsync(post);
      if (!photo) {
        await Share.share({ message: post });
        return;
      }
      if (Platform.OS === "web" || !(await Sharing.isAvailableAsync())) {
        setNote({ kind: "ok", text: "The caption is copied. Sharing a photo works in the app on your phone." });
        return;
      }
      let uri = photo.kind === "local" ? photo.uri : "";
      if (photo.kind === "animal") {
        // Animal photos are private: download with the sign-in, then share the copy.
        const file = await File.downloadFileAsync(`${API_URL}${photo.url}`, new File(Paths.cache, `share-${photo.mediaId}.jpg`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          idempotent: true,
        });
        uri = file.uri;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/jpeg", UTI: "public.jpeg", dialogTitle: "Share the photo" });
      setNote({ kind: "ok", text: "Now paste the caption in the app: tap the caption box, then Paste." });
    } catch (e) {
      setNote({ kind: "error", text: (e as Error).message || "Couldn't open the share menu. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const animalPhotos = animal ? photos(animal) : [];

  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={{ color: t.ink2, fontSize: 14.5, lineHeight: 21 }}>
        Draft a post with Claude (or write it yourself), then share it to Instagram, Facebook and more.
      </Text>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
        <View style={styles.between}>
          <Text style={[styles.h2, { color: t.ink }]}>1. What&apos;s the post about?</Text>
          <Pressable onPress={() => scroll.current?.scrollTo({ y: postY - 12, animated: true })} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: t.sea, fontWeight: "600" }}>Skip ↓</Text>
          </Pressable>
        </View>
        <Text style={[styles.label, { color: t.ink2 }]}>Animal (optional)</Text>
        {animal ? (
          <View style={[styles.chosen, { backgroundColor: t.seaSoft }]}>
            <Text style={{ color: t.mint, fontWeight: "700", flex: 1 }}>{animal.name}</Text>
            <Pressable onPress={() => pickAnimal(null)} accessibilityRole="button" accessibilityLabel="Clear animal" hitSlop={8}>
              <Ionicons name="close" size={18} color={t.mint} />
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Type a name"
              placeholderTextColor={t.ink2}
              accessibilityLabel="Animal"
              style={[styles.input, { borderColor: t.rule, color: t.ink, backgroundColor: t.ground }]}
            />
            {matches.map((a) => (
              <Pressable key={a.id} onPress={() => pickAnimal(a)} accessibilityRole="button" style={[styles.option, { borderColor: t.rule }]}>
                <Text style={{ color: t.ink }}>{a.name}</Text>
              </Pressable>
            ))}
          </>
        )}
        <Text style={[styles.label, { color: t.ink2 }]}>What should it say? Give me some general idea and I&apos;ll write it for you :-)</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          multiline
          placeholder="e.g. Luna's mange is healing and she's ready for a foster home. We need help with her vet bills."
          placeholderTextColor={t.ink2}
          accessibilityLabel="What should it say?"
          style={[styles.input, styles.area, { borderColor: t.rule, color: t.ink, backgroundColor: t.ground }]}
        />
        <Text style={[styles.label, { color: t.ink2 }]}>Tone</Text>
        <View style={styles.wrap}>
          {TONES.map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setTone(id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: tone === id }}
              style={[styles.chip, { borderColor: tone === id ? t.sea : t.rule, backgroundColor: tone === id ? t.sea : "transparent" }]}
            >
              <Text style={{ color: tone === id ? t.onSea : t.ink, fontWeight: "600" }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {tone === "updates" && (
          <Text style={{ color: t.ink2, fontSize: 13 }}>
            {animal ? `Claude uses ${animal.name}'s latest updates (up to 3).` : "Claude uses the 3 latest updates from all the animals."}
          </Text>
        )}
        <Button
          label={busy === "draft" ? "Writing…" : post ? "Write it again" : "Write it with Claude"}
          variant="primary"
          busy={busy === "draft"}
          disabled={!!busy || (topic.trim().length < 8 && !animal && tone !== "updates")}
          onPress={draft}
        />
      </View>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]} onLayout={(e) => setPostY(e.nativeEvent.layout.y)}>
        <Text style={[styles.h2, { color: t.ink }]}>2. Your post</Text>
        <TextInput
          value={post}
          onChangeText={setPost}
          multiline
          placeholder="Write here, or let Claude draft it above. You can edit anything before posting."
          placeholderTextColor={t.ink2}
          accessibilityLabel="Post"
          style={[styles.input, { minHeight: 180, textAlignVertical: "top", borderColor: t.rule, color: t.ink, backgroundColor: t.ground }]}
        />
      </View>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
        <Text style={[styles.h2, { color: t.ink }]}>3. Share it</Text>
        <Text style={[styles.label, { color: t.ink }]}>1. Copy the caption</Text>
        <Button label={copied ? "Caption copied ✓" : "Copy caption"} onPress={copy} disabled={!post.trim()} style={{ alignSelf: "flex-start" }} />
        <Text style={[styles.label, { color: t.ink }]}>2. Add a photo (optional)</Text>
        <View style={styles.wrap}>
          {photo ? (
            <View>
              <Image
                source={photo.kind === "local" ? { uri: photo.uri } : source({ id: photo.mediaId, url: photo.url, kind: "photo", name: "", addedBy: "", at: 0 })}
                style={[styles.thumb, { width: 96, height: 96, backgroundColor: t.rule }]}
                accessibilityLabel="Chosen photo"
              />
              <Pressable onPress={() => setPhoto(null)} accessibilityRole="button" accessibilityLabel="Remove photo" style={[styles.remove, { backgroundColor: t.card }]} hitSlop={8}>
                <Ionicons name="close" size={16} color={t.ink} />
              </Pressable>
            </View>
          ) : (
            <>
              {animalPhotos.map((m) => (
                <Pressable key={m.id} onPress={() => setPhoto({ kind: "animal", mediaId: m.id, url: m.url })} accessibilityRole="button" accessibilityLabel={`Use this photo of ${animal!.name}`}>
                  <Image source={source(m)} style={[styles.thumb, { backgroundColor: t.rule }]} />
                </Pressable>
              ))}
              <Button label="Choose a photo" onPress={choose} />
            </>
          )}
        </View>
        {!photo && animal && animalPhotos.length > 0 && (
          <Text style={{ color: t.ink2, fontSize: 13 }}>Tap one of {animal.name}&apos;s photos or choose a new photo to use it.</Text>
        )}
        <Text style={[styles.label, { color: t.ink }]}>3. Post</Text>
        <Text style={{ color: t.ink2, fontSize: 13.5, lineHeight: 19 }}>
          {photo
            ? "Opens your phone's share menu with the photo. Pick Instagram, Facebook or another app, then paste the caption there."
            : "Opens your phone's share menu with the caption. Pick Facebook, WhatsApp or another app. (Instagram needs a photo.)"}
        </Text>
        <Button label="Post" variant="primary" busy={busy === "share"} disabled={!post.trim() || !!busy} onPress={share} />
        {busy === "share" && <ActivityIndicator color={t.sea} />}
      </View>

      {note && (
        <View style={[styles.note, { backgroundColor: note.kind === "ok" ? t.seaSoft : "#fdecea" }]} accessibilityLiveRegion="polite">
          <Text style={{ color: note.kind === "ok" ? t.mint : "#8a1c12", fontWeight: "600" }}>{note.text}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h2: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13.5, fontWeight: "700" },
  input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 10, fontSize: 15 },
  area: { minHeight: 90, textAlignVertical: "top" },
  option: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  chosen: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { minHeight: 38, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderRadius: 99 },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  remove: { position: "absolute", top: -6, right: -6, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  note: { padding: 12, borderRadius: 12 },
});
