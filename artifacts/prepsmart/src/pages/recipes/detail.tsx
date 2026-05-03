import { Link, useLocation } from "wouter";
import {
  useGetRecipe,
  useDeleteRecipe,
  useToggleRecipeFavorite,
  getGetRecipeQueryKey,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, Clock, Flame, Edit2, Trash2, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Props {
  id: string;
}

export default function RecipeDetail({ id }: Props) {
  const recipeId = parseInt(id);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: recipe, isLoading } = useGetRecipe(recipeId, {
    query: { enabled: !!recipeId, queryKey: getGetRecipeQueryKey(recipeId) },
  });

  const deleteMutation = useDeleteRecipe();
  const favMutation = useToggleRecipeFavorite();

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-6"
    >
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
      <div className="flex gap-4 text-sm text-muted-foreground">
        {recipe.prepTime && (
          <span className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5">
            <Clock className="h-4 w-4" /> {recipe.prepTime} min
          </span>
        )}
        {recipe.calories && (
          <span className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5">
            <Flame className="h-4 w-4 text-orange-500" /> {recipe.calories} cal
          </span>
        )}
      </div>

      {/* Ingredients */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ingredients</CardTitle>
        </CardHeader>
        <CardContent>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No ingredients listed</p>
          ) : (
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span className="capitalize">{ing}</span>
                </li>
              ))}
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{recipe.instructions || "No instructions provided"}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
