import { Ionicons } from "@expo/vector-icons";
import {
  getListRecipesQueryKey,
  useDeleteRecipe,
  useListRecipes,
  useToggleRecipeFavorite,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { RecipeCard } from "@/components/RecipeCard";
import { RecipeCardSkeleton } from "@/components/SkeletonLoader";
import { useColors } from "@/hooks/useColors";

export default function RecipesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: recipes, isLoading } = useListRecipes(
    { search: search || undefined, favoritesOnly: favOnly || undefined },
    { query: { queryKey: getListRecipesQueryKey({ search: search || undefined, favoritesOnly: favOnly || undefined }) } }
  );

  const favMutation = useToggleRecipeFavorite();
  const deleteMutation = useDeleteRecipe();

  const handleFav = (id: number) => {
    favMutation.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListRecipesQueryKey() }),
    });
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Recipe", "Are you sure you want to delete this recipe?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          deleteMutation.mutate({ id }, {
            onSuccess: () => qc.invalidateQueries({ queryKey: getListRecipesQueryKey() }),
          });
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Recipes</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/recipes/new")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <View style={[styles.searchBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search recipes…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.favBtn, { backgroundColor: favOnly ? colors.primary : colors.muted, borderColor: favOnly ? colors.primary : colors.border }]}
          onPress={() => setFavOnly(!favOnly)}
        >
          <Ionicons name={favOnly ? "star" : "star-outline"} size={18} color={favOnly ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3, 4].map((i) => <RecipeCardSkeleton key={i} />)}
        </View>
      ) : !recipes?.length ? (
        <View style={styles.empty}>
          <Ionicons name="book-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {favOnly ? "No favorites yet" : search ? "No results" : "No recipes yet"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            {!favOnly && !search ? "Add your first recipe to get started" : "Try different filters"}
          </Text>
          {!favOnly && !search && (
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/recipes/new")}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Add Recipe</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RecipeCard recipe={item} onFavorite={handleFav} />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 100 : 120 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!recipes?.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  favBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
