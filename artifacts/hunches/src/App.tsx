import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";

import Home from "@/pages/home";
import HunchDetail from "@/pages/hunch-detail";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Responsible from "@/pages/responsible";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/backstage/login";
import AdminDashboard from "@/pages/backstage/dashboard";
import AdminHunches from "@/pages/backstage/hunches";
import HunchForm from "@/pages/backstage/hunch-form";
import AdminCategories from "@/pages/backstage/categories";
import AdminUsers from "@/pages/backstage/users";
import AdminTicketCodes from "@/pages/backstage/ticket-codes";
import Account from "@/pages/account";
import Tickets from "@/pages/tickets";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/hunch/:slug" component={HunchDetail} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/responsible" component={Responsible} />
      <Route path="/account" component={Account} />
      <Route path="/tickets" component={Tickets} />
      <Route path="/backstage/login" component={AdminLogin} />
      <Route path="/backstage/dashboard" component={AdminDashboard} />
      <Route path="/backstage/hunches" component={AdminHunches} />
      <Route path="/backstage/hunches/new" component={HunchForm} />
      <Route path="/backstage/hunches/:id/edit" component={HunchForm} />
      <Route path="/backstage/categories" component={AdminCategories} />
      <Route path="/backstage/users" component={AdminUsers} />
      <Route path="/backstage/ticket-codes" component={AdminTicketCodes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
