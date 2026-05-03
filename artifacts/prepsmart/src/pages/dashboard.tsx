import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Calendar, ShoppingBag, Star, Clock, Plus, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_COLORS: Record<string, string> = {
  breakfast: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  lunch: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  dinner: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  snack: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useGetDashboard({
    query: { queryKey: getGetDashboardQueryKey() },
  });

  const today = new Date();
  const todayName = DAYS[today.getDay()];
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          {greeting}, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">Here's your prep overview for today, {todayName}.</p>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Recipes", value: data?.recipeCount ?? 0, icon: BookOpen, href: "/recipes", color: "text-emerald-600" },
          { label: "Favorites", value: data?.favoriteCount ?? 0, icon: Star, href: "/recipes?favorites=true", color: "text-amber-500" },
          { label: "Meals this week", value: data?.weeklyMealCount ?? 0, icon: Calendar, href: "/planner", color: "text-blue-500" },
          { label: "Grocery items", value: data?.activeGroceryList?.items?.length ?? 0, icon: ShoppingBag, href: "/grocery", color: "text-purple-500" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-border/60 hover:border-primary/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`${stat.color} bg-current/10 p-2 rounded-lg`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-6 w-8 mb-1" />
                  ) : (
                    <div className="text-2xl font-bold">{stat.value}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's Meals */}
        <motion.div variants={item}>
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Today's Meals</CardTitle>
                <CardDescription className="text-xs">{todayName}, {today.toLocaleDateString("en-US", { month: "long", day: "numeric" })}</CardDescription>
              </div>
              <Link href="/planner">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                  View planner <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : !data?.todayMeals?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No meals planned for today</p>
                  <Link href="/planner">
                    <Button variant="outline" size="sm" className="mt-3">
                      <Plus className="h-3 w-3 mr-1" /> Add meals
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.todayMeals.map((meal: any) => (
                    <div key={meal.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs capitalize ${MEAL_COLORS[meal.mealType] ?? ""}`}>
                          {meal.mealType}
                        </Badge>
                        <span className="text-sm font-medium">{meal.recipe?.name ?? meal.customName ?? "Unnamed meal"}</span>
                      </div>
                      {meal.recipe?.prepTime && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {meal.recipe.prepTime}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Grocery List */}
        <motion.div variants={item}>
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active Grocery List</CardTitle>
                <CardDescription className="text-xs">{data?.activeGroceryList?.name ?? "No active list"}</CardDescription>
              </div>
              <Link href="/grocery">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                  View all <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
                </div>
              ) : !data?.activeGroceryList ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No grocery list yet</p>
                  <Link href="/grocery">
                    <Button variant="outline" size="sm" className="mt-3">
                      <Plus className="h-3 w-3 mr-1" /> Create list
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {data.activeGroceryList.items.slice(0, 8).map((item: any) => (
                    <div key={item.id} className={`flex items-center gap-2 p-2 rounded-md text-sm ${item.isChecked ? "opacity-50 line-through" : ""}`}>
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${item.isChecked ? "bg-muted" : "bg-primary"}`} />
                      <span className="truncate">{item.name}</span>
                      {item.quantity && <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{item.quantity}</span>}
                    </div>
                  ))}
                  {data.activeGroceryList.items.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{data.activeGroceryList.items.length - 8} more items
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick links */}
      <motion.div variants={item}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/recipes/new", label: "Add a recipe", icon: BookOpen, desc: "Save a new recipe" },
            { href: "/planner", label: "Plan your week", icon: Calendar, desc: "Set up your meal schedule" },
            { href: "/grocery", label: "Build grocery list", icon: ShoppingBag, desc: "Generate from your plan" },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="hover:shadow-md transition-all cursor-pointer border-border/50 hover:border-primary/40 hover:bg-accent/30 group">
                <CardContent className="p-4 flex items-center gap-3">
                  <action.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-medium text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:translate-x-1 transition-transform" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
