import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

const PREF_PREP = "notif_prep_reminder";
const PREF_MONDAY = "notif_monday_checkin";
const ID_PREP = "weekly-prep-sunday";
const ID_MONDAY = "weekly-monday-checkin";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationsContextValue {
  prepReminderEnabled: boolean;
  mondayCheckinEnabled: boolean;
  permissionStatus: "granted" | "denied" | "undetermined" | "unavailable";
  setPrepReminder: (enabled: boolean) => Promise<void>;
  setMondayCheckin: (enabled: boolean) => Promise<void>;
  fireNow: (title: string, body: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

async function getPermissionStatus(): Promise<"granted" | "denied" | "undetermined" | "unavailable"> {
  if (Platform.OS === "web") return "unavailable";
  const { status } = await Notifications.getPermissionsAsync();
  return status as "granted" | "denied" | "undetermined";
}

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function scheduleSundayReminder() {
  await Notifications.cancelScheduledNotificationAsync(ID_PREP).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: ID_PREP,
    content: {
      title: "Time to plan your meals!",
      body: "Set up your meal plan for the week and generate a grocery list.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 18,
      minute: 0,
    },
  });
}

async function scheduleMondayReminder() {
  await Notifications.cancelScheduledNotificationAsync(ID_MONDAY).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: ID_MONDAY,
    content: {
      title: "New week, new meals!",
      body: "Have you set up your meal plan yet? Tap to get started.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour: 8,
      minute: 0,
    },
  });
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [prepReminderEnabled, setPrepReminderEnabled] = useState(false);
  const [mondayCheckinEnabled, setMondayCheckinEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "undetermined" | "unavailable"
  >("undetermined");

  useEffect(() => {
    async function init() {
      const status = await getPermissionStatus();
      setPermissionStatus(status);

      const [prepPref, mondayPref] = await Promise.all([
        AsyncStorage.getItem(PREF_PREP),
        AsyncStorage.getItem(PREF_MONDAY),
      ]);

      if (prepPref === "true" && status === "granted") {
        setPrepReminderEnabled(true);
        await scheduleSundayReminder().catch(() => {});
      }
      if (mondayPref === "true" && status === "granted") {
        setMondayCheckinEnabled(true);
        await scheduleMondayReminder().catch(() => {});
      }
    }
    init();
  }, []);

  const setPrepReminder = async (enabled: boolean) => {
    if (enabled) {
      const granted =
        permissionStatus === "granted" ? true : await requestPermission();
      if (!granted) {
        setPermissionStatus("denied");
        return;
      }
      setPermissionStatus("granted");
      await scheduleSundayReminder();
    } else {
      await Notifications.cancelScheduledNotificationAsync(ID_PREP).catch(() => {});
    }
    setPrepReminderEnabled(enabled);
    await AsyncStorage.setItem(PREF_PREP, String(enabled));
  };

  const setMondayCheckin = async (enabled: boolean) => {
    if (enabled) {
      const granted =
        permissionStatus === "granted" ? true : await requestPermission();
      if (!granted) {
        setPermissionStatus("denied");
        return;
      }
      setPermissionStatus("granted");
      await scheduleMondayReminder();
    } else {
      await Notifications.cancelScheduledNotificationAsync(ID_MONDAY).catch(() => {});
    }
    setMondayCheckinEnabled(enabled);
    await AsyncStorage.setItem(PREF_MONDAY, String(enabled));
  };

  const fireNow = async (title: string, body: string) => {
    if (Platform.OS === "web") return;
    if (permissionStatus !== "granted") return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  };

  return (
    <NotificationsContext.Provider
      value={{
        prepReminderEnabled,
        mondayCheckinEnabled,
        permissionStatus,
        setPrepReminder,
        setMondayCheckin,
        fireNow,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
