import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGetRecipe,
  useUpdateRecipe,
  getGetRecipeQueryKey,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const recipeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  instructions: z.string().min(1, "Instructions are required"),
  prepTime: z.string().optional(),
  calories: z.string().optional(),
});

interface Props {
  id: string;
}

export default function EditRecipe({ id }: Props) {
  const recipeId = parseInt(id);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState("");

  const { data: recipe, isLoading } = useGetRecipe(recipeId, {
    query: { enabled: !!recipeId, queryKey: getGetRecipeQueryKey(recipeId) },
  });

  const updateMutation = useUpdateRecipe();

  const form = useForm<z.infer<typeof recipeSchema>>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { name: "", instructions: "", prepTime: "", calories: "" },
  });

  useEffect(() => {
    if (recipe) {
      form.reset({
        name: recipe.name,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime != null ? String(recipe.prepTime) : "",
        calories: recipe.calories != null ? String(recipe.calories) : "",
      });
      setIngredients(recipe.ingredients ?? []);
    }
  }, [recipe]);

  const addIngredient = () => {
    const val = ingredientInput.trim().toLowerCase();
    if (val && !ingredients.includes(val)) {
      setIngredients([...ingredients, val]);
      setIngredientInput("");
    }
  };

  const removeIngredient = (ing: string) => setIngredients(ingredients.filter((i) => i !== ing));

  const onSubmit = (data: z.infer<typeof recipeSchema>) => {
    updateMutation.mutate({
      id: recipeId,
      data: {
        name: data.name,
        instructions: data.instructions,
        ingredients,
        prepTime: data.prepTime ? parseInt(data.prepTime) : null,
        calories: data.calories ? parseInt(data.calories) : null,
      },
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetRecipeQueryKey(recipeId) });
        qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
        toast({ title: "Recipe updated!" });
        setLocation(`/recipes/${recipeId}`);
      },
      onError: () => toast({ variant: "destructive", title: "Failed to update recipe" }),
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/recipes/${recipeId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-serif font-bold">Edit Recipe</h1>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Chicken Stir Fry" data-testid="input-recipe-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="prepTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prep time (minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="30" data-testid="input-prep-time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="calories" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calories</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="450" data-testid="input-calories" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Ingredients */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Ingredients</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add an ingredient..."
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIngredient(); } }}
                    data-testid="input-ingredient"
                  />
                  <Button type="button" variant="outline" onClick={addIngredient} data-testid="button-add-ingredient">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ingredients.map((ing) => (
                      <Badge key={ing} variant="secondary" className="gap-1 capitalize">
                        {ing}
                        <button type="button" onClick={() => removeIngredient(ing)} data-testid={`button-remove-ingredient-${ing}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <FormField control={form.control} name="instructions" render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe how to make this recipe..."
                      className="min-h-[120px] resize-none"
                      data-testid="textarea-instructions"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-3 pt-2">
                <Link href={`/recipes/${recipeId}`}>
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-recipe">
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
