import { Router, type IRouter } from "express";
import { db, mealPlansTable, mealsTable, recipesTable, groceryListsTable, groceryItemsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const todayDow = dayOfWeek;

  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const weekStart = monday.toISOString().split("T")[0];

  const [recipeCounts] = await db
    .select({ total: count() })
    .from(recipesTable)
    .where(eq(recipesTable.userId, userId));

  const [favoriteCounts] = await db
    .select({ total: count() })
    .from(recipesTable)
    .where(and(eq(recipesTable.userId, userId), eq(recipesTable.isFavorite, true)));

  const allPlans = await db
    .select()
    .from(mealPlansTable)
    .where(eq(mealPlansTable.userId, userId))
    .orderBy(mealPlansTable.weekStart);

  let currentPlan = allPlans.find((p) => p.weekStart === weekStart) ?? allPlans[allPlans.length - 1] ?? null;

  let todayMeals: unknown[] = [];
  let weeklyMealCount = 0;
  let currentPlanWithMeals = null;

  if (currentPlan) {
    const allMeals = await db
      .select()
      .from(mealsTable)
      .where(eq(mealsTable.mealPlanId, currentPlan.id))
      .orderBy(mealsTable.dayOfWeek, mealsTable.mealType);

    weeklyMealCount = allMeals.length;

    const mealsWithRecipes = await Promise.all(
      allMeals.map(async (meal) => {
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
        return { ...meal, createdAt: meal.createdAt.toISOString(), recipe };
      })
    );

    todayMeals = mealsWithRecipes.filter((m) => m.dayOfWeek === todayDow);

    currentPlanWithMeals = {
      ...currentPlan,
      createdAt: currentPlan.createdAt.toISOString(),
      meals: mealsWithRecipes,
    };
  }

  const lists = await db
    .select()
    .from(groceryListsTable)
    .where(eq(groceryListsTable.userId, userId))
    .orderBy(groceryListsTable.createdAt);

  let activeGroceryList = null;
  if (lists.length > 0) {
    const latestList = lists[lists.length - 1];
    const items = await db
      .select()
      .from(groceryItemsTable)
      .where(eq(groceryItemsTable.groceryListId, latestList.id));
    activeGroceryList = {
      ...latestList,
      createdAt: latestList.createdAt.toISOString(),
      items,
    };
  }

  res.json({
    todayMeals,
    currentPlan: currentPlanWithMeals,
    recipeCount: recipeCounts?.total ?? 0,
    favoriteCount: favoriteCounts?.total ?? 0,
    activeGroceryList,
    weeklyMealCount,
  });
});

export default router;
