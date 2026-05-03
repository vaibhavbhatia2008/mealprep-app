import { Ionicons } from "@expo/vector-icons";
import {
  useCreateGroceryList,
  useDeleteGroceryList,
  useGetGroceryList,
  useListGroceryLists,
  useToggleGroceryItem,
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";

export default function GroceryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [activeListId, setActiveListId] = useState<number | null>(null);

  const { data: lists, isLoading } = useListGroceryLists({});
  const { data: activeList } = useGetGroceryList(
    { id: activeListId! },
    { query: { enabled: activeListId !== null } }
  );

  const createMutation = useCreateGroceryList();
  const deleteMutation = useDeleteGroceryList();
  const toggleMutation = useToggleGroceryItem();

  const handleCreate = () => {
    if (!newListName.trim()) return;
    createMutation.mutate(
      { name: newListName.trim() },
      {
        onSuccess: (data) => {
          qc.invalidateQueries({ queryKey: ["listGroceryLists"] });
          setShowCreate(false);
          setNewListName("");
          setActiveListId(data.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <TouchableOpacity onPress={() => setActiveListId(null)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{activeList.name}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{checkedCount}/{total} items</Text>
          </View>
        </View>

        <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: total > 0 ? `${(checkedCount / total) * 100}%` : "0%" as any }]} />
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
                <View style={[styles.checkbox, { borderColor: item.isChecked ? colors.primary : colors.border, backgroundColor: item.isChecked ? colors.primary : "transparent" }]}>
                  {item.isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[styles.itemName, { color: item.isChecked ? colors.mutedForeground : colors.foreground, textDecorationLine: item.isChecked ? "line-through" : "none" }]}>
                  {item.name}
                </Text>
                {item.quantity && (
                  <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
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
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !lists?.length ? (
        <View style={styles.center}>
          <Ionicons name="cart-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No grocery lists</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Create your first list</Text>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCreate(true)}>
            <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Create List</Text>
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

      <Modal visible={showCreate} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCreate(false)} />
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
            style={[styles.saveBtn, { backgroundColor: colors.primary }, !newListName.trim() && styles.saveBtnDisabled]}
            onPress={handleCreate}
            disabled={!newListName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? <ActivityIndicator color="#fff" /> : (
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Create</Text>
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
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  progressBar: { height: 3, marginHorizontal: 20, marginBottom: 16, borderRadius: 2 },
  progressFill: { height: "100%", borderRadius: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  createBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  createBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
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
  itemQty: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  nameInput: { height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, fontFamily: "Inter_400Regular" },
  saveBtn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
