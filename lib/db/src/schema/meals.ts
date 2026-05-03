import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mealPlansTable } from "./meal-plans";
import { recipesTable } from "./recipes";

export const mealsTable = pgTable("meals", {
  id: serial("id").primaryKey(),
  mealPlanId: integer("meal_plan_id").notNull().references(() => mealPlansTable.id, { onDelete: "cascade" }),
  recipeId: integer("recipe_id").references(() => recipesTable.id, { onDelete: "set null" }),
  dayOfWeek: integer("day_of_week").notNull(),
  mealType: text("meal_type").notNull(),
  customName: text("custom_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMealSchema = createInsertSchema(mealsTable).omit({ id: true, createdAt: true });
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof mealsTable.$inferSelect;
