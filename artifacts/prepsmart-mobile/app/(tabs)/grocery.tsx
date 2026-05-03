import { Ionicons } from "@expo/vector-icons";
import {
  useCreateGroceryList,
  useDeleteGroceryList,
  useGenerateGroceryListFromPlan,
  useGetGroceryList,
  useListGroceryLists,
  useToggleGroceryItem,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

type Sheet = "create" | "generate" | null;

export default function GroceryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [sheet, setSheet] = useState<Sheet>(null);
  const [newListName, setNewListName] = useState("");
  const [genListName, setGenListName] = useState("");
  const [activeListId, setActiveListId] = useState<number | null>(null);

  const { data: lists, isLoading } = useListGroceryLists({});
  const { data: activeList } = useGetGroceryList(
    { id: activeListId! },
    { query: { enabled: activeListId !== null } }
  );

  const createMutation = useCreateGroceryList();
  const deleteMutation = useDeleteGroceryList();
  const toggleMutation = useToggleGroceryItem();
  const generateMutation = useGenerateGroceryListFromPlan();

  const handleCreate = () => {
    if (!newListName.trim()) return;
    createMutation.mutate(
      { name: newListName.trim() },
      {
        onSuccess: (data) => {
          qc.invalidateQueries({ queryKey: ["listGroceryLists"] });
          setSheet(null);
          setNewListName("");
          setActiveListId(data.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      }
    );
  };

  const handleGenerate = () => {
    generateMutation.mutate(
      { data: genListName.trim() ? { listName: genListName.trim() } : undefined },
      {
        onSuccess: (data) => {
          qc.invalidateQueries({ queryKey: ["listGroceryLists"] });
          setSheet(null);
          setGenListName("");
          setActiveListId(data.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err: unknown) => {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : "Could not generate list. Make sure your meal plan has recipes!";
          Alert.alert("Generation failed", msg);
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete list?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate({ id }, {
            onSuccess: () => {
              qc.invalidateQueries({ queryKey: ["listGroceryLists"] });
              if (activeListId === id) setActiveListId(null);
            },
          });
        },
      },
    ]);
  };

  const handleToggle = (listId: number, itemId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleMutation.mutate({ id: listId, itemId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["getGroceryList", { id: listId }] }),
    });
  };

  if (activeListId !== null && activeList) {
    const checkedCount = activeList.items?.filter((i) => i.isChecked).length ?? 0;
    const total = activeList.items?.length ?? 0;
    const pct = total > 0 ? (checkedCount / total) * 100 : 0;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <TouchableOpacity onPress={() => setActiveListId(null)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{activeList.name}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{checkedCount}/{total} items checked</Text>
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${pct}%` as any }]} />
        </View>

        {!activeList.items?.length ? (
          <View style={styles.center}>
            <Ionicons name="cart-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No items in this list</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.itemList, { paddingBottom: Platform.OS === "web" ? 100 : 120 }]}>
            {activeList.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleToggle(activeListId, item.id)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  {
                    borderColor: item.isChecked ? colors.primary : colors.border,
                    backgroundColor: item.isChecked ? colors.primary : "transparent",
                  },
                ]}>
                  {item.isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[
                  styles.itemName,
                  {
                    color: item.isChecked ? colors.mutedForeground : colors.foreground,
                    textDecorationLine: item.isChecked ? "line-through" : "none",
                  },
                ]}>
                  {item.name}
                </Text>
                {item.quantity && (
                  <View style={[styles.qtyBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.itemQty, { color: colors.primary }]}>{item.quantity}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Grocery</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.accent }]}
            onPress={() => setSheet("generate")}
          >
            <Ionicons name="sparkles" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.primary }]}
            onPress={() => setSheet("create")}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !lists?.length ? (
        <View style={styles.center}>
          <Ionicons name="cart-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No grocery lists</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Generate one from your meal plan or create a blank list
          </Text>
          <TouchableOpacity
            style={[styles.aiEmptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setSheet("generate")}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={[styles.aiEmptyBtnText, { color: "#fff" }]}>Generate from Meal Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSheet("create")}>
            <Text style={[styles.manualLink, { color: colors.mutedForeground }]}>or create blank list</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === "web" ? 100 : 120 }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setActiveListId(item.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.listIcon, { backgroundColor: colors.accent }]}>
                <Ionicons name="cart-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.listDate, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create blank list sheet */}
      <Modal visible={sheet === "create"} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSheet(null)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Grocery List</Text>
          <TextInput
            style={[styles.nameInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="List name…"
            placeholderTextColor={colors.mutedForeground}
            value={newListName}
            onChangeText={setNewListName}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }, !newListName.trim() && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={!newListName.trim() || createMutation.isPending}
          >
            {createMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Create</Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>

      {/* AI generate sheet */}
      <Modal visible={sheet === "generate"} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => !generateMutation.isPending && setSheet(null)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 24, gap: 0 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <LinearGradient
            colors={["#45a06520", "#45a06508"]}
            style={styles.genHero}
          >
            <View style={[styles.genHeroIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="sparkles" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.genHeroTitle, { color: colors.foreground }]}>AI Grocery List</Text>
            <Text style={[styles.genHeroSub, { color: colors.mutedForeground }]}>
              Scans your meal plan and consolidates all ingredients into a smart, ready-to-shop list.
            </Text>
          </LinearGradient>

          <View style={{ paddingHorizontal: 24, gap: 12, marginTop: 8 }}>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              placeholder="List name (optional)…"
              placeholderTextColor={colors.mutedForeground}
              value={genListName}
              onChangeText={setGenListName}
              editable={!generateMutation.isPending}
            />

            <View style={[styles.infoRow, { backgroundColor: colors.accent }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Uses your current week's meal plan. Duplicate ingredients are combined with smart quantities.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }, generateMutation.isPending && styles.btnDisabled]}
              onPress={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.saveBtnText, { color: "#fff" }]}>Building your list…</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                  <Text style={[styles.saveBtnText, { color: "#fff" }]}>Generate Shopping List</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
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
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 3, marginHorizontal: 20, marginBottom: 16, borderRadius: 2 },
  progressFill: { height: "100%", borderRadius: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  aiEmptyBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
  },
  aiEmptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  manualLink: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  listContent: { paddingHorizontal: 20, gap: 10, paddingTop: 4 },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  listIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  listDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  itemList: { paddingHorizontal: 20, gap: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  itemName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  qtyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  itemQty: { fontSize: 12, fontFamily: "Inter_500Medium" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", paddingHorizontal: 24, marginTop: 8, marginBottom: 12 },
  genHero: { padding: 24, alignItems: "center", gap: 8 },
  genHeroIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  genHeroTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  genHeroSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  nameInput: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, fontFamily: "Inter_400Regular" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  saveBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
