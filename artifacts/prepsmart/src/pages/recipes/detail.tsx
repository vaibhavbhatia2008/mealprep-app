import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetRecipe,
  useDeleteRecipe,
  useToggleRecipeFavorite,
  useCloneRecipe,
  getGetRecipeQueryKey,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, Clock, Flame, Edit2, Trash2, Check, Copy, ChefHat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Props {
  id: string;
}

const MULTIPLIERS = [
  { label: "½×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "3×", value: 3 },
  { label: "4×", value: 4 },
];

function parseFraction(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) {
    const [num, den] = trimmed.split("/").map(Number);
    if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
  }
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

function formatNumber(n: number): string {
  if (n === Math.round(n)) return String(Math.round(n));

  const fractions: [number, string][] = [
    [0.125, "⅛"], [0.25, "¼"], [0.333, "⅓"], [0.5, "½"],
    [0.667, "⅔"], [0.75, "¾"],
  ];
  const whole = Math.floor(n);
  const frac = n - whole;

  for (const [val, sym] of fractions) {
    if (Math.abs(frac - val) < 0.04) {
      return whole > 0 ? `${whole}${sym}` : sym;
    }
  }

  return parseFloat(n.toFixed(2)).toString();
}

function scaleIngredient(ingredient: string, multiplier: number): string {
  if (multiplier === 1) return ingredient;

  // Pattern: optional whole number + optional fraction + unit + rest
  // e.g. "1 1/2 cups flour", "2 tbsp olive oil", "1/4 tsp salt", "3 eggs"
  const pattern = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)/;
  const match = ingredient.match(pattern);
  if (!match) return ingredient;

  let quantityStr = match[1].trim();
  const rest = match[2];

  // Handle mixed numbers like "1 1/2"
  let quantity: number | null = null;
  const mixedMatch = quantityStr.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const frac = parseFraction(mixedMatch[2]);
    if (frac !== null) quantity = whole + frac;
  } else {
    quantity = parseFraction(quantityStr);
  }

  if (quantity === null) return ingredient;

  const scaled = quantity * multiplier;
  return `${formatNumber(scaled)} ${rest}`.trim();
}

export default function RecipeDetail({ id }: Props) {
  const recipeId = parseInt(id);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [multiplier, setMultiplier] = useState(1);

  const { data: recipe, isLoading } = useGetRecipe(recipeId, {
    query: { enabled: !!recipeId, queryKey: getGetRecipeQueryKey(recipeId) },
  });

  const deleteMutation = useDeleteRecipe();
  const favMutation = useToggleRecipeFavorite();
  const cloneMutation = useCloneRecipe();

  const handleDelete = () => {
    deleteMutation.mutate({ id: recipeId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
        toast({ title: "Recipe deleted" });
        setLocation("/recipes");
      },
    });
  };

  const handleFav = () => {
    favMutation.mutate({ id: recipeId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(recipeId) }),
    });
  };

  const handleClone = () => {
    cloneMutation.mutate({ id: recipeId }, {
      onSuccess: (cloned) => {
        qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
        toast({ title: "Recipe duplicated", description: `"${cloned.name}" is ready to edit.` });
        setLocation(`/recipes/${cloned.id}/edit`);
      },
      onError: () => toast({ variant: "destructive", title: "Failed to duplicate recipe" }),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Recipe not found</p>
        <Link href="/recipes"><Button variant="outline" className="mt-4">Back to recipes</Button></Link>
      </div>
    );
  }

  const scaledCalories = recipe.calories
    ? Math.round(recipe.calories * multiplier)
    : null;
  const scaledPrepTime = recipe.prepTime
    ? Math.round(recipe.prepTime * multiplier)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/recipes">
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-serif font-bold flex-1">{recipe.name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleFav}
            className={recipe.isFavorite ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20" : ""}
            data-testid="button-favorite"
          >
            <Star className={`h-4 w-4 ${recipe.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleClone}
            disabled={cloneMutation.isPending}
            title="Duplicate recipe"
            data-testid="button-clone"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Link href={`/recipes/${recipeId}/edit`}>
            <Button variant="outline" size="icon" data-testid="button-edit">
              <Edit2 className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive"
            disabled={deleteMutation.isPending}
            data-testid="button-delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {recipe.prepTime && (
          <span className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5">
            <Clock className="h-4 w-4" />
            <AnimatePresence mode="wait">
              <motion.span
                key={scaledPrepTime}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                {scaledPrepTime} min
              </motion.span>
            </AnimatePresence>
            {multiplier !== 1 && (
              <span className="text-xs text-muted-foreground/60">(scaled)</span>
            )}
          </span>
        )}
        {recipe.calories && (
          <span className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5">
            <Flame className="h-4 w-4 text-orange-500" />
            <AnimatePresence mode="wait">
              <motion.span
                key={scaledCalories}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
              >
                {scaledCalories} cal
              </motion.span>
            </AnimatePresence>
            {multiplier !== 1 && (
              <span className="text-xs text-muted-foreground/60">(scaled)</span>
            )}
          </span>
        )}
      </div>

      {/* Ingredients with scaler */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-primary" />
              Ingredients
            </CardTitle>
            {recipe.ingredients.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Scale:</span>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {MULTIPLIERS.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setMultiplier(value)}
                      data-testid={`button-scale-${label}`}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        multiplier === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No ingredients listed</p>
          ) : (
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => {
                const scaled = scaleIngredient(ing, multiplier);
                const changed = scaled !== ing;
                return (
                  <motion.li
                    key={i}
                    layout
                    className="flex items-center gap-2 text-sm"
                  >
                    <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`${i}-${multiplier}`}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 4 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        className={`capitalize ${changed ? "text-primary font-medium" : ""}`}
                      >
                        {scaled}
                      </motion.span>
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {recipe.instructions || "No instructions provided"}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
