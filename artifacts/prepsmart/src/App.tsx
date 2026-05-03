import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";

import Layout from "@/components/layout";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Planner from "@/pages/planner";
import Recipes from "@/pages/recipes/index";
import NewRecipe from "@/pages/recipes/new";
import EditRecipe from "@/pages/recipes/edit";
import RecipeDetail from "@/pages/recipes/detail";
import Grocery from "@/pages/grocery";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/planner" component={() => <ProtectedRoute component={Planner} />} />
      <Route path="/recipes" component={() => <ProtectedRoute component={Recipes} />} />
      <Route path="/recipes/new" component={() => <ProtectedRoute component={NewRecipe} />} />
      <Route path="/recipes/:id" component={(params) => <ProtectedRoute component={RecipeDetail} id={params.params.id} />} />
      <Route path="/recipes/:id/edit" component={(params) => <ProtectedRoute component={EditRecipe} id={params.params.id} />} />
      <Route path="/grocery" component={() => <ProtectedRoute component={Grocery} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="prepsmart-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;