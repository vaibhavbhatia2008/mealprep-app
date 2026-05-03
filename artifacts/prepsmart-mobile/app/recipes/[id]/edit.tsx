import { Ionicons } from "@expo/vector-icons";
import {
  getListRecipesQueryKey,
  useGetRecipe,
  useUpdateRecipe,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: recipe, isLoading } = useGetRecipe({ id: Number(id) });
  const updateMutation = useUpdateRecipe();

  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [instructions, setInstructions] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [calories, setCalories] = useState("");

  useEffect(() => {
    if (recipe) {
      setName(recipe.name);
      setIngredients(recipe.ingredients.length ? recipe.ingredients : [""]);
      setInstructions(recipe.instructions ?? "");
      setPrepTime(recipe.prepTime != null ? String(recipe.prepTime) : "");
      setCalories(recipe.calories != null ? String(recipe.calories) : "");
    }
  }, [recipe?.id]);

  const addIngredient = () => setIngredients([...ingredients, ""]);

  const updateIngredient = (index: number, value: string) => {
    const next = [...ingredients];
    next[index] = value;
    setIngredients(next);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    const validIngredients = ingredients.filter((i) => i.trim());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateMutation.mutate(
      {
        id: Number(id),
        data: {
          name: name.trim(),
          ingredients: validIngredients,
          instructions: instructions.trim(),
          prepTime: prepTime ? parseInt(prepTime) : null,
          calories: calories ? parseInt(calories) : null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
          qc.invalidateQueries({ queryKey: ["getRecipe", { id: Number(id) }] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: () => Alert.alert("Error", "Failed to save recipe"),
      }
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="close" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Edit Recipe</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, updateMutation.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Recipe name" required colors={colors}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Recipe name"
            placeholderTextColor={colors.mutedForeground}
          />
        </Field>

        <View style={styles.row2}>
          <Field label="Prep time (min)" colors={colors} style={{ flex: 1 }}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              placeholder="30"
              placeholderTextColor={colors.mutedForeground}
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="number-pad"
            />
          </Field>
          <Field label="Calories" colors={colors} style={{ flex: 1 }}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              placeholder="450"
              placeholderTextColor={colors.mutedForeground}
              value={calories}
              onChangeText={setCalories}
              keyboardType="number-pad"
            />
          </Field>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.label, { color: colors.foreground }]}>Ingredients <Text style={{ color: colors.destructive }}>*</Text></Text>
            <TouchableOpacity onPress={addIngredient}>
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingRow}>
              <TextInput
                style={[styles.ingInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder={`Ingredient ${i + 1}`}
                placeholderTextColor={colors.mutedForeground}
                value={ing}
                onChangeText={(v) => updateIngredient(i, v)}
              />
              <TouchableOpacity onPress={() => removeIngredient(i)} disabled={ingredients.length === 1}>
                <Ionicons name="remove-circle-outline" size={22} color={ingredients.length === 1 ? colors.muted : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Field label="Instructions" colors={colors}>
          <TextInput
            style={[styles.textarea, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Step-by-step instructions…"
            placeholderTextColor={colors.mutedForeground}
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </Field>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Field({ label, required, children, colors, style }: any) {
  return (
    <View style={[styles.fieldGroup, style]}>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {label} {required && <Text style={{ color: colors.destructive }}>*</Text>}
      </Text>
      {children}
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
  title: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  form: { paddingHorizontal: 20, gap: 20, paddingTop: 8 },
  fieldGroup: { gap: 8 },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, fontFamily: "Inter_400Regular" },
  textarea: { borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, fontSize: 15, borderWidth: 1, fontFamily: "Inter_400Regular", minHeight: 120 },
  row2: { flexDirection: "row", gap: 12 },
  ingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ingInput: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, borderWidth: 1, fontFamily: "Inter_400Regular" },
});
