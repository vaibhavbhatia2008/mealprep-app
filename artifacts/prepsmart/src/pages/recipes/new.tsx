import { useState } from "react";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateRecipe,
  useImportRecipeFromUrl,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, X, Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const recipeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  instructions: z.string().min(1, "Instructions are required"),
  prepTime: z.string().optional(),
  calories: z.string().optional(),
});

export default function NewRecipe() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");

  const createMutation = useCreateRecipe();
  const importMutation = useImportRecipeFromUrl();

  const form = useForm<z.infer<typeof recipeSchema>>({
    resolver: zodResolver(recipeSchema),
    defaultValues: { name: "", instructions: "", prepTime: "", calories: "" },
  });

  const addIngredient = () => {
    const val = ingredientInput.trim().toLowerCase();
    if (val && !ingredients.includes(val)) {
      setIngredients((prev) => [...prev, val]);
      setIngredientInput("");
    }
  };

  const removeIngredient = (ing: string) =>
    setIngredients((prev) => prev.filter((i) => i !== ing));

  const handleImport = () => {
    if (!importUrl.trim()) return;
    importMutation.mutate(
      { data: { url: importUrl.trim() } },
      {
        onSuccess: (data) => {
          form.setValue("name", data.name, { shouldValidate: true });
          form.setValue("instructions", data.instructions, { shouldValidate: true });
          if (data.prepTime != null)
            form.setValue("prepTime", String(data.prepTime), { shouldValidate: true });
          if (data.calories != null)
            form.setValue("calories", String(data.calories), { shouldValidate: true });
          setIngredients(data.ingredients);
          setShowImport(false);
          setImportUrl("");
          toast({
            title: "Recipe imported",
            description: `"${data.name}" was pre-filled. Review and save when ready.`,
          });
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Import failed",
            description: err?.data?.error ?? err.message ?? "Could not extract a recipe from that URL.",
          });
        },
      }
    );
  };

  const onSubmit = (data: z.infer<typeof recipeSchema>) => {
    createMutation.mutate(
      {
        data: {
          name: data.name,
          instructions: data.instructions,
          ingredients,
          prepTime: data.prepTime ? parseInt(data.prepTime) : null,
          calories: data.calories ? parseInt(data.calories) : null,
        },
      },
      {
        onSuccess: (recipe) => {
          qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
          toast({ title: "Recipe created!" });
          setLocation(`/recipes/${recipe.id}`);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to create recipe" }),
      }
    );
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/recipes">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-serif font-bold">New Recipe</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowImport(true)}
          className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
          data-testid="button-import-url"
        >
          <Link2 className="h-4 w-4" />
          Import from URL
        </Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipe name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Chicken Stir Fry"
                        data-testid="input-recipe-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="prepTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prep time (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="30"
                          data-testid="input-prep-time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="calories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calories</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="450"
                          data-testid="input-calories"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Ingredients */}
              <div className="space-y-2">
                <FormLabel>Ingredients</FormLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add an ingredient..."
                    value={ingredientInput}
                    onChange={(e) => setIngredientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addIngredient();
                      }
                    }}
                    data-testid="input-ingredient"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addIngredient}
                    data-testid="button-add-ingredient"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <AnimatePresence>
                  {ingredients.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-wrap gap-2 pt-1 overflow-hidden"
                    >
                      {ingredients.map((ing) => (
                        <motion.div
                          key={ing}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <Badge variant="secondary" className="gap-1 capitalize">
                            {ing}
                            <button
                              type="button"
                              onClick={() => removeIngredient(ing)}
                              data-testid={`button-remove-ingredient-${ing}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe how to make this recipe..."
                        className="min-h-[140px] resize-none"
                        data-testid="textarea-instructions"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Link href="/recipes">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-recipe"
                >
                  {createMutation.isPending ? "Saving..." : "Save recipe"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Import from URL dialog */}
      <Dialog
        open={showImport}
        onOpenChange={(open) => {
          if (!importMutation.isPending) {
            setShowImport(open);
            if (!open) setImportUrl("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Import Recipe from URL
            </DialogTitle>
            <DialogDescription>
              Paste the URL of any recipe page — AllRecipes, Food Network, NYT Cooking, or personal
              blogs. We'll extract the recipe and pre-fill the form for you to review.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <Input
              placeholder="https://www.allrecipes.com/recipe/..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !importMutation.isPending) handleImport();
              }}
              disabled={importMutation.isPending}
              data-testid="input-import-url"
              autoFocus
            />
            {importMutation.isPending && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground flex items-center gap-2"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Fetching and parsing recipe...
              </motion.p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImport(false);
                setImportUrl("");
              }}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importUrl.trim() || importMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Recipe"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
