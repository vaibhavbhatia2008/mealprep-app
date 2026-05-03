# PrepSmart — Meal Prep Web App

## Overview

PrepSmart is a full-stack meal prep and planning web app. Users can save recipes, build weekly meal plans, and generate grocery lists from their plans.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS v4 (`artifacts/prepsmart`)
- **API framework**: Express 5 (`artifacts/api-server`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: JWT (bcryptjs + jsonwebtoken), token stored in localStorage as `prepsmart_token`
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from `lib/api-spec/openapi.yaml`)
- **Generated hooks**: `lib/api-client-react`
- **Generated Zod schemas**: `lib/api-zod`

## Features

- **Auth**: Register / Login / Logout with JWT
- **Recipes**: CRUD with ingredients, instructions, prep time, calories, favorites toggle
- **Weekly Planner**: 7-day grid (Mon–Sun) × 4 meal types (breakfast/lunch/dinner/snack), add/delete meals, link to recipes or use custom names
- **Grocery Lists**: Create manually or auto-generate from current meal plan (deduplicates ingredients across recipes)
- **Dashboard**: Today's meals, weekly stats, active grocery list preview, quick actions

## Routes

### API (base path: `/api`)
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT token
- `POST /api/auth/logout` — (stateless, client clears token)
- `GET  /api/auth/me` — current user (auth required)
- `GET/POST /api/recipes` — list/create recipes
- `GET/PATCH/DELETE /api/recipes/:id` — get/update/delete recipe
- `PATCH /api/recipes/:id/favorite` — toggle favorite
- `GET/POST /api/meal-plans` — list/create meal plans
- `GET /api/meal-plans/current` — current week's plan with meals
- `GET/DELETE /api/meal-plans/:id` — get/delete meal plan
- `POST /api/meal-plans/:id/meals` — add meal
- `PATCH/DELETE /api/meal-plans/:id/meals/:mealId` — update/delete meal
- `GET/POST /api/grocery-lists` — list/create grocery lists
- `GET/DELETE /api/grocery-lists/:id` — get/delete list
- `PATCH /api/grocery-lists/:id/items/:itemId/check` — toggle item
- `GET /api/dashboard` — dashboard summary

### Frontend (base path: `/`)
- `/login` — Login page
- `/register` — Register page
- `/` — Dashboard
- `/planner` — Weekly meal planner
- `/recipes` — Recipe list (search + filter by favorites)
- `/recipes/new` — Create recipe
- `/recipes/:id` — Recipe detail
- `/recipes/:id/edit` — Edit recipe
- `/grocery` — Grocery lists

## DB Schema (`lib/db`)

Tables: `users`, `recipes`, `meal_plans`, `meals`, `grocery_lists`, `grocery_items`

## Environment

- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
- `JWT_SECRET` — JWT signing secret (defaults to dev fallback if unset)
- `SESSION_SECRET` — available in secrets

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
