import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import recipesRouter from "./recipes";
import recipeImportRouter from "./recipe-import";
import mealPlansRouter from "./meal-plans";
import groceryListsRouter from "./grocery-lists";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(recipeImportRouter);
router.use(recipesRouter);
router.use(mealPlansRouter);
router.use(groceryListsRouter);
router.use(dashboardRouter);

export default router;
