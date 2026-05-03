import { Router, type IRouter } from "express";
import { db, mealPlansTable, mealsTable, recipesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateMealPlanBody,
  GetMealPlanParams,
  AddMealBody,
  AddMealParams,
  UpdateMealBody,
  UpdateMealParams,
  DeleteMealParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

function formatMealPlan(plan: { id: number; userId: number; weekStart: string; createdAt: Date }) {
  return { ...plan, createdAt: plan.createdAt.toISOString() };
}

async function getMealsWithRecipes(mealPlanId: number) {
  const meals = await db
    .select()
    .from(mealsTable)
    .where(eq(mealsTable.mealPlanId, mealPlanId))
    .orderBy(mealsTable.dayOfWeek, mealsTable.mealType);

  const mealsWithRecipes = await Promise.all(
    meals.map(async (meal) => {
      let recipe = null;
      if (meal.recipeId) {
        const [r] = await db.select().from(recipesTable).where(eq(recipesTable.id, meal.recipeId));
        if (r) {
          recipe = {
            ...r,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          };
        }
      }
      return {
        ...meal,
        createdAt: meal.createdAt.toISOString(),
        recipe,
      };
    })
  );
  return mealsWithRecipes;
}

router.get("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  const plans = await db
    .select()
    .from(mealPlansTable)
    .where(eq(mealPlansTable.userId, req.user!.userId))
    .orderBy(mealPlansTable.weekStart);
  res.json(plans.map(formatMealPlan));
});

router.post("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMealPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [plan] = await db
    .insert(mealPlansTable)
    .values({ ...parsed.data, userId: req.user!.userId })
    .returning();
  res.status(201).json(formatMealPlan(plan));
});

router.get("/meal-plans/current", requireAuth, async (req, res): Promise<void> => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const weekStart = monday.toISOString().split("T")[0];

  const plans = await db
    .select()
    .from(mealPlansTable)
    .where(
      and(
        eq(mealPlansTable.userId, req.user!.userId),
        eq(mealPlansTable.weekStart, weekStart)
      )
    );

  let plan = plans[0];
  if (!plan) {
    const allPlans = await db
      .select()
      .from(mealPlansTable)
      .where(eq(mealPlansTable.userId, req.user!.userId))
      .orderBy(mealPlansTable.weekStart);
    plan = allPlans[allPlans.length - 1];
  }

  if (!plan) {
    res.status(404).json({ error: "No meal plan found" });
    return;
  }

  const meals = await getMealsWithRecipes(plan.id);
  res.json({ ...formatMealPlan(plan), meals });
});

router.get("/meal-plans/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [plan] = await db
    .select()
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, id), eq(mealPlansTable.userId, req.user!.userId)));
  if (!plan) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }

  const meals = await getMealsWithRecipes(plan.id);
  res.json({ ...formatMealPlan(plan), meals });
});

router.post("/meal-plans/:id/generate", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [plan] = await db
    .select()
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, id), eq(mealPlansTable.userId, req.user!.userId)));
  if (!plan) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }

  const recipes = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.userId, req.user!.userId));

  if (recipes.length === 0) {
    res.status(400).json({ error: "You need at least one saved recipe to generate a meal plan. Add some recipes first!" });
    return;
  }

  const preferences = typeof req.body?.preferences === "string" ? req.body.preferences.trim() : "";

  const recipeList = recipes
    .map((r) => `- ID ${r.id}: "${r.name}"${r.calories ? ` (${r.calories} cal)` : ""}${r.prepTime ? `, ${r.prepTime} min` : ""}`)
    .join("\n");

  const systemPrompt = `You are a meal planning assistant. Given a list of recipes, create a balanced 7-day meal plan.
Return ONLY valid JSON with no markdown, no code fences, no comments.
The JSON must have this exact shape:
{
  "days": [
    { "dayOfWeek": 0, "breakfast": <recipeId or null>, "lunch": <recipeId or null>, "dinner": <recipeId or null>, "snack": <recipeId or null> },
    ...7 entries for dayOfWeek 0 (Sunday) through 6 (Saturday)
  ]
}
Rules:
- Use only recipe IDs from the list provided.
- dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.
- Vary meals across the week — avoid repeating the same recipe more than twice.
- Snack can be null if no suitable recipe exists.
- Breakfast and lunch can also be null if you only have a few recipes.
- Spread favorites as dinner options when possible.`;

  const userPrompt = `Available recipes:\n${recipeList}\n\n${preferences ? `Preferences: ${preferences}\n\n` : ""}Generate a 7-day meal plan using these recipes.`;

  let aiResult: { days: Array<{ dayOfWeek: number; breakfast: number | null; lunch: number | null; dinner: number | null; snack: number | null }> };

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
    aiResult = JSON.parse(content);

    if (!Array.isArray(aiResult.days) || aiResult.days.length !== 7) {
      throw new Error("Invalid AI response shape");
    }
  } catch (err) {
    req.log.error({ err }, "AI meal plan generation failed");
    res.status(500).json({ error: "AI generation failed. Please try again." });
    return;
  }

  const validRecipeIds = new Set(recipes.map((r) => r.id));

  // Clear existing meals for this plan
  await db.delete(mealsTable).where(eq(mealsTable.mealPlanId, id));

  // Insert AI-suggested meals
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;
  const insertRows: Array<{ mealPlanId: number; recipeId: number | null; dayOfWeek: number; mealType: string; customName: string | null }> = [];

  for (const day of aiResult.days) {
    for (const type of mealTypes) {
      const recipeId = day[type];
      if (recipeId != null && validRecipeIds.has(recipeId)) {
        insertRows.push({ mealPlanId: id, recipeId, dayOfWeek: day.dayOfWeek, mealType: type, customName: null });
      }
    }
  }

  if (insertRows.length > 0) {
    await db.insert(mealsTable).values(insertRows);
  }

  const meals = await getMealsWithRecipes(id);
  res.json({ ...formatMealPlan(plan), meals });
});

router.delete("/meal-plans/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .delete(mealPlansTable)
    .where(and(eq(mealPlansTable.id, id), eq(mealPlansTable.userId, req.user!.userId)));
  res.sendStatus(204);
});

router.post("/meal-plans/:id/meals", requireAuth, async (req, res): Promise<void> => {
  const params = AddMealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db
    .select()
    .from(mealPlansTable)
    .where(and(eq(mealPlansTable.id, params.data.id), eq(mealPlansTable.userId, req.user!.userId)));
  if (!plan) {
    res.status(404).json({ error: "Meal plan not found" });
    return;
  }

  const [meal] = await db
    .insert(mealsTable)
    .values({ ...parsed.data, mealPlanId: params.data.id })
    .returning();
  res.status(201).json({ ...meal, createdAt: meal.createdAt.toISOString() });
});

router.patch("/meal-plans/:id/meals/:mealId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateMealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [meal] = await db
    .update(mealsTable)
    .set(parsed.data)
    .where(and(eq(mealsTable.id, params.data.mealId), eq(mealsTable.mealPlanId, params.data.id)))
    .returning();
  if (!meal) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  res.json({ ...meal, createdAt: meal.createdAt.toISOString() });
});

router.delete("/meal-plans/:id/meals/:mealId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteMealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(mealsTable)
    .where(and(eq(mealsTable.id, params.data.mealId), eq(mealsTable.mealPlanId, params.data.id)));
  res.sendStatus(204);
});

export default router;
