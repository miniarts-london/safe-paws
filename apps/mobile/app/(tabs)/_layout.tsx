import { Ionicons } from "@expo/vector-icons";
import { useBoard } from "@safe-paws/shared/store";
import { Tabs } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { useConnection } from "@/lib/connection";
import { useTheme } from "@/lib/theme";

function HeaderRight() {
  const t = useTheme();
  const { status, signOut } = useConnection();
  const me = useBoard((s) => s.users.find((u) => u.id === s.me));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginRight: 14 }}>
      <View
        accessibilityLabel={status === "open" ? "Live" : "Reconnecting"}
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status === "open" ? t.sea : t.signal }}
      />
      {me && <Text style={{ color: t.ink2, fontSize: 14 }}>{me.name}</Text>}
      <Pressable accessibilityRole="button" onPress={signOut} hitSlop={10}>
        <Text style={{ color: t.sea, fontSize: 15, fontWeight: "600" }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const unread = useBoard((s) => s.notifications.filter((n) => !n.read).length);
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTitleStyle: { color: t.ink },
        headerRight: () => <HeaderRight />,
        tabBarActiveTintColor: t.sea,
        tabBarInactiveTintColor: t.ink2,
        // The web preview has no safe-area padding under the tab bar, so give its labels room.
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.rule, ...(Platform.OS === "web" ? { height: 60 } : null) },
        sceneStyle: { backgroundColor: t.ground },
      }}
    >
      {/* Animals first: everyone lands here after signing in, like on the website. */}
      <Tabs.Screen
        name="index"
        options={{ title: "Animals", tabBarIcon: ({ color, size }) => <Ionicons name="paw-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="board"
        options={{ title: "Board", tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="following"
        options={{ title: "Following", tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarBadge: unread > 0 ? (unread > 9 ? "9+" : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: t.signal, color: "#fff" },
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
