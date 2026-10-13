import { Ionicons } from "@expo/vector-icons";
import { BANK, PAYPAL_EMAIL, PAYPAL_ME_URL, PAYPAL_URL } from "@safe-paws/shared/donation";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { useTheme, type Theme } from "@/lib/theme";

/** How to donate, the same details as the website's Donate page (they live in @safe-paws/shared/donation). */
export default function DonateScreen() {
  const t = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={[styles.lead, { color: t.ink2 }]}>
        Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet visits and many
        other essentials.
      </Text>
      <Text style={[styles.lead, { color: t.ink2 }]}>Your contribution is greatly appreciated and makes a huge difference to our animals’ lives.</Text>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
        <View style={styles.head}>
          <View style={[styles.badge, { backgroundColor: t.seaSoft }]}>
            <Ionicons name="business-outline" size={22} color={t.mint} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: t.ink }]}>Bank transfer</Text>
            <Text style={{ color: t.ink2 }}>{BANK.bank}</Text>
          </View>
        </View>
        {BANK.rows.map((r, i) => (
          <Detail key={r.label} t={t} label={r.label} value={r.value} first={i === 0} />
        ))}
      </View>

      <Text style={{ color: t.ink2, textAlign: "center", fontWeight: "600" }}>or</Text>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.rule }]}>
        <View style={styles.head}>
          <View style={[styles.badge, { backgroundColor: t.seaSoft }]}>
            <Text style={{ color: t.mint, fontWeight: "800", fontSize: 18 }}>P</Text>
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: t.ink }]}>PayPal</Text>
            <Text style={{ color: t.ink2 }}>Friends and family option</Text>
          </View>
        </View>
        <Detail t={t} label="Send to" value={PAYPAL_EMAIL} first />
        <Text style={{ color: t.ink2, lineHeight: 20 }}>
          Please choose <Text style={{ fontWeight: "700" }}>Friends and family</Text> when you send, so the whole amount reaches the dogs.
          {!PAYPAL_ME_URL && " On PayPal, paste the email above as who to send to."}
        </Text>
        <Button label="Pay with PayPal" variant="primary" onPress={() => Linking.openURL(PAYPAL_URL)} />
      </View>
      <Text style={{ color: t.ink2, textAlign: "center" }}>Thank you.</Text>
    </ScrollView>
  );
}

/** One label and value, with a button to copy the value. */
function Detail({ t, label, value, first }: { t: Theme; label: string; value: string; first?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={[styles.detail, !first && { borderTopWidth: 1, borderTopColor: t.rule }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink2, fontSize: 12.5 }}>{label}</Text>
        <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] }} selectable>
          {value}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        onPress={copy}
        hitSlop={8}
        style={styles.copy}
      >
        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={copied ? t.mint : t.ink2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, paddingBottom: 40 },
  lead: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  card: { padding: 16, borderWidth: 1, borderRadius: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  detail: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  copy: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
