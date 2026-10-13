import { Ionicons } from "@expo/vector-icons";
import { KNOWN_AREAS } from "@safe-paws/shared/format";
import type { Animal, AnimalDetailsInput } from "@safe-paws/shared/protocol";
import { ABOUT_MAX, animalDetailsSchema, MEDIA_MAX } from "@safe-paws/shared/schemas";
import { useBoard, useCanEdit, useIsCoordinator } from "@safe-paws/shared/store";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SpeakButton } from "@/components/SpeakButton";
import { Button, Empty } from "@/components/ui";
import { api, appendFile, useToken } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useConnection } from "@/lib/connection";
import { useTheme, type Theme } from "@/lib/theme";

type Form = Omit<AnimalDetailsInput, "age" | "weightKg"> & {
  // Text while typing; numbers once saved.
  ageValue: string;
  ageUnit: "weeks" | "months" | "years";
  ageEstimated: boolean;
  weight: string;
};
type Photo = { id: string; kind: "photo" | "video"; name: string; uri: string };
type Spoken = {
  name: string | null;
  species: "dog" | "cat" | null;
  sex: "female" | "male" | null;
  age: { value: number; unit: "weeks" | "months" | "years"; estimated: boolean } | null;
  neutered: "yes" | "no" | "unknown" | null;
  weightKg: number | null;
  area: string | null;
  about: string | null;
};

const EMPTY: Form = {
  name: "",
  species: "dog",
  sex: "female",
  ageValue: "",
  ageUnit: "years",
  ageEstimated: true,
  neutered: "unknown",
  weight: "",
  area: "",
  about: "",
  media: [],
};

function fromAnimal(a: Animal): Form {
  return {
    name: a.name,
    species: a.species,
    sex: a.sex,
    ageValue: String(a.age.value),
    ageUnit: a.age.unit,
    ageEstimated: a.age.estimated,
    neutered: a.neutered,
    weight: a.weightKg === null ? "" : String(a.weightKg),
    area: a.area,
    about: a.about,
    media: a.media.map(({ id, kind, name }) => ({ id, kind, name })),
  };
}

/** Register an animal, or edit one (`?id=`). The same fields and rules as the website's form. Staff only. */
export default function AnimalFormScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const animal = useBoard((s) => (id ? s.board?.animals[id] : undefined));
  const animals = useBoard((s) => s.board?.animals);
  const canEdit = useCanEdit();
  const isCoordinator = useIsCoordinator();
  const { send } = useConnection();
  const token = useToken();
  const [form, setForm] = useState<Form>(() => (animal ? fromAnimal(animal) : EMPTY));
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (animal?.media ?? []).map((m) => ({ id: m.id, kind: m.kind, name: m.name, uri: `${API_URL}${m.url}` })),
  );
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string; said?: string } | null>(null);
  const [filling, setFilling] = useState(false);

  const areas = useMemo(() => [...new Set([...KNOWN_AREAS, ...Object.values(animals ?? {}).map((a) => a.area)])].sort(), [animals]);
  const areaQuery = form.area.trim().toLowerCase();
  const suggestions = areas.filter((a) => a.toLowerCase() !== areaQuery && (!areaQuery || a.toLowerCase().includes(areaQuery))).slice(0, 8);

  if (!canEdit) return <Empty>Only staff can register and edit animals.</Empty>;
  if (id && !animal) return <Empty>This animal isn&apos;t on the board any more.</Empty>;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  /** Fields taken from what was said. Only those are set; the rest stay as they are. */
  const fill = (d: Spoken) =>
    setForm((f) => ({
      ...f,
      ...(d.name && { name: d.name }),
      ...(d.species && { species: d.species }),
      ...(d.sex && { sex: d.sex }),
      ...(d.age && { ageValue: String(d.age.value), ageUnit: d.age.unit, ageEstimated: d.age.estimated }),
      ...(d.neutered && { neutered: d.neutered }),
      ...(d.weightKg !== null && { weight: String(d.weightKg) }),
      ...(d.area && { area: d.area }),
      ...(d.about && { about: (f.about.trim() ? `${f.about.trim()}\n${d.about}` : d.about).slice(0, ABOUT_MAX) }),
    }));

  const fillFrom = async (said: string) => {
    setNotice(null);
    setFilling(true);
    try {
      const { details } = await api<{ details: Spoken }>("/api/animals/from-speech", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: said, areas }),
      });
      fill(details);
      const got = Object.values(details).filter((v) => v !== null).length;
      setNotice(
        got === 0
          ? {
              kind: "error",
              text: "Couldn't find any details in that. Try again, saying the name, dog or cat, age and where they were found.",
              said,
            }
          : { kind: "ok", text: "Filled in from what you said. Check everything before saving.", said },
      );
    } catch (e) {
      // Without Claude on the website, keep what was said in Notes.
      if ((e as Error).message.includes("ANTHROPIC_API_KEY")) {
        set("about", (form.about.trim() ? `${form.about.trim()}\n${said}` : said).slice(0, ABOUT_MAX));
        setNotice({ kind: "ok", text: "Added what you said to Notes. Fill in the other fields." });
      } else setNotice({ kind: "error", text: (e as Error).message, said });
    } finally {
      setFilling(false);
    }
  };

  const addPhotos = async (from: "camera" | "library") => {
    const room = MEDIA_MAX - photos.length - uploading;
    if (room <= 0) return Alert.alert("That's the most photos for one animal", `Up to ${MEDIA_MAX}. Remove one to add another.`);
    const permission =
      from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        from === "camera" ? "Camera access is off" : "Photo access is off",
        "Turn it on for this app in Settings, then try again.",
      );
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: from === "library",
      selectionLimit: room,
    };
    const result = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    for (const asset of result.assets.slice(0, room)) void upload(asset);
  };

  /** Each photo uploads as soon as it's picked (as JPEG, small enough for any connection), so saving is instant. */
  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading((n) => n + 1);
    try {
      const form = new FormData();
      const name = asset.fileName?.replace(/\.(heic|heif)$/i, ".jpg") ?? `photo-${Date.now()}.jpg`;
      await appendFile(form, "file", asset.uri, name, asset.mimeType && !/hei[cf]/i.test(asset.mimeType) ? asset.mimeType : "image/jpeg");
      const saved = await api<{ id: string; kind: "photo" | "video"; name: string; url: string }>("/api/media", token, {
        method: "POST",
        body: form,
      });
      setPhotos((p) => [...p, { id: saved.id, kind: saved.kind, name: saved.name, uri: asset.uri }]);
    } catch (e) {
      Alert.alert("That photo didn't upload", (e as Error).message);
    } finally {
      setUploading((n) => n - 1);
    }
  };

  const save = () => {
    if (uploading > 0) return setNotice({ kind: "error", text: "Wait for the photos to finish uploading, then save." });
    const details = {
      name: form.name,
      species: form.species,
      sex: form.sex,
      age: {
        value: form.ageValue.trim() === "" ? NaN : Number(form.ageValue.replace(",", ".")),
        unit: form.ageUnit,
        estimated: form.ageEstimated,
      },
      neutered: form.neutered,
      weightKg: form.weight.trim() === "" ? null : Number(form.weight.replace(",", ".")),
      area: form.area,
      about: form.about,
      media: photos.map(({ id, kind, name }) => ({ id, kind, name })),
    };
    const parsed = animalDetailsSchema.safeParse(details);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
      return setNotice({ kind: "error", text: "Check the fields marked in red." });
    }
    setErrors({});
    if (animal) {
      if (send({ type: "animal.update", animalId: animal.id, details: parsed.data })) router.back();
      return;
    }
    const animalId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
    if (send({ type: "animal.create", animalId, details: parsed.data })) {
      router.back();
      useBoard.getState().setError(null);
    }
  };

  const remove = () =>
    animal &&
    Alert.alert(
      `Delete ${animal.name}?`,
      "This removes them from the board with their photos list, updates, likes and offers. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (send({ type: "animal.delete", animalId: animal.id })) router.dismissTo("/");
          },
        },
      ],
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: animal ? `Edit ${animal.name}` : "Register an animal" }} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {/* New animals only: say the details and they're filled in (ElevenLabs, then Claude, on the website). */}
        {!animal && (
          <View style={[styles.speak, { backgroundColor: t.card, borderColor: t.rule }]}>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>Rather say it?</Text>
            <Text style={{ color: t.ink2, fontSize: 14, lineHeight: 20 }}>
              Tell me their name, dog or cat, girl or boy, roughly how old, where they were found, whether they&apos;re neutered and
              anything else, and I&apos;ll fill in the form.
            </Text>
            {filling ? (
              <View style={styles.row}>
                <ActivityIndicator color={t.sea} />
                <Text style={{ color: t.ink2 }}>Filling in the form…</Text>
              </View>
            ) : (
              <SpeakButton onText={fillFrom} />
            )}
          </View>
        )}
        {notice && (
          <View style={[styles.notice, { backgroundColor: notice.kind === "ok" ? t.seaSoft : "#fdecea" }]} accessibilityLiveRegion="polite">
            <Text style={{ color: notice.kind === "ok" ? t.mint : "#8a1c12", fontWeight: "600" }}>{notice.text}</Text>
            {notice.said && (
              <Text style={{ color: notice.kind === "ok" ? t.mint : "#8a1c12", marginTop: 4 }}>You said: “{notice.said}”</Text>
            )}
          </View>
        )}

        <Field t={t} label="Name *" error={errors.name} hint="What the rescue calls them. You can change it later.">
          <TextInput value={form.name} onChangeText={(v) => set("name", v)} accessibilityLabel="Name" style={input(t, !!errors.name)} />
        </Field>

        <Field t={t} label="Species">
          <Choice
            t={t}
            value={form.species}
            onChange={(v) => set("species", v)}
            options={[
              ["dog", "Dog"],
              ["cat", "Cat"],
            ]}
          />
        </Field>
        <Field t={t} label="Sex">
          <Choice
            t={t}
            value={form.sex}
            onChange={(v) => set("sex", v)}
            options={[
              ["female", "Female"],
              ["male", "Male"],
            ]}
          />
        </Field>

        <Field t={t} label="Age *" error={errors["age.value"]}>
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            <TextInput
              value={form.ageValue}
              onChangeText={(v) => set("ageValue", v)}
              keyboardType="decimal-pad"
              accessibilityLabel="Age"
              style={[input(t, !!errors["age.value"]), { width: 90 }]}
            />
            <Choice
              t={t}
              value={form.ageUnit}
              onChange={(v) => set("ageUnit", v)}
              options={[
                ["weeks", "Weeks"],
                ["months", "Months"],
                ["years", "Years"],
              ]}
            />
          </View>
          <View style={[styles.row, { marginTop: 6 }]}>
            <Switch
              value={form.ageEstimated}
              onValueChange={(v) => set("ageEstimated", v)}
              accessibilityLabel="This is an estimate"
              trackColor={{ true: t.sea }}
              thumbColor="#ffffff"
            />
            <Text style={{ color: t.ink }}>This is an estimate</Text>
          </View>
        </Field>

        <Field t={t} label="Neutered / spayed">
          <Choice
            t={t}
            value={form.neutered}
            onChange={(v) => set("neutered", v)}
            options={[
              ["yes", "Yes"],
              ["no", "No"],
              ["unknown", "Not sure"],
            ]}
          />
        </Field>
        <Field t={t} label="Weight (kg)" error={errors.weightKg} hint="Leave blank if they haven't been weighed yet.">
          <TextInput
            value={form.weight}
            onChangeText={(v) => set("weight", v)}
            keyboardType="decimal-pad"
            accessibilityLabel="Weight in kilograms"
            style={input(t, !!errors.weightKg)}
          />
        </Field>

        <Field t={t} label="Where were they found? *" error={errors.area}>
          <TextInput
            value={form.area}
            onChangeText={(v) => set("area", v)}
            accessibilityLabel="Where they were found"
            style={input(t, !!errors.area)}
          />
          {suggestions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.row, { marginTop: 8 }]}
            >
              {suggestions.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => set("area", a)}
                  accessibilityRole="button"
                  style={[styles.suggestion, { borderColor: t.rule, backgroundColor: t.card }]}
                >
                  <Text style={{ color: t.ink2 }}>{a}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Field>

        <Field t={t} label="Notes" error={errors.about}>
          <TextInput
            value={form.about}
            onChangeText={(v) => set("about", v)}
            multiline
            accessibilityLabel="Notes"
            placeholder="Health, behaviour, who reported them…"
            placeholderTextColor={t.ink2}
            style={[input(t, !!errors.about), { minHeight: 100, textAlignVertical: "top" }]}
          />
        </Field>

        <Field t={t} label={`Photos (${photos.length} / ${MEDIA_MAX})`}>
          <View style={styles.photos}>
            {photos.map((p) => (
              <View key={p.id}>
                <Image
                  source={{ uri: p.uri, headers: p.uri.startsWith(API_URL) && token ? { Authorization: `Bearer ${token}` } : undefined }}
                  style={[styles.photo, { backgroundColor: t.rule }]}
                  accessibilityLabel={p.name}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name}`}
                  onPress={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
                  style={[styles.remove, { backgroundColor: t.card }]}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={t.ink} />
                </Pressable>
              </View>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <View key={`up-${i}`} style={[styles.photo, styles.center, { backgroundColor: t.rule }]}>
                <ActivityIndicator color={t.sea} />
              </View>
            ))}
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            {Platform.OS !== "web" && <Button label="Take a photo" onPress={() => addPhotos("camera")} />}
            <Button label="Choose photos" onPress={() => addPhotos("library")} />
          </View>
          {animal?.media.some((m) => m.kind === "video") && (
            <Text style={{ color: t.ink2, fontSize: 13, marginTop: 6 }}>Videos are kept; add new ones on the website.</Text>
          )}
        </Field>

        <Button
          label={
            uploading > 0
              ? `Uploading ${uploading}…`
              : animal
                ? "Save changes"
                : form.name.trim()
                  ? `Register ${form.name.trim()}`
                  : "Register"
          }
          variant="primary"
          onPress={save}
          disabled={uploading > 0}
        />
        {animal && isCoordinator && <Button label={`Delete ${animal.name}`} variant="quiet" onPress={remove} style={{ marginTop: 4 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const input = (t: Theme, error: boolean) => [
  styles.input,
  { backgroundColor: t.card, borderColor: error ? "#c62828" : t.rule, color: t.ink },
];

function Field({ t, label, hint, error, children }: { t: Theme; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: t.ink2, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      {children}
      {error ? (
        <Text style={{ color: "#c62828", fontSize: 13 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: t.ink2, fontSize: 12.5 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

function Choice<T extends string>({
  t,
  value,
  onChange,
  options,
}: {
  t: Theme;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <View style={[styles.choice, { borderColor: t.rule, backgroundColor: t.card }]} accessibilityRole="radiogroup">
      {options.map(([v, label]) => {
        const active = v === value;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(v)}
            style={[styles.choiceItem, active && { backgroundColor: t.sea }]}
          >
            <Text style={{ color: active ? t.onSea : t.ink, fontWeight: "600" }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 18, paddingBottom: 48 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  center: { alignItems: "center", justifyContent: "center" },
  speak: { gap: 8, padding: 14, borderWidth: 1, borderRadius: 14 },
  notice: { padding: 12, borderRadius: 12 },
  input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 10, fontSize: 16 },
  choice: { flexDirection: "row", padding: 3, borderWidth: 1, borderRadius: 10, gap: 3, alignSelf: "flex-start" },
  choiceItem: { minHeight: 40, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  suggestion: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderRadius: 99 },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: 96, height: 96, borderRadius: 10 },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
