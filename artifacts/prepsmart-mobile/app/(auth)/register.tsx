import { useRegister } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const registerMutation = useRegister();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    registerMutation.mutate(
      { data: { name: name.trim(), email: email.trim(), password } },
      {
        onSuccess: async (data) => {
          await login(data.token, data.user);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Registration failed";
          setError(msg);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={[colors.background, colors.accent]}
        style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Start your meal prep journey
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18" }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Full name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Jane Doe"
              placeholderTextColor={colors.mutedForeground}
              autoComplete="name"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={handleRegister}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }, registerMutation.isPending && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={registerMutation.isPending}
            activeOpacity={0.8}
          >
            {registerMutation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Already have an account?{" "}
            </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={[styles.link, { color: colors.primary }]}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 24,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  link: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
