import { Ionicons } from "@expo/vector-icons";
import {
  useAddMeal,
  useCreateMealPlan,
  useDeleteMeal,
  useGetCurrentMealPlan,
  useListRecipes,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  const [selectedMealType, setSelectedMealType] = useState<typeof MEAL_TYPES[number]>("lunch");
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);

  const { data: currentPlan, isLoading } = useGetCurrentMealPlan({ query: { retry: false } });
  const { data: recipes } = useListRecipes({});
  const createPlanMutation = useCreateMealPlan();
  const addMealMutation = useAddMeal();
  const deleteMealMutation = useDeleteMeal();

  const todayMeals = currentPlan?.meals?.filter((m) => m.dayOfWeek === selectedDay) ?? [];

  const handleCreatePlan = () => {
    const monday = getMondayOfWeek(today);
    createPlanMutation.mutate(
      { weekStart: monday.toISOString().split("T")[0] },
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Meal Planner</Text>
        {currentPlan && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayRow}>
        {DAYS_SHORT.map((d, i) => {
          const isToday = i === today.getDay();
          const isSelected = i === selectedDay;
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
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.dayLabel]}>
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
        <ScrollView contentContainerStyle={[styles.mealsContainer, { paddingBottom: Platform.OS === "web" ? 100 : 120 }]}>
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
                    onPress={() => { setSelectedMealType(type); setShowAddModal(true); }}
                  >
                    <Ionicons name="add" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.emptySlotText, { color: colors.mutedForeground }]}>Add meal</Text>
                  </TouchableOpacity>
                ) : (
                  meals.map((meal) => (
                    <View key={meal.id} style={[styles.mealItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={1}>
                          {meal.recipe?.name ?? meal.customName ?? "Custom meal"}
                        </Text>
                        {meal.recipe?.prepTime && (
                          <Text style={[styles.mealMeta, { color: colors.mutedForeground }]}>
                            {meal.recipe.prepTime} min
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteMeal(meal.id)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
                style={[styles.typeChip, { backgroundColor: selectedMealType === t ? colors.primary : colors.muted }]}
                onPress={() => setSelectedMealType(t)}
              >
                <Text style={[styles.typeChipText, { color: selectedMealType === t ? "#fff" : colors.mutedForeground }]}>
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
                style={[styles.recipeRow, { borderBottomColor: colors.border }, selectedRecipeId === item.id && { backgroundColor: colors.accent }]}
                onPress={() => setSelectedRecipeId(item.id)}
              >
                <Text style={[styles.recipeRowName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                {selectedRecipeId === item.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }, !selectedRecipeId && styles.saveBtnDisabled]}
            onPress={handleAddMeal}
            disabled={!selectedRecipeId || addMealMutation.isPending}
          >
            {addMealMutation.isPending ? <ActivityIndicator color="#fff" /> : (
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Add to Plan</Text>
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
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dayScroll: { flexGrow: 0 },
  dayRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  dayBtn: { width: 48, height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 4 },
  dayShort: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  todayDot: { width: 5, height: 5, borderRadius: 3 },
  dayLabel: { paddingHorizontal: 20, paddingVertical: 12 },
  dayLabelText: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  createBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  createBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mealsContainer: { paddingHorizontal: 20, gap: 20, paddingTop: 4 },
  mealSection: { gap: 8 },
  mealTypeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mealTypeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  emptyMealSlot: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, paddingHorizontal: 14 },
  emptySlotText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  mealItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  mealName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mealMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  sheetLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  typeChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  recipeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, paddingHorizontal: 4 },
  recipeRowName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  saveBtn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
