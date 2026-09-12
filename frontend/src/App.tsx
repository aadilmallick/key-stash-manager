import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DbProvider } from "@/hooks/useDb";
import { ConfirmProvider } from "@/hooks/useConfirm";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ClerkProvider } from "@clerk/react";
import { env } from "@/lib/config/env";

const queryClient = new QueryClient();

if (env.VITE_IS_TESTING()) {
  console.log(
    "VITE_IS_TESTING is on: Clerk is not mounted, auth/billing gates are bypassed.",
  );
}

const AppShell = () => (
  <DbProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConfirmProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </DbProvider>
);

// VITE_IS_TESTING skips ClerkProvider entirely (not just the plan check) so
// local dev/e2e runs never depend on Clerk's network availability or real
// credentials. AuthControls/PayWall mirror this same flag to avoid calling
// any Clerk hook/component when it's on, since none of them work without a
// mounted ClerkProvider ancestor.
const App = () =>
  env.VITE_IS_TESTING() ? (
    <AppShell />
  ) : (
    <ClerkProvider publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY()}>
      <AppShell />
    </ClerkProvider>
  );

export default App;
