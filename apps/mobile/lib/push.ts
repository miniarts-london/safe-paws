import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// If a push does arrive while the app is open, show it as a normal banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Asks permission and returns this device's Expo push token, or null when
 * push isn't available: the web preview, a simulator, permission declined,
 * or a build without an EAS project id (remote push needs a development
 * build; Expo Go doesn't support it on Android).
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Animal updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.info("[safe-paws] No EAS project id, so push is off. Run `npx eas init` to enable it.");
    return null;
  }
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (err) {
    console.info("[safe-paws] Push token unavailable:", (err as Error).message);
    return null;
  }
}
