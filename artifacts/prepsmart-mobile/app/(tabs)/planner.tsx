import { Ionicons } from "@expo/vector-icons";
import {
  useAddMeal,
  useCreateMealPlan,
  useDeleteMeal,
  useGenerateMealPlan,
  useGetCurrentMealPlan,
  useListRecipes,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_ICONS: Record<string, string> = {
  breakfast: "sunny-outline",
  lunch: "partly-sunny-outline",
  dinner: "moon-outline",
  snack: "cafe-outline",
};

function getMondayOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(today.getDay());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<typeof MEAL_TYPES[number]>("lunch");
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [preferences, setPreferences] = useState("");

  const { data: currentPlan, isLoading } = useGetCurrentMealPlan({ query: { retry: false } });
  const { data: recipes } = useListRecipes({});
  const createPlanMutation = useCreateMealPlan();
  const addMealMutation = useAddMeal();
  const deleteMealMutation = useDeleteMeal();
  const generateMutation = useGenerateMealPlan();

  const todayMeals = currentPlan?.meals?.filter((m) => m.dayOfWeek === selectedDay) ?? [];

  const handleCreatePlan = () => {
    const monday = getMondayOfWeek(today);
    createPlanMutation.mutate(
      { data: { weekStart: monday.toISOString().split("T")[0] } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["getCurrentMealPlan"] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      }
    );
  };

  const handleAddMeal = () => {
    if (!currentPlan) return;
    addMealMutation.mutate(
      {
        id: currentPlan.id,
        data: { dayOfWeek: selectedDay, mealType: selectedMealType, recipeId: selectedRecipeId },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["getCurrentMealPlan"] });
          setShowAddModal(false);
          setSelectedRecipeId(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      }
    );
  };

  const handleDeleteMeal = (mealId: number) => {
    if (!currentPlan) return;
    Alert.alert("Remove meal?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          deleteMealMutation.mutate(
            { id: currentPlan.id, mealId },
            { onSuccess: () => qc.invalidateQueries({ queryKey: ["getCurrentMealPlan"] }) }
          );
        },
      },
    ]);
  };

  const handleGenerate = () => {
    if (!currentPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    generateMutation.mutate(
      { id: currentPlan.id, data: preferences.trim() ? { preferences: preferences.trim() } : {} },
      {
        onSuccess: (updatedPlan) => {
          qc.setQueryData(["getCurrentMealPlan"], updatedPlan);
          qc.invalidateQueries({ queryKey: ["getCurrentMealPlan"] });
          setShowAiModal(false);
          setPreferences("");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err: any) => {
          const msg = err?.data?.error ?? err?.message ?? "Generation failed. Please try again.";
          Alert.alert("Generation failed", msg);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  };

  const weekMealCount = currentPlan?.meals?.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Meal Planner</Text>
          {currentPlan && (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {weekMealCount} meal{weekMealCount !== 1 ? "s" : ""} this week
            </Text>
          )}
        </View>
        {currentPlan && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAiModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={15} color="#fff" />
              <Text style={styles.aiBtnText}>AI Fill</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Day strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayScroll}
        contentContainerStyle={styles.dayRow}
      >
        {DAYS_SHORT.map((d, i) => {
          const isToday = i === today.getDay();
          const isSelected = i === selectedDay;
          const dayMealCount = currentPlan?.meals?.filter((m) => m.dayOfWeek === i).length ?? 0;
          return (
            <TouchableOpacity
              key={d}
              style={[
                styles.dayBtn,
                isSelected && { backgroundColor: colors.primary },
                !isSelected && { backgroundColor: colors.muted },
              ]}
              onPress={() => setSelectedDay(i)}
            >
              <Text style={[styles.dayShort, { color: isSelected ? "#fff" : colors.mutedForeground }]}>{d}</Text>
              {isToday && <View style={[styles.todayDot, { backgroundColor: isSelected ? "#fff" : colors.primary }]} />}
              {dayMealCount > 0 && !isToday && (
                <View style={[styles.mealDot, { backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : colors.primary + "60" }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.dayLabel}>
        <Text style={[styles.dayLabelText, { color: colors.foreground }]}>{DAYS_FULL[selectedDay]}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !currentPlan ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No meal plan yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Create a plan for this week
          </Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={handleCreatePlan}
            disabled={createPlanMutation.isPending}
          >
            {createPlanMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Create This Week</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.mealsContainer,
            { paddingBottom: Platform.OS === "web" ? 100 : 120 },
          ]}
        >
          {MEAL_TYPES.map((type) => {
            const meals = todayMeals.filter((m) => m.mealType === type);
            return (
              <View key={type} style={styles.mealSection}>
                <View style={styles.mealTypeRow}>
                  <Ionicons name={MEAL_ICONS[type] as any} size={16} color={colors.mutedForeground} />
                  <Text style={[styles.mealTypeLabel, { color: colors.mutedForeground }]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </View>
                {meals.length === 0 ? (
                  <TouchableOpacity
                    style={[styles.emptyMealSlot, { borderColor: colors.border }]}
                    onPress={() => {
                      setSelectedMealType(type);
                      setShowAddModal(true);
                    }}
                  >
                    <Ionicons name="add" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.emptySlotText, { color: colors.mutedForeground }]}>Add meal</Text>
                  </TouchableOpacity>
                ) : (
                  meals.map((meal) => (
                    <View
                      key={meal.id}
                      style={[
                        styles.mealItem,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <View style={[styles.mealIconBox, { backgroundColor: colors.accent }]}>
                        <Ionicons name={MEAL_ICONS[type] as any} size={16} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={1}>
                          {meal.recipe?.name ?? meal.customName ?? "Custom meal"}
                        </Text>
                        {meal.recipe?.prepTime && (
                          <Text style={[styles.mealMeta, { color: colors.mutedForeground }]}>
                            {meal.recipe.prepTime} min
                            {meal.recipe.calories ? ` · ${meal.recipe.calories} cal` : ""}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteMeal(meal.id)}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Manual add modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add Meal</Text>

          <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Meal type</Text>
          <View style={styles.typeRow}>
            {MEAL_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeChip,
                  { backgroundColor: selectedMealType === t ? colors.primary : colors.muted },
                ]}
                onPress={() => setSelectedMealType(t)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    { color: selectedMealType === t ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Choose recipe</Text>
          <FlatList
            data={recipes ?? []}
            keyExtractor={(item) => String(item.id)}
            style={{ maxHeight: 220 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.recipeRow,
                  { borderBottomColor: colors.border },
                  selectedRecipeId === item.id && { backgroundColor: colors.accent },
                ]}
                onPress={() => setSelectedRecipeId(item.id)}
              >
                <Text
                  style={[styles.recipeRowName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {selectedRecipeId === item.id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary },
              !selectedRecipeId && styles.saveBtnDisabled,
            ]}
            onPress={handleAddMeal}
            disabled={!selectedRecipeId || addMealMutation.isPending}
          >
            {addMealMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                Add to Plan
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* AI Generate modal */}
      <Modal visible={showAiModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => !generateMutation.isPending && setShowAiModal(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <LinearGradient
            colors={[colors.primary + "18", colors.accent]}
            style={styles.aiHeader}
          >
            <View style={[styles.aiIconCircle, { backgroundColor: colors.primary }]}>
              <Ionicons name="sparkles" size={22} color="#fff" />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.foreground, marginTop: 0 }]}>
              AI Meal Planner
            </Text>
            <Text style={[styles.aiSubtitle, { color: colors.mutedForeground }]}>
              Fill your entire week with balanced meals from your recipe library
            </Text>
          </LinearGradient>

          <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>
            Preferences (optional)
          </Text>
          <TextInput
            style={[
              styles.prefInput,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
            placeholder='e.g. "high protein", "light dinners", "no repeats"'
            placeholderTextColor={colors.mutedForeground}
            value={preferences}
            onChangeText={setPreferences}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            editable={!generateMutation.isPending}
          />

          <View style={[styles.warningRow, { backgroundColor: colors.muted }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.warningText, { color: colors.mutedForeground }]}>
              This will replace all existing meals for this week
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.generateBtn,
              { backgroundColor: colors.primary },
              generateMutation.isPending && styles.saveBtnDisabled,
            ]}
            onPress={handleGenerate}
            disabled={generateMutation.isPending}
            activeOpacity={0.85}
          >
            {generateMutation.isPending ? (
              <View style={styles.generatingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={[styles.saveBtnText, { color: "#fff" }]}>Generating your plan…</Text>
              </View>
            ) : (
              <View style={styles.generatingRow}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={[styles.saveBtnText, { color: "#fff" }]}>Generate Full Week</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  aiBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  addBtn: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dayScroll: { flexGrow: 0 },
  dayRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  dayBtn: {
    width: 48,
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayShort: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  todayDot: { width: 5, height: 5, borderRadius: 3 },
  mealDot: { width: 4, height: 4, borderRadius: 2 },
  dayLabel: { paddingHorizontal: 20, paddingVertical: 12 },
  dayLabelText: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  createBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  createBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mealsContainer: { paddingHorizontal: 20, gap: 20, paddingTop: 4 },
  mealSection: { gap: 8 },
  mealTypeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mealTypeLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyMealSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  emptySlotText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  mealItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  mealIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mealName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mealMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  sheetLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  typeChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  recipeRowName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  saveBtn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  // AI modal specific
  aiHeader: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  aiIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  aiSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  prefInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
    minHeight: 70,
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  warningText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  generateBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  generatingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
