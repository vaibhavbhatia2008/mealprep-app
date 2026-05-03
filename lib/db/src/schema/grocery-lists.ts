import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { mealPlansTable } from "./meal-plans";

export const groceryListsTable = pgTable("grocery_lists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mealPlanId: integer("meal_plan_id").references(() => mealPlansTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groceryItemsTable = pgTable("grocery_items", {
  id: serial("id").primaryKey(),
  groceryListId: integer("grocery_list_id").notNull().references(() => groceryListsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity"),
  isChecked: boolean("is_checked").notNull().default(false),
});

export const insertGroceryListSchema = createInsertSchema(groceryListsTable).omit({ id: true, createdAt: true });
export const insertGroceryItemSchema = createInsertSchema(groceryItemsTable).omit({ id: true });
export type InsertGroceryList = z.infer<typeof insertGroceryListSchema>;
export type InsertGroceryItem = z.infer<typeof insertGroceryItemSchema>;
export type GroceryList = typeof groceryListsTable.$inferSelect;
export type GroceryItem = typeof groceryItemsTable.$inferSelect;
