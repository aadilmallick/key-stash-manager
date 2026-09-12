import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import { Button } from "@/components/ui/button";

// Optional, feature-gated auth: signing in isn't required to use the
// Secrets tab or global search, only the Pro-gated API Spend tab (see
// PayWall.tsx). This just gives users a way to create/access an account.
const AuthControls = () => {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="outline" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm">Sign up</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
};

export default AuthControls;
