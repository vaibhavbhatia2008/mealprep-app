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
