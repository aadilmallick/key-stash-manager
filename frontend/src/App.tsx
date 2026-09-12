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

const App = () => (
  <ClerkProvider publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY()}>
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
  </ClerkProvider>
);

export default App;
