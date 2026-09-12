import React from "react";
import { useAuth, Show, SignInButton, PricingTable } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { config } from "@/lib/config/config";

interface PayWallProps {
  children: React.ReactNode;
}

// Gates any children behind the Pro plan. Signed-out and signed-in-but-free
// users see the same explanation + Clerk pricing table (has() is false for
// both), with an extra nudge to sign in first when signed out.
const PayWall = ({ children }: PayWallProps) => {
  const { isLoaded, has } = useAuth();

  if (!isLoaded) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  if (has({ plan: config.payments.varstashProPlanKey })) {
    return <>{children}</>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gray-700" />
            <CardTitle>API Spend is a Pro feature</CardTitle>
          </div>
          <CardDescription>
            Track how much you're spending on OpenAI and OpenRouter directly
            from KeyStash - connect a billing key to see live usage and
            limits alongside the API keys you already manage here.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Upgrade to KeyStash Pro to unlock this tab.
        </CardContent>
      </Card>

      <Show when="signed-out">
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>You'll need a free account before you can subscribe.</span>
            <SignInButton mode="modal">
              <Button size="sm">Sign in</Button>
            </SignInButton>
          </AlertDescription>
        </Alert>
      </Show>

      <PricingTable />
    </div>
  );
};

export default PayWall;
