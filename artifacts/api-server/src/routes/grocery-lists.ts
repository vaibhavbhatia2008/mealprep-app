import { Router, type IRouter } from "express";
import { db, groceryListsTable, groceryItemsTable, mealsTable, mealPlansTable, recipesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateGroceryListBody,
  GetGroceryListParams,
  ToggleGroceryItemParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

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

router.post("/grocery-lists/generate-from-plan", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const requestedPlanId: number | undefined = typeof req.body?.mealPlanId === "number" ? req.body.mealPlanId : undefined;
  const customName: string | undefined = typeof req.body?.listName === "string" ? req.body.listName.trim() : undefined;

  // Resolve meal plan
  let planId: number;
  if (requestedPlanId) {
    const [plan] = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.id, requestedPlanId), eq(mealPlansTable.userId, userId)));
    if (!plan) {
      res.status(404).json({ error: "Meal plan not found" });
      return;
    }
    planId = plan.id;
  } else {
    // Find current week's plan
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    const weekStart = monday.toISOString().split("T")[0];

    const plans = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.weekStart, weekStart)));

    let plan = plans[0];
    if (!plan) {
      // Fall back to most recent plan
      const allPlans = await db
        .select()
        .from(mealPlansTable)
        .where(eq(mealPlansTable.userId, userId))
        .orderBy(mealPlansTable.weekStart);
      plan = allPlans[allPlans.length - 1];
    }

    if (!plan) {
      res.status(400).json({ error: "No meal plan found. Create a meal plan first!" });
      return;
    }
    planId = plan.id;
  }

  // Gather all meals and their recipes
  const meals = await db.select().from(mealsTable).where(eq(mealsTable.mealPlanId, planId));
  const recipeIds = [...new Set(meals.map((m) => m.recipeId).filter(Boolean) as number[])];

  if (recipeIds.length === 0) {
    res.status(400).json({ error: "Your meal plan has no meals with recipes. Add recipes to your plan first!" });
    return;
  }

  const ingredientsByRecipe: { recipeName: string; ingredients: string[] }[] = [];
  for (const recipeId of recipeIds) {
    const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, recipeId));
    if (recipe) {
      ingredientsByRecipe.push({ recipeName: recipe.name, ingredients: recipe.ingredients });
    }
  }

  // Flatten all ingredients
  const allIngredients = ingredientsByRecipe.flatMap(({ ingredients }) => ingredients);

  if (allIngredients.length === 0) {
    res.status(400).json({ error: "No ingredients found in your planned recipes." });
    return;
  }

  const ingredientText = allIngredients.map((i) => `- ${i}`).join("\n");

  const systemPrompt = `You are a grocery shopping assistant. Consolidate a list of recipe ingredients into a clean shopping list.
Return ONLY valid JSON with no markdown, no code fences, no comments.
The JSON must have this exact shape:
{ "items": [ { "name": "ingredient name", "quantity": "amount or null" }, ... ] }

Rules:
- Merge duplicates and combine quantities (e.g. "2 cups flour" + "1 cup flour" → name: "flour", quantity: "3 cups").
- Separate name from quantity: name should be the ingredient only (e.g. "chicken breast"), quantity is the amount (e.g. "2 lbs").
- If an ingredient has no clear quantity, set quantity to null.
- Keep names short, clear, and lowercase (e.g. "olive oil", "garlic cloves", "cherry tomatoes").
- Group similar items (e.g. "butter, unsalted" and "salted butter" → "butter").
- Aim for 5–40 items total — condense where reasonable.
- Do NOT include cooking equipment, methods, or non-food items.`;

  const userPrompt = `Consolidate these recipe ingredients into a shopping list:\n\n${ingredientText}`;

  let aiItems: { name: string; quantity: string | null }[];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.items)) {
      throw new Error("Invalid AI response shape");
    }

    aiItems = parsed.items
      .filter((i: unknown) => i && typeof i === "object" && typeof (i as Record<string, unknown>).name === "string")
      .map((i: Record<string, unknown>) => ({
        name: String(i.name).toLowerCase().trim(),
        quantity: typeof i.quantity === "string" && i.quantity.trim() ? i.quantity.trim() : null,
      }));
  } catch (err) {
    req.log.error({ err }, "AI grocery list generation failed");
    res.status(500).json({ error: "AI generation failed. Please try again." });
    return;
  }

  if (aiItems.length === 0) {
    res.status(400).json({ error: "Could not extract any items from the meal plan." });
    return;
  }

  const listName = customName || `Grocery List – Week of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const [list] = await db
    .insert(groceryListsTable)
    .values({ name: listName, userId, mealPlanId: planId })
    .returning();

  await db.insert(groceryItemsTable).values(
    aiItems.map((item) => ({
      groceryListId: list.id,
      name: item.name,
      quantity: item.quantity,
      isChecked: false,
    }))
  );

  const result = await getListWithItems(list.id);
  res.status(201).json(result);
});

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
