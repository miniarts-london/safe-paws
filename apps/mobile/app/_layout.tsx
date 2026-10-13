import { useBoard } from "@safe-paws/shared/store";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Banners } from "@/components/Banner";
import { ColorModeButton, HomeTitle } from "@/components/HeaderBits";
import { AuthProvider, useAuth } from "@/lib/auth";
import { restoreColorMode } from "@/lib/colorMode";
import { ConnectionProvider } from "@/lib/connection";
import { useTheme } from "@/lib/theme";

/** Tapping a push notification opens the animal it's about, including when it launched the app. */
function useOpenFromNotification(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const data = r?.notification.request.content.data;
      const id = data?.animalId;
      // A new update opens the animal's Updates; anything else its Details.
      if (typeof id === "string") router.push({ pathname: "/animal/[id]", params: { id, view: data?.kind === "note" ? "updates" : "details" } });
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled]);
}

/**
 * Like the website: signing in lands on Animals, and visitors (opening the app
 * signed out, or after signing out) start on Home. Opening the app when
 * already signed in starts at Home too.
 */
function useLandingAfterAuthChange(status: string) {
  const previous = useRef(status);
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    // After the guarded screens have given way to the allowed ones.
    if (was === "signedOut" && status === "signedIn") setTimeout(() => router.navigate("/animals"), 0);
    if (was !== "signedOut" && status === "signedOut") setTimeout(() => router.replace("/welcome"), 0);
  }, [status]);
}

function WelcomeActions() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginRight: 14 }}>
      <ColorModeButton />
      <Pressable accessibilityRole="button" onPress={() => router.push("/login")} hitSlop={10}>
        <Text style={{ color: t.sea, fontWeight: "700", fontSize: 16 }}>Sign in</Text>
      </Pressable>
    </View>
  );
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
  useLandingAfterAuthChange(state.status);

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
          <Stack.Screen name="social" options={{ title: "Social media post", headerBackTitle: "Back" }} />
          <Stack.Screen name="members" options={{ title: "Members", headerBackTitle: "Back" }} />
          <Stack.Screen name="animal-form" options={{ title: "Register an animal", presentation: "modal", headerBackTitle: "Cancel" }} />
        </Stack.Protected>
        {/* Signed out: Home first, like the website, with Sign in in the top bar. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen
            name="welcome"
            options={{
              headerTitle: () => <HomeTitle />,
              headerTitleAlign: "left",
              headerRight: () => <WelcomeActions />,
            }}
          />
          <Stack.Screen name="login" options={{ title: "Sign in", headerBackTitle: "Home" }} />
          <Stack.Screen name="join" options={{ title: "Create an account", headerBackTitle: "Back" }} />
        </Stack.Protected>
        {/* Anyone can see how to donate. */}
        <Stack.Screen name="donate" options={{ title: "Donate", headerBackTitle: "Back" }} />
      </Stack>
      {signedIn && <Banners />}
      <ErrorBar />
    </ConnectionProvider>
  );
}

// The light/dark choice made on this phone, if any (otherwise it follows the phone).
void restoreColorMode();

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
