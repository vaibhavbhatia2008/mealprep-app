import { Ionicons } from "@expo/vector-icons";
import {
  getListRecipesQueryKey,
  useCloneRecipe,
  useDeleteRecipe,
  useGetRecipe,
  useToggleRecipeFavorite,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

const SCALES = [0.5, 1, 2, 3, 4] as const;
const SCALE_LABELS: Record<number, string> = { 0.5: "½×", 1: "1×", 2: "2×", 3: "3×", 4: "4×" };

function scaleIngredient(ing: string, multiplier: number): string {
  if (multiplier === 1) return ing;
  return ing.replace(/(\d+(\.\d+)?)/g, (match) => {
    const n = parseFloat(match) * multiplier;
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
  });
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [scale, setScale] = useState<number>(1);

  const { data: recipe, isLoading } = useGetRecipe({ id: Number(id) });
  const favMutation = useToggleRecipeFavorite();
  const deleteMutation = useDeleteRecipe();
  const cloneMutation = useCloneRecipe();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Recipe not found</Text>
      </View>
    );
  }

  const handleFav = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    favMutation.mutate({ id: recipe.id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListRecipesQueryKey() }),
    });
  };

  const handleDelete = () => {
    Alert.alert("Delete Recipe", `Delete "${recipe.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate({ id: recipe.id }, {
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            },
          });
        },
      },
    ]);
  };

  const handleClone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cloneMutation.mutate({ id: recipe.id }, {
      onSuccess: (cloned) => {
        qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/recipes/${cloned.id}`);
      },
    });
  };

  const scaledPrepTime = scale !== 1 && recipe.prepTime ? Math.round(recipe.prepTime * scale) : recipe.prepTime;
  const scaledCalories = scale !== 1 && recipe.calories ? Math.round(recipe.calories * scale) : recipe.calories;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={handleFav} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons
              name={recipe.isFavorite ? "star" : "star-outline"}
              size={22}
              color={recipe.isFavorite ? "#f59e0b" : colors.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/recipes/${recipe.id}/edit`)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="create-outline" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClone} disabled={cloneMutation.isPending} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            {cloneMutation.isPending ? <ActivityIndicator size="small" color={colors.foreground} /> : (
              <Ionicons name="copy-outline" size={22} color={colors.foreground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="trash-outline" size={22} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === "web" ? 60 : 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.recipeName, { color: colors.foreground }]}>{recipe.name}</Text>

        <View style={styles.metaRow}>
          {scaledPrepTime != null && (
            <View style={[styles.metaChip, { backgroundColor: colors.accent }]}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={[styles.metaChipText, { color: colors.accentForeground }]}>{scaledPrepTime} min</Text>
            </View>
          )}
          {scaledCalories != null && (
            <View style={[styles.metaChip, { backgroundColor: colors.accent }]}>
              <Ionicons name="flame-outline" size={14} color={colors.primary} />
              <Text style={[styles.metaChipText, { color: colors.accentForeground }]}>{scaledCalories} cal</Text>
            </View>
          )}
        </View>

        <View style={styles.scaleRow}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Servings</Text>
          <View style={styles.scaleButtons}>
            {SCALES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.scaleBtn, { backgroundColor: scale === s ? colors.primary : colors.muted }]}
                onPress={() => { setScale(s); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.scaleBtnText, { color: scale === s ? "#fff" : colors.mutedForeground }]}>
                  {SCALE_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ingredients</Text>
          {recipe.ingredients.map((ing, i) => (
            <View key={i} style={[styles.ingredientRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.ingredientText, { color: colors.foreground }]}>
                {scaleIngredient(ing, scale)}
              </Text>
            </View>
          ))}
        </View>

        {recipe.instructions && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Instructions</Text>
            <Text style={[styles.instructions, { color: colors.foreground }]}>{recipe.instructions}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topActions: { flexDirection: "row", gap: 16, alignItems: "center" },
  content: { paddingHorizontal: 20, gap: 24, paddingTop: 8 },
  recipeName: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", lineHeight: 32 },
  metaRow: { flexDirection: "row", gap: 10 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  metaChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scaleRow: { gap: 10 },
  scaleButtons: { flexDirection: "row", gap: 8 },
  scaleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  scaleBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  ingredientText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  instructions: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
});
