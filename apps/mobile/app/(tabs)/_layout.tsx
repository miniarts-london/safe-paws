import { Ionicons } from "@expo/vector-icons";
import { useBoard } from "@safe-paws/shared/store";
import { router, Tabs } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { ColorModeButton, HomeTitle } from "@/components/HeaderBits";
import { useConnection } from "@/lib/connection";
import { useTheme } from "@/lib/theme";

function HeaderRight() {
  const t = useTheme();
  const { status, signOut } = useConnection();
  const me = useBoard((s) => s.users.find((u) => u.id === s.me));
  const waiting = useBoard((s) => s.members.filter((m) => m.reviewedAt === null).length);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginRight: 14 }}>
      {/* Coordinators: write a social media post. */}
      {me?.role === "coordinator" && (
        <Pressable accessibilityRole="button" accessibilityLabel="Social media post" onPress={() => router.push("/social")} hitSlop={10}>
          <Ionicons name="megaphone-outline" size={23} color={t.ink2} />
        </Pressable>
      )}
      {/* Coordinators: new sign-ups to review, with a count. */}
      {me?.role === "coordinator" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={waiting ? `Members, ${waiting} waiting for review` : "Members"}
          onPress={() => router.push("/members")}
          hitSlop={10}
        >
          <Ionicons name="people-outline" size={24} color={t.ink2} />
          {waiting > 0 && (
            <View
              style={{
                position: "absolute",
                top: -6,
                right: -8,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: t.signal,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{waiting > 9 ? "9+" : waiting}</Text>
            </View>
          )}
        </Pressable>
      )}
      <View
        accessibilityLabel={status === "open" ? "Live" : "Reconnecting"}
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status === "open" ? t.mintDot : t.signal }}
      />
      <ColorModeButton />
      {/* An icon, like the website on phones, so the rescue's name has room. */}
      <Pressable accessibilityRole="button" accessibilityLabel={me ? `Sign out ${me.name}` : "Sign out"} onPress={signOut} hitSlop={10}>
        <Ionicons name="log-out-outline" size={24} color={t.ink2} />
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
        // The rescue's name on every tab; the tab bar says where you are.
        // Tapping it goes home, like the name in the website's header.
        headerTitle: () => <HomeTitle />,
        headerTitleAlign: "left",
        headerRight: () => <HeaderRight />,
        tabBarActiveTintColor: t.sea,
        tabBarInactiveTintColor: t.ink2,
        // The web preview has no safe-area padding under the tab bar, so give its labels room.
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.rule, ...(Platform.OS === "web" ? { height: 60 } : null) },
        sceneStyle: { backgroundColor: t.ground },
      }}
    >
      {/* Home, like the website's home page; after signing in people land on Animals. */}
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="animals"
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
