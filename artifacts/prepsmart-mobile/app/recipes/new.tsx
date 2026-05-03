import { Ionicons } from "@expo/vector-icons";
import {
  getListRecipesQueryKey,
  useCreateRecipe,
  useImportRecipeFromUrl,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
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

export default function NewRecipeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [instructions, setInstructions] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [calories, setCalories] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [showImport, setShowImport] = useState(false);

  const createMutation = useCreateRecipe();
  const importMutation = useImportRecipeFromUrl();

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
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a recipe name");
      return;
    }
    const validIngredients = ingredients.filter((i) => i.trim());
    if (!validIngredients.length) {
      Alert.alert("Ingredients required", "Add at least one ingredient");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createMutation.mutate(
      {
        data: {
          name: name.trim(),
          ingredients: validIngredients,
          instructions: instructions.trim(),
          prepTime: prepTime ? parseInt(prepTime) : null,
          calories: calories ? parseInt(calories) : null,
        },
      },
      {
        onSuccess: (recipe) => {
          qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace(`/recipes/${recipe.id}`);
        },
        onError: () => Alert.alert("Error", "Failed to save recipe"),
      }
    );
  };

  const handleImport = () => {
    if (!importUrl.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    importMutation.mutate(
      { data: { url: importUrl.trim() } },
      {
        onSuccess: (data) => {
          if (data.name) setName(data.name);
          if (data.ingredients?.length) setIngredients(data.ingredients);
          if (data.instructions) setInstructions(data.instructions);
          if (data.prepTime) setPrepTime(String(data.prepTime));
          if (data.calories) setCalories(String(data.calories));
          setShowImport(false);
          setImportUrl("");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => Alert.alert("Import failed", "Could not extract recipe from this URL"),
      }
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="close" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>New Recipe</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, createMutation.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={[styles.importRow, { backgroundColor: colors.accent, borderColor: colors.accentForeground + "30" }]}
          onPress={() => setShowImport(!showImport)}
        >
          <Ionicons name="link-outline" size={18} color={colors.accentForeground} />
          <Text style={[styles.importLabel, { color: colors.accentForeground }]}>Import from URL</Text>
          <Ionicons name={showImport ? "chevron-up" : "chevron-down"} size={16} color={colors.accentForeground} />
        </TouchableOpacity>

        {showImport && (
          <View style={styles.importBox}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              placeholder="https://recipe-site.com/pasta-recipe"
              placeholderTextColor={colors.mutedForeground}
              value={importUrl}
              onChangeText={setImportUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: colors.primary }, importMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleImport}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={[styles.importBtnText, { color: colors.primaryForeground }]}>Import</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Field label="Recipe name" required colors={colors}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Lemon Herb Chicken"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
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
            <TouchableOpacity onPress={addIngredient} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
  importRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  importLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  importBox: { gap: 10 },
  importBtn: { height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  importBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldGroup: { gap: 8 },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  input: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, fontFamily: "Inter_400Regular" },
  textarea: { borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, fontSize: 15, borderWidth: 1, fontFamily: "Inter_400Regular", minHeight: 120 },
  row2: { flexDirection: "row", gap: 12 },
  ingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ingInput: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, borderWidth: 1, fontFamily: "Inter_400Regular" },
});
