import { useState } from "react";
import { Link } from "wouter";
import {
  useListRecipes,
  useDeleteRecipe,
  useToggleRecipeFavorite,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Star, Clock, Flame, Trash2, Edit2, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Recipes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const { data: recipes, isLoading } = useListRecipes(
    { search: search || undefined, favoritesOnly: favOnly || undefined },
    { query: { queryKey: getListRecipesQueryKey({ search: search || undefined, favoritesOnly: favOnly || undefined }) } }
  );

  const deleteMutation = useDeleteRecipe();
  const favMutation = useToggleRecipeFavorite();

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
        toast({ title: "Recipe deleted" });
      },
    });
  };

  const handleFav = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    favMutation.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListRecipesQueryKey() }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">Recipes</h1>
          <p className="text-muted-foreground mt-1 text-sm">{recipes?.length ?? 0} recipes saved</p>
        </div>
        <Link href="/recipes/new">
          <Button data-testid="button-new-recipe">
            <Plus className="h-4 w-4 mr-2" /> New Recipe
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-recipes"
          />
        </div>
        <Button
          variant={favOnly ? "default" : "outline"}
          onClick={() => setFavOnly(!favOnly)}
          size="sm"
          className="gap-2"
          data-testid="button-filter-favorites"
        >
          <Star className={`h-4 w-4 ${favOnly ? "fill-current" : ""}`} />
          Favorites
        </Button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : !recipes?.length ? (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-base">{favOnly ? "No favorite recipes" : search ? "No recipes found" : "No recipes yet"}</p>
          <p className="text-sm mt-1">
            {!favOnly && !search ? "Add your first recipe to get started" : "Try adjusting your filters"}
          </p>
          {!favOnly && !search && (
            <Link href="/recipes/new">
              <Button variant="outline" size="sm" className="mt-4">
                <Plus className="h-3 w-3 mr-1" /> Add recipe
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        >
          <AnimatePresence>
            {recipes.map((recipe: any) => (
              <motion.div
                key={recipe.id}
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Link href={`/recipes/${recipe.id}`}>
                  <Card className="group cursor-pointer hover:shadow-md transition-all border-border/60 hover:border-primary/30 h-full" data-testid={`card-recipe-${recipe.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {recipe.name}
                        </CardTitle>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => handleFav(recipe.id, e)}
                            className="p-1 rounded-md hover:bg-accent transition-colors"
                            data-testid={`button-favorite-${recipe.id}`}
                          >
                            <Star className={`h-4 w-4 ${recipe.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {recipe.prepTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {recipe.prepTime} min
                          </span>
                        )}
                        {recipe.calories && (
                          <span className="flex items-center gap-1">
                            <Flame className="h-3 w-3" /> {recipe.calories} cal
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {recipe.ingredients.slice(0, 3).map((ing: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs capitalize">
                            {ing.length > 20 ? ing.slice(0, 20) + "…" : ing}
                          </Badge>
                        ))}
                        {recipe.ingredients.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{recipe.ingredients.length - 3}</Badge>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/recipes/${recipe.id}/edit`} onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="h-7 text-xs" data-testid={`button-edit-recipe-${recipe.id}`}>
                            <Edit2 className="h-3 w-3 mr-1" /> Edit
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => handleDelete(recipe.id, e)}
                          data-testid={`button-delete-recipe-${recipe.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
