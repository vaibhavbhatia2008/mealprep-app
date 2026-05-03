import { Router, type IRouter } from "express";
import { db, recipesTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { CreateRecipeBody, UpdateRecipeBody, GetRecipeParams, ListRecipesQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/recipes", requireAuth, async (req, res): Promise<void> => {
  const params = ListRecipesQueryParams.safeParse(req.query);
  const userId = req.user!.userId;

  let query = db.select().from(recipesTable).where(eq(recipesTable.userId, userId));

  const conditions = [eq(recipesTable.userId, userId)];
  if (params.success && params.data.favoritesOnly) {
    conditions.push(eq(recipesTable.isFavorite, true));
  }

  let recipes = await db
    .select()
    .from(recipesTable)
    .where(and(...conditions))
    .orderBy(recipesTable.createdAt);

  if (params.success && params.data.search) {
    const search = params.data.search.toLowerCase();
    recipes = recipes.filter((r) => r.name.toLowerCase().includes(search));
  }

  res.json(
    recipes.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  );
});

router.post("/recipes", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.userId;
  const [recipe] = await db
    .insert(recipesTable)
    .values({ ...parsed.data, userId })
    .returning();

  res.status(201).json({
    ...recipe,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  });
});

router.get("/recipes/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(and(eq(recipesTable.id, params.data.id), eq(recipesTable.userId, req.user!.userId)));
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.json({
    ...recipe,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  });
});

router.patch("/recipes/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [recipe] = await db
    .update(recipesTable)
    .set(parsed.data)
    .where(and(eq(recipesTable.id, params.data.id), eq(recipesTable.userId, req.user!.userId)))
    .returning();
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  res.json({
    ...recipe,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  });
});

router.delete("/recipes/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(recipesTable)
    .where(and(eq(recipesTable.id, params.data.id), eq(recipesTable.userId, req.user!.userId)));
  res.sendStatus(204);
});

router.post("/recipes/:id/clone", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.userId;
  const [original] = await db
    .select()
    .from(recipesTable)
    .where(and(eq(recipesTable.id, params.data.id), eq(recipesTable.userId, userId)));
  if (!original) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  const [cloned] = await db
    .insert(recipesTable)
    .values({
      userId,
      name: `${original.name} (copy)`,
      ingredients: original.ingredients,
      instructions: original.instructions,
      prepTime: original.prepTime,
      calories: original.calories,
      isFavorite: false,
    })
    .returning();
  res.status(201).json({
    ...cloned,
    createdAt: cloned.createdAt.toISOString(),
    updatedAt: cloned.updatedAt.toISOString(),
  });
});

router.patch("/recipes/:id/favorite", requireAuth, async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(recipesTable)
    .where(and(eq(recipesTable.id, params.data.id), eq(recipesTable.userId, req.user!.userId)));
  if (!existing) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }
  const [recipe] = await db
    .update(recipesTable)
    .set({ isFavorite: !existing.isFavorite })
    .where(eq(recipesTable.id, params.data.id))
    .returning();
  res.json({
    ...recipe,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  });
});

export default router;
