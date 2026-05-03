import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const {
    prepReminderEnabled,
    mondayCheckinEnabled,
    permissionStatus,
    setPrepReminder,
    setMondayCheckin,
  } = useNotifications();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await logout();
        },
      },
    ]);
  };

  const handleTogglePrepReminder = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setPrepReminder(value);
    if (value && permissionStatus === "denied") {
      Alert.alert(
        "Notifications blocked",
        "Please enable notifications for PrepSmart in your device settings to receive reminders.",
        [{ text: "OK" }]
      );
    }
  };

  const handleToggleMondayCheckin = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setMondayCheckin(value);
    if (value && permissionStatus === "denied") {
      Alert.alert(
        "Notifications blocked",
        "Please enable notifications for PrepSmart in your device settings to receive reminders.",
        [{ text: "OK" }]
      );
    }
  };

  const initials =
    user?.name
      ?.split(" ")
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") ?? "?";

  const notificationsUnavailable =
    Platform.OS === "web" || permissionStatus === "unavailable";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 24, paddingBottom: Platform.OS === "web" ? 100 : 120 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar */}
      <View style={styles.avatarRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
      </View>

      {/* Account info */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row icon="person-outline" label="Full Name" value={user?.name} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row icon="mail-outline" label="Email" value={user?.email} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row
          icon="calendar-outline"
          label="Member since"
          value={
            user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
              : "—"
          }
          colors={colors}
        />
      </View>

      {/* Notifications */}
      <View>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>NOTIFICATIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {notificationsUnavailable ? (
            <View style={styles.row}>
              <Ionicons name="notifications-off-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>
                Push notifications are not available on web
              </Text>
            </View>
          ) : (
            <>
              <NotifRow
                icon="sunny-outline"
                label="Sunday Prep Reminder"
                description="Every Sunday at 6 PM — plan your week"
                value={prepReminderEnabled}
                onValueChange={handleTogglePrepReminder}
                colors={colors}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <NotifRow
                icon="flag-outline"
                label="Monday Check-in"
                description="Every Monday at 8 AM — new week nudge"
                value={mondayCheckinEnabled}
                onValueChange={handleToggleMondayCheckin}
                colors={colors}
              />
              {permissionStatus === "denied" && (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={[styles.deniedBanner, { backgroundColor: colors.destructive + "12" }]}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                    <Text style={[styles.deniedText, { color: colors.destructive }]}>
                      Notifications are blocked. Enable them in device Settings → PrepSmart.
                    </Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: colors.destructive }]}
        onPress={handleLogout}
        activeOpacity={0.75}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value?: string | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={18} color={colors.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.foreground }]}>{value ?? "—"}</Text>
      </View>
    </View>
  );
}

function NotifRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  colors,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.notifRow}>
      <View style={[styles.notifIconBox, { backgroundColor: colors.accent }]}>
        <Ionicons name={icon as any} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.notifLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.notifDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.muted, true: colors.primary + "80" }}
        thumbColor={value ? colors.primary : colors.mutedForeground}
        ios_backgroundColor={colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 20 },
  avatarRow: { alignItems: "center", gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
  name: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  email: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  rowLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  rowValue: { fontSize: 15, fontFamily: "Inter_500Medium", marginTop: 2 },
  divider: { height: 1, marginLeft: 48 },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  notifIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  notifLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notifDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  deniedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    margin: 12,
    borderRadius: 10,
  },
  deniedText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  unavailableText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  spacer: { height: 4 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
