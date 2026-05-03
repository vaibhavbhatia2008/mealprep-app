import { Ionicons } from "@expo/vector-icons";
import { useGetDashboard, useGetCurrentMealPlan } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_ICONS: Record<string, string> = {
  breakfast: "sunny-outline",
  lunch: "partly-sunny-outline",
  dinner: "moon-outline",
  snack: "cafe-outline",
};

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: dashboard, isLoading: dashLoading } = useGetDashboard();
  const { data: currentPlan } = useGetCurrentMealPlan({ query: { retry: false } });

  const today = new Date().getDay();
  const todaysMeals = currentPlan?.meals?.filter((m) => m.dayOfWeek === today) ?? [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: topPad + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {greeting()},
          </Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.name?.split(" ")[0] ?? "Chef"} 👋
          </Text>
        </View>
      </View>

      {dashLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.primary }]}>
              <Ionicons name="book-outline" size={22} color="#fff" />
              <Text style={styles.statNum}>{dashboard?.recipeCount ?? 0}</Text>
              <Text style={styles.statLabel}>Recipes</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={22} color={colors.primary} />
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {currentPlan ? DAYS[today] : "—"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Today</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
              <Ionicons name="cart-outline" size={22} color={colors.secondary} />
              <Text style={[styles.statNum, { color: colors.foreground }]}>
                {dashboard?.currentGroceryList ? "1" : "0"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Lists</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today's Meals</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/planner")} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See plan</Text>
              </TouchableOpacity>
            </View>

            {todaysMeals.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="restaurant-outline" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No meals planned for today
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { borderColor: colors.primary }]}
                  onPress={() => router.push("/(tabs)/planner")}
                >
                  <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Plan meals</Text>
                </TouchableOpacity>
              </View>
            ) : (
              todaysMeals.map((meal) => (
                <View key={meal.id} style={[styles.mealRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.mealIconBox, { backgroundColor: colors.accent }]}>
                    <Ionicons name={MEAL_ICONS[meal.mealType] as any} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mealType, { color: colors.mutedForeground }]}>
                      {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
                    </Text>
                    <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={1}>
                      {meal.recipe?.name ?? meal.customName ?? "Custom meal"}
                    </Text>
                  </View>
                  {meal.recipe && (
                    <TouchableOpacity onPress={() => router.push(`/recipes/${meal.recipe!.id}`)}>
                      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>

          {dashboard?.currentGroceryList && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Grocery List</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/grocery")}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>View all</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.groceryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/grocery")}
                activeOpacity={0.75}
              >
                <Ionicons name="cart-outline" size={20} color={colors.primary} />
                <Text style={[styles.groceryName, { color: colors.foreground }]} numberOfLines={1}>
                  {dashboard.currentGroceryList.name}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  userName: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  loadingRow: {
    paddingVertical: 40,
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  mealIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mealType: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mealName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
  },
  groceryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  groceryName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
