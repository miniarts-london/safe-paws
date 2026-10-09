import { useBoard } from "@safe-paws/shared/store";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Banners } from "@/components/Banner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ConnectionProvider } from "@/lib/connection";
import { useTheme } from "@/lib/theme";

/** Tapping a push notification opens the animal it's about, including when it launched the app. */
function useOpenFromNotification(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const id = r?.notification.request.content.data?.animalId;
      if (typeof id === "string") router.push({ pathname: "/animal/[id]", params: { id } });
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled]);
}

function ErrorBar() {
  const t = useTheme();
  const error = useBoard((s) => s.error);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => useBoard.getState().setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);
  if (!error) return null;
  return (
    <View style={{ position: "absolute", bottom: 100, left: 16, right: 16, padding: 12, borderRadius: 10, backgroundColor: t.signal }}>
      <Text accessibilityRole="alert" style={{ color: "#fff", fontSize: 14 }}>
        {error}
      </Text>
    </View>
  );
}

function RootStack() {
  const t = useTheme();
  const { state } = useAuth();
  const signedIn = state.status === "signedIn";
  useOpenFromNotification(signedIn);

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.ground }}>
        <ActivityIndicator color={t.sea} />
      </View>
    );
  }

  return (
    <ConnectionProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.card },
          headerTintColor: t.sea,
          headerTitleStyle: { color: t.ink },
          contentStyle: { backgroundColor: t.ground },
        }}
      >
        {/* Screens behind sign-in; expo-router redirects to whichever group is allowed. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="animal/[id]" options={{ title: "", headerBackTitle: "Back" }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {signedIn && <Banners />}
      <ErrorBar />
    </ConnectionProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
