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
import AdminUserDetail from "@/pages/backstage/user-detail";
import AdminTicketCodes from "@/pages/backstage/ticket-codes";
import AdminHero from "@/pages/backstage/hero";
import AdminNotifications from "@/pages/backstage/notifications";
import AdminAlerts from "@/pages/backstage/admin-alerts";
import AdminMetrics from "@/pages/backstage/metrics";
import Account from "@/pages/account";
import Tickets from "@/pages/tickets";
import TicketActivity from "@/pages/ticket-activity";
import CheckoutSuccess from "@/pages/checkout-success";
import MyHunches from "@/pages/my-hunches";
import Pricing from "@/pages/pricing";

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
      <Route path="/tickets/activity" component={TicketActivity} />
      <Route path="/tickets/success" component={CheckoutSuccess} />
      <Route path="/my-hunches" component={MyHunches} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/backstage/login" component={AdminLogin} />
      <Route path="/backstage/dashboard" component={AdminDashboard} />
      <Route path="/backstage/hunches" component={AdminHunches} />
      <Route path="/backstage/hunches/new" component={HunchForm} />
      <Route path="/backstage/hunches/:id/edit" component={HunchForm} />
      <Route path="/backstage/categories" component={AdminCategories} />
      <Route path="/backstage/users" component={AdminUsers} />
      <Route path="/backstage/users/:id" component={AdminUserDetail} />
      <Route path="/backstage/ticket-codes" component={AdminTicketCodes} />
      <Route path="/backstage/hero" component={AdminHero} />
      <Route path="/backstage/notifications" component={AdminNotifications} />
      <Route path="/backstage/admin-alerts" component={AdminAlerts} />
      <Route path="/backstage/metrics" component={AdminMetrics} />
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
