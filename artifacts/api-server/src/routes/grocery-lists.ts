import { Router, type IRouter } from "express";
import { db, groceryListsTable, groceryItemsTable, mealsTable, recipesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateGroceryListBody,
  GetGroceryListParams,
  ToggleGroceryItemParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function getListWithItems(listId: number) {
  const [list] = await db
    .select()
    .from(groceryListsTable)
    .where(eq(groceryListsTable.id, listId));
  if (!list) return null;
  const items = await db
    .select()
    .from(groceryItemsTable)
    .where(eq(groceryItemsTable.groceryListId, listId));
  return {
    ...list,
    createdAt: list.createdAt.toISOString(),
    items,
  };
}

router.get("/grocery-lists", requireAuth, async (req, res): Promise<void> => {
  const lists = await db
    .select()
    .from(groceryListsTable)
    .where(eq(groceryListsTable.userId, req.user!.userId))
    .orderBy(groceryListsTable.createdAt);
  res.json(lists.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

router.post("/grocery-lists", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGroceryListBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, mealPlanId, items: manualItems } = parsed.data;

  const [list] = await db
    .insert(groceryListsTable)
    .values({ name, userId: req.user!.userId, mealPlanId: mealPlanId ?? null })
    .returning();

  const allIngredients: { name: string; quantity: string | null }[] = [];

  if (mealPlanId) {
    const meals = await db
      .select()
      .from(mealsTable)
      .where(eq(mealsTable.mealPlanId, mealPlanId));

    const recipeIds = [...new Set(meals.map((m) => m.recipeId).filter(Boolean) as number[])];
    const ingredientCounts: Record<string, number> = {};

    for (const recipeId of recipeIds) {
      const [recipe] = await db
        .select()
        .from(recipesTable)
        .where(eq(recipesTable.id, recipeId));
      if (recipe) {
        for (const ingredient of recipe.ingredients) {
          const key = ingredient.toLowerCase().trim();
          ingredientCounts[key] = (ingredientCounts[key] ?? 0) + 1;
        }
      }
    }

    for (const [ingredient, count] of Object.entries(ingredientCounts)) {
      allIngredients.push({
        name: ingredient,
        quantity: count > 1 ? `x${count}` : null,
      });
    }
  }

  if (manualItems && manualItems.length > 0) {
    for (const item of manualItems) {
      const existing = allIngredients.findIndex(
        (i) => i.name.toLowerCase() === item.name.toLowerCase()
      );
      if (existing === -1) {
        allIngredients.push({ name: item.name, quantity: item.quantity ?? null });
      }
    }
  }

  if (allIngredients.length > 0) {
    await db.insert(groceryItemsTable).values(
      allIngredients.map((i) => ({
        groceryListId: list.id,
        name: i.name,
        quantity: i.quantity,
        isChecked: false,
      }))
    );
  }

  const result = await getListWithItems(list.id);
  res.status(201).json(result);
});

router.get("/grocery-lists/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetGroceryListParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [list] = await db
    .select()
    .from(groceryListsTable)
    .where(
      and(
        eq(groceryListsTable.id, params.data.id),
        eq(groceryListsTable.userId, req.user!.userId)
      )
    );
  if (!list) {
    res.status(404).json({ error: "Grocery list not found" });
    return;
  }
  const result = await getListWithItems(list.id);
  res.json(result);
});

router.delete("/grocery-lists/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetGroceryListParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(groceryListsTable)
    .where(
      and(
        eq(groceryListsTable.id, params.data.id),
        eq(groceryListsTable.userId, req.user!.userId)
      )
    );
  res.sendStatus(204);
});

router.patch("/grocery-lists/:id/items/:itemId/check", requireAuth, async (req, res): Promise<void> => {
  const params = ToggleGroceryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(groceryItemsTable)
    .where(
      and(
        eq(groceryItemsTable.id, params.data.itemId),
        eq(groceryItemsTable.groceryListId, params.data.id)
      )
    );
  if (!existing) {
    res.status(404).json({ error: "Grocery item not found" });
    return;
  }

  const [item] = await db
    .update(groceryItemsTable)
    .set({ isChecked: !existing.isChecked })
    .where(eq(groceryItemsTable.id, params.data.itemId))
    .returning();
  res.json(item);
});

export default router;
