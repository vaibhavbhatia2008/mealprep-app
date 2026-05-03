import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Recipe {
  id: number;
  name: string;
  ingredients: string[];
  prepTime: number | null;
  calories: number | null;
  isFavorite: boolean;
}

interface RecipeCardProps {
  recipe: Recipe;
  onFavorite?: (id: number) => void;
}

export function RecipeCard({ recipe, onFavorite }: RecipeCardProps) {
  const colors = useColors();
  const router = useRouter();

  const handlePress = () => {
    Haptics.selectionAsync();
    router.push(`/recipes/${recipe.id}`);
  };

  const handleFav = (e: any) => {
    e.stopPropagation?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFavorite?.(recipe.id);
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
          {recipe.name}
        </Text>
        <TouchableOpacity onPress={handleFav} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons
            name={recipe.isFavorite ? "star" : "star-outline"}
            size={20}
            color={recipe.isFavorite ? "#f59e0b" : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.meta}>
        {recipe.prepTime != null && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {recipe.prepTime} min
            </Text>
          </View>
        )}
        {recipe.calories != null && (
          <View style={styles.metaItem}>
            <Ionicons name="flame-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {recipe.calories} cal
            </Text>
          </View>
        )}
      </View>

      {recipe.ingredients.length > 0 && (
        <View style={styles.tags}>
          {recipe.ingredients.slice(0, 3).map((ing, i) => (
            <View key={i} style={[styles.tag, { backgroundColor: colors.accent }]}>
              <Text style={[styles.tagText, { color: colors.accentForeground }]} numberOfLines={1}>
                {ing.length > 18 ? ing.slice(0, 18) + "…" : ing}
              </Text>
            </View>
          ))}
          {recipe.ingredients.length > 3 && (
            <View style={[styles.tag, { backgroundColor: colors.muted }]}>
              <Text style={[styles.tagText, { color: colors.mutedForeground }]}>
                +{recipe.ingredients.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
