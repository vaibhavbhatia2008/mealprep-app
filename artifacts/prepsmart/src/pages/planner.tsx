import { useState } from "react";
import {
  useGetCurrentMealPlan,
  useCreateMealPlan,
  useAddMeal,
  useDeleteMeal,
  useListRecipes,
  getGetCurrentMealPlanQueryKey,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Calendar, ChefHat } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_DOW = [1, 2, 3, 4, 5, 6, 0];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = typeof MEAL_TYPES[number];

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800",
  lunch: "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800",
  dinner: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
  snack: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800",
};
const MEAL_BADGE: Record<MealType, string> = {
  breakfast: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  lunch: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  dinner: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  snack: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
};

function getWeekStart() {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  return monday.toISOString().split("T")[0];
}

export default function Planner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addingMeal, setAddingMeal] = useState<{ dayIndex: number; mealType: MealType } | null>(null);
  const [recipeId, setRecipeId] = useState<string>("");
  const [customName, setCustomName] = useState("");

  const { data: plan, isLoading } = useGetCurrentMealPlan({
    query: { queryKey: getGetCurrentMealPlanQueryKey() },
  });

  const { data: recipes } = useListRecipes(undefined, {
    query: { queryKey: getListRecipesQueryKey() },
  });

  const createPlan = useCreateMealPlan();
  const addMeal = useAddMeal();
  const deleteMeal = useDeleteMeal();

  const handleCreatePlan = () => {
    createPlan.mutate({ data: { weekStart: getWeekStart() } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCurrentMealPlanQueryKey() });
        toast({ title: "Meal plan created!" });
      },
    });
  };

  const handleAddMeal = () => {
    if (!plan) return;
    if (!addingMeal) return;
    const dow = DAY_DOW[addingMeal.dayIndex];
    addMeal.mutate(
      {
        id: plan.id,
        data: {
          dayOfWeek: dow,
          mealType: addingMeal.mealType,
          recipeId: recipeId ? parseInt(recipeId) : null,
          customName: !recipeId && customName ? customName : null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCurrentMealPlanQueryKey() });
          setAddingMeal(null);
          setRecipeId("");
          setCustomName("");
        },
        onError: () => toast({ variant: "destructive", title: "Failed to add meal" }),
      }
    );
  };

  const handleDeleteMeal = (mealId: number) => {
    if (!plan) return;
    deleteMeal.mutate({ id: plan.id, mealId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetCurrentMealPlanQueryKey() }),
    });
  };

  const getMealsForSlot = (dayIndex: number, mealType: MealType) => {
    const dow = DAY_DOW[dayIndex];
    return plan?.meals?.filter((m: any) => m.dayOfWeek === dow && m.mealType === mealType) ?? [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">Weekly Planner</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {plan ? `Week of ${plan.weekStart}` : "Plan your meals for the week"}
          </p>
        </div>
        {!plan && !isLoading && (
          <Button onClick={handleCreatePlan} disabled={createPlan.isPending} data-testid="button-create-plan">
            <Plus className="h-4 w-4 mr-2" /> Create this week's plan
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {MEAL_TYPES.map((t) => <Skeleton key={t} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : !plan ? (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-base">No meal plan for this week</p>
          <p className="text-sm mt-1">Create a plan to start adding meals</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-8 gap-2 mb-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-2" />
              {DAYS.map((day, i) => {
                const today = new Date();
                const dow = today.getDay();
                const isToday = DAY_DOW[i] === dow;
                return (
                  <div key={day} className={`text-center py-2 rounded-lg text-sm font-semibold ${isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                    {day}
                    {isToday && <div className="w-1.5 h-1.5 bg-primary rounded-full mx-auto mt-1" />}
                  </div>
                );
              })}
            </div>

            {/* Meal rows */}
            {MEAL_TYPES.map((mealType) => (
              <div key={mealType} className="grid grid-cols-8 gap-2 mb-2">
                <div className="flex items-start pt-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md capitalize ${MEAL_BADGE[mealType]}`}>
                    {mealType}
                  </span>
                </div>
                {DAYS.map((_, dayIndex) => {
                  const slotMeals = getMealsForSlot(dayIndex, mealType);
                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[80px] rounded-lg border p-1.5 flex flex-col gap-1 ${MEAL_COLORS[mealType]}`}
                    >
                      {slotMeals.map((meal: any) => (
                        <motion.div
                          key={meal.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="group relative bg-white/80 dark:bg-background/60 rounded-md p-1.5 text-xs border border-border/40 flex items-start justify-between gap-1"
                          data-testid={`meal-card-${meal.id}`}
                        >
                          <span className="truncate leading-tight">{meal.recipe?.name ?? meal.customName ?? "Meal"}</span>
                          <button
                            onClick={() => handleDeleteMeal(meal.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80 flex-shrink-0"
                            data-testid={`button-delete-meal-${meal.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </motion.div>
                      ))}
                      <button
                        onClick={() => setAddingMeal({ dayIndex, mealType })}
                        className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center h-6 opacity-50 hover:opacity-100"
                        data-testid={`button-add-meal-${dayIndex}-${mealType}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add meal dialog */}
      <Dialog open={!!addingMeal} onOpenChange={() => { setAddingMeal(null); setRecipeId(""); setCustomName(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add Meal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Choose from recipes</Label>
              <Select value={recipeId} onValueChange={setRecipeId}>
                <SelectTrigger data-testid="select-recipe">
                  <SelectValue placeholder="Select a recipe..." />
                </SelectTrigger>
                <SelectContent>
                  {recipes?.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!recipeId && (
              <div className="space-y-2">
                <Label>Or enter a custom meal name</Label>
                <Input
                  placeholder="e.g. Oatmeal with berries"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  data-testid="input-custom-meal"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingMeal(null)}>Cancel</Button>
            <Button
              onClick={handleAddMeal}
              disabled={addMeal.isPending || (!recipeId && !customName)}
              data-testid="button-confirm-add-meal"
            >
              {addMeal.isPending ? "Adding..." : "Add meal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
