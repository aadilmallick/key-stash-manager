# 🎟️ Module 09: Auth & Monetization (Clerk & Tiered Paywalls)

> **Instructor**: "How do you monetize a local-first application without destroying the privacy and offline benefits of the app? In this module, we will explore feature-gated authentication using Clerk, building in-app paywalls, and designing a bulletproof CI testing bypass."

---

## 🧭 1. Feature-Gated vs. App-Wide Authentication

Most SaaS web applications slap a login barrier on the front door:
```
[ User Lands on App ] ──▶ [ LOGIN REQUIRED! ] ──▶ [ App Content ]
```
If your server is down or the user is offline, the app is completely unusable.

### The KeyStash Philosophy: Feature-Gated Auth
In Key Stash Manager, **the core app requires zero account**:
* Creating secrets, organizing folders, searching with `Ctrl+K`, exporting `.env` files, and reordering items work **100% locally and anonymously**.
* Only premium cloud features—specifically the **API Spend Tracker** that utilizes server relays—are gated behind user accounts and paid subscriptions.

```
[ User Lands on App ] ──▶ [ Secrets Vault (100% Free & Offline) ]
                                      │
               User clicks "API Spend" tab
                                      │
                                      ▼
                      [ Has Pro Subscription? ]
                      ┌───────────────┴───────────────┐
                     YES                              NO
                      │                               │
             [ Render Spend Tab ]           [ Render Clerk Paywall ]
```

---

## 🔑 2. Modern Clerk React Architecture

KeyStash uses `@clerk/react` to manage authentication and user accounts.

### The `<Show>` Component (Modern Clerk API)
Older Clerk tutorials reference `<SignedIn>` and `<SignedOut>`. Modern `@clerk/react` replaces them with the unified `<Show>` component:

```tsx
// frontend/src/components/auth/AuthControls.tsx
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";

export function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      {/* Renders buttons when visitor is anonymous */}
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm">Sign In</Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm">Sign Up</Button>
        </SignUpButton>
      </Show>

      {/* Renders user avatar and account dropdown when signed in */}
      <Show when="signed-in">
        <UserButton afterSignOutUrl="/" />
      </Show>
    </div>
  );
}
```

Notice the `mode="modal"` prop! Users can sign in or sign up without leaving the page or triggering a full browser redirect.

---

## 💰 3. Tiered Monetization with Clerk Billing

In Clerk, monetization is handled via **Clerk Billing**. Plans and products are defined in the Clerk dashboard.

In [frontend/src/components/spend/PayWall.tsx](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/src/components/spend/PayWall.tsx), we protect premium features using the `useAuth().has()` entitlement check:

```tsx
import { useAuth } from "@clerk/react";
import { PricingTable } from "@clerk/react";
import { config } from "@/lib/config/config";

export function PayWall({ children }: { children: React.ReactNode }) {
  const { has, isSignedIn } = useAuth();

  // Check if the current user possesses the "varstash_pro" active plan entitlement
  const isPro = has({ plan: config.payments.varstashProPlanKey });

  // If user is paid Pro, grant immediate access!
  if (isPro) {
    return <>{children}</>;
  }

  // Otherwise, render the Paywall & Pricing Table
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 text-center">
      <h2 className="text-3xl font-bold tracking-tight">
        Unlock Real-Time API Spend Tracking
      </h2>
      <p className="text-muted-foreground mt-2 mb-8">
        Monitor your OpenAI and OpenRouter budgets directly alongside your keys.
      </p>

      {/* Clerk's official, responsive pricing card */}
      <PricingTable />

      {!isSignedIn && (
        <p className="text-sm text-muted-foreground mt-4">
          Already have an account? Sign in above to activate your subscription.
        </p>
      )}
    </div>
  );
}
```

---

## 🧪 4. The `VITE_IS_TESTING` CI Bypass Architecture

Here is an architectural trap that ruins many production codebases:
> *"We added Clerk to our app, and suddenly our Playwright automated tests became super slow and started flaking in CI!"*

### Why External Auth Breaks Automated Tests:
1. **Network Overhead**: Every single test run downloads megabytes of Clerk CDN JavaScript.
2. **Third-Party Rate Limits**: Running 5 parallel Playwright test workers making rapid login requests will trigger bot protection and CAPTCHAs.
3. **Flaky Timing**: If the external auth server takes 2 seconds to respond, timing-sensitive UI tests fail intermittently.

### The KeyStash Solution:
KeyStash provides a **Zero-Network Testing Bypass** controlled by the environment variable `VITE_IS_TESTING=true`.

In [frontend/src/App.tsx](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/src/App.tsx):
```tsx
export default function App() {
  // When testing, NEVER MOUNT ClerkProvider at all!
  if (env.VITE_IS_TESTING()) {
    return <AppShell />;
  }

  return (
    <ClerkProvider publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY()}>
      <AppShell />
    </ClerkProvider>
  );
}
```

In [frontend/src/components/spend/PayWall.tsx](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/src/components/spend/PayWall.tsx):
```tsx
export function PayWall({ children }: { children: React.ReactNode }) {
  // 1. In testing mode, return immediately before calling useAuth()!
  if (env.VITE_IS_TESTING()) {
    return <>{children}</>;
  }

  // 2. Normal production auth check
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { has } = useAuth();
  const isPro = has({ plan: config.payments.varstashProPlanKey });
  ...
}
```

### 🤓 Why the Linter Disable is Safe:
The React "Rules of Hooks" specify that hooks must not be called conditionally. Why is this safe in `PayWall`?
Because `VITE_IS_TESTING` is an immutable build-time / runtime environment variable. For the entire lifespan of a running app process, the branch is **100% constant**. It will never flip from true to false between renders!

---

## 🏋️ Bootcamp Lab Exercise 9

### Objective:
Experience the difference between standard and testing modes in Playwright.

1. Inspect `frontend/e2e/api-spend-tab.spec.ts` vs `frontend/e2e/testing-mode-bypass.spec.ts`.
2. Notice how each test gracefully skips itself based on `VITE_IS_TESTING`:
   ```typescript
   test.skip(process.env.VITE_IS_TESTING === "true", "Only runs with real auth enabled");
   ```
3. Run the E2E suite in testing mode:
   ```bash
   cd frontend && VITE_IS_TESTING=true npx playwright test testing-mode-bypass
   ```
4. Question: Why is it better to completely unmount `ClerkProvider` in testing mode rather than just mocking `isSignedIn = true` inside `useAuth()`?  
   *(Answer: Completely unmounting `ClerkProvider` eliminates all external network requests to Clerk CDN scripts, resulting in 10x faster test runs and 0% network flakiness!)*

---

Next up: connecting client and server! Proceed to [Module 10: Full-Stack Sync & Migration Patterns](./10-full-stack-sync-and-migration-patterns.md).
