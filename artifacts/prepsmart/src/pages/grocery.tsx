import { useState } from "react";
import {
  useListGroceryLists,
  useGetGroceryList,
  useCreateGroceryList,
  useDeleteGroceryList,
  useToggleGroceryItem,
  useGetCurrentMealPlan,
  getListGroceryListsQueryKey,
  getGetGroceryListQueryKey,
  getGetCurrentMealPlanQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ShoppingBag, Zap, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Grocery() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newItems, setNewItems] = useState<string[]>([]);
  const [itemInput, setItemInput] = useState("");
  const [generateFromPlan, setGenerateFromPlan] = useState(false);

  const { data: lists, isLoading: listsLoading } = useListGroceryLists({
    query: { queryKey: getListGroceryListsQueryKey() },
  });

  const { data: selectedList } = useGetGroceryList(
    selectedListId!,
    { query: { enabled: selectedListId != null, queryKey: selectedListId != null ? getGetGroceryListQueryKey(selectedListId) : ["disabled"] } }
  );

  const { data: currentPlan } = useGetCurrentMealPlan({
    query: { queryKey: getGetCurrentMealPlanQueryKey() },
  });

  const createMutation = useCreateGroceryList();
  const deleteMutation = useDeleteGroceryList();
  const toggleMutation = useToggleGroceryItem();

  const handleCreate = () => {
    if (!newListName.trim()) return;
    createMutation.mutate({
      data: {
        name: newListName,
        mealPlanId: generateFromPlan && currentPlan ? currentPlan.id : null,
        items: newItems.map((name) => ({ name })),
      },
    }, {
      onSuccess: (list: any) => {
        qc.invalidateQueries({ queryKey: getListGroceryListsQueryKey() });
        setShowCreate(false);
        setNewListName("");
        setNewItems([]);
        setGenerateFromPlan(false);
        setSelectedListId(list.id);
        toast({ title: "Grocery list created!" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create list" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroceryListsQueryKey() });
        if (selectedListId === id) setSelectedListId(null);
        toast({ title: "List deleted" });
      },
    });
  };

  const handleToggle = (listId: number, itemId: number) => {
    toggleMutation.mutate({ id: listId, itemId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetGroceryListQueryKey(listId) }),
    });
  };

  const addItem = () => {
    const val = itemInput.trim();
    if (val && !newItems.includes(val)) {
      setNewItems([...newItems, val]);
      setItemInput("");
    }
  };

  const checkedCount = selectedList?.items?.filter((i: any) => i.isChecked).length ?? 0;
  const totalCount = selectedList?.items?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">Grocery Lists</h1>
          <p className="text-muted-foreground mt-1 text-sm">{lists?.length ?? 0} list{lists?.length !== 1 ? "s" : ""} saved</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-list">
          <Plus className="h-4 w-4 mr-2" /> New List
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* List sidebar */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Your Lists</h2>
          {listsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : !lists?.length ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No lists yet</p>
            </div>
          ) : (
            <AnimatePresence>
              {lists.map((list: any) => (
                <motion.div
                  key={list.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${selectedListId === list.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"}`}
                  onClick={() => setSelectedListId(list.id)}
                  data-testid={`list-item-${list.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{list.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(list.createdAt).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(list.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 p-1 ml-2 flex-shrink-0"
                    data-testid={`button-delete-list-${list.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* List detail */}
        <div className="md:col-span-2">
          {!selectedListId ? (
            <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Select a list to view items</p>
              <p className="text-sm mt-1">Or create a new list to get started</p>
            </div>
          ) : !selectedList ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : (
            <Card className="border-border/60">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-serif">{selectedList.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {checkedCount}/{totalCount} items checked
                  </p>
                </div>
                {totalCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round((checkedCount / totalCount) * 100)}% done
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {!selectedList.items?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No items in this list</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {selectedList.items.map((item: any) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${item.isChecked ? "bg-muted/40 border-border/30 opacity-60" : "bg-background border-border/50"}`}
                          data-testid={`grocery-item-${item.id}`}
                        >
                          <Checkbox
                            checked={item.isChecked}
                            onCheckedChange={() => handleToggle(selectedList.id, item.id)}
                            data-testid={`checkbox-item-${item.id}`}
                          />
                          <span className={`flex-1 text-sm capitalize ${item.isChecked ? "line-through text-muted-foreground" : ""}`}>
                            {item.name}
                          </span>
                          {item.quantity && (
                            <Badge variant="outline" className="text-xs">{item.quantity}</Badge>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={() => { setShowCreate(false); setNewListName(""); setNewItems([]); setGenerateFromPlan(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">New Grocery List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>List name</Label>
              <Input
                placeholder="e.g. Week of May 5"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                data-testid="input-list-name"
              />
            </div>

            {currentPlan && (
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${generateFromPlan ? "border-primary bg-primary/5" : "border-border/60"}`}
                onClick={() => setGenerateFromPlan(!generateFromPlan)}
                data-testid="toggle-generate-from-plan"
              >
                <Zap className={`h-5 w-5 ${generateFromPlan ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-sm font-medium">Generate from current meal plan</div>
                  <div className="text-xs text-muted-foreground">Auto-populate ingredients from your meals</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Additional items</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an item..."
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                  data-testid="input-new-item"
                />
                <Button type="button" variant="outline" onClick={addItem} data-testid="button-add-item">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newItems.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {newItems.map((item) => (
                    <Badge key={item} variant="secondary" className="gap-1">
                      {item}
                      <button onClick={() => setNewItems(newItems.filter((i) => i !== item))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!newListName.trim() || createMutation.isPending}
              data-testid="button-confirm-create-list"
            >
              {createMutation.isPending ? "Creating..." : "Create list"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
