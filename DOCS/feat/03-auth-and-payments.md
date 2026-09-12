User must be authenticated in order to access features like api spend and E2E
encryption email sending.

- Add Clerk and clerk billing, pro plan id is "varstash_pro"
- Paywall on api spend feature, render a `<PayWall />` component to block free
  user access, explain API spend feature, and render clerk pricing table
  component on it.

1. Refer to @DOCS/lib/clerk_react_setup.md for clerk setup, I already put
   VITE_CLERK_PUBLISHABLE_KEY in the `frontend/.env`
2. Refer to frontend/src/lib/config/env.ts and frontend/src/lib/config/config.ts
   for accessing the config and env vars and the pro plan id

# Clerk Billing for B2C SaaS

> Billing regularly introduces new features and UI changes to Clerk's
> components. If you'd like to remain on a specific version of Clerk's
> components or SDK, you can follow the steps in the
> [pinning](https://clerk.com/docs/pinning.md) documentation.

Clerk Billing for B2C SaaS allows you to create Plans and manage Subscriptions
**for individual users** in your application. If you'd like to charge companies
or organizations, see
[Billing for B2B SaaS](https://clerk.com/docs/react/guides/billing/for-b2b.md).
You can also combine both B2C and B2B Billing in the same application.

**For AI agents:** Run `npx clerk@latest enable billing --for users` to enable
Billing for users instead of navigating to the Billing Settings page in the
Dashboard. Install [Clerk's skills](https://clerk.com/docs/guides/ai/skills.md)
with `npx skills add clerk/skills` for correct CLI and SDK usage.

## Enable Billing

To enable Billing for your application, navigate to the
[**Billing Settings**](https://dashboard.clerk.com/~/billing/settings) page in
the Clerk Dashboard. This page will guide you through enabling Billing for your
application.

Clerk Billing costs the same as using Stripe Billing directly, just 0.7% per
transaction, plus transaction fees which are paid directly to Stripe. Clerk
Billing is **not** the same as Stripe Billing. Plans and pricing are managed
directly through the Clerk Dashboard and won't sync with your existing Stripe
products or plans. Clerk uses Stripe **only** for payment processing, so you
don't need to set up Stripe Billing.

### Payment gateway

Once you have enabled Billing, you will see the following **Payment gateway**
options for collecting payments via Stripe:

- **Clerk development gateway**: A shared **test** Stripe account used for
  development instances. This allows developers to test and build Billing flows
  **in development** without needing to create and configure a Stripe account.
- **Stripe account**: Use your own Stripe account for production. **A Stripe
  account created for a development instance cannot be used for production**.
  You will need to create a separate Stripe account for your production
  environment.

## Create a Plan

Subscription Plans are what your users subscribe to. There is no limit to the
number of Plans you can create.

To create a Plan, navigate to the
[**Subscription plans**](https://dashboard.clerk.com/~/billing/plans) page in
the Clerk Dashboard. Here, you can create, edit, and delete Plans. To setup B2C
Billing, select the **Plans for Users** tab and select **Add Plan**. When
creating a Plan, you can also create Features for the Plan; see the next section
for more information.

> What is the **Publicly available** option?
>
> ---
>
> Plans appear in some Clerk components depending on what kind of Plan it is.
> All Plans can appear in the `<PricingTable />` component. If it's a user Plan,
> it can appear in the `<UserProfile />` component. When creating or editing a
> Plan, if you'd like to hide it from appearing in Clerk components, you can
> toggle the **Publicly available** option off.

## Add Features to a Plan

[Features](https://clerk.com/docs/guides/secure/features.md) make it easy to
give entitlements to your Plans. You can add any number of Features to a Plan.

You can add a Feature to a Plan when you are creating a Plan. To add it after a
Plan is created:

1. Navigate to the
   [**Subscription plans**](https://dashboard.clerk.com/~/billing/plans) page in
   the Clerk Dashboard.
2. Select the Plan you'd like to add a Feature to.
3. In the **Features** section, select **Add Feature**.

> What is the **Publicly available** option?
>
> ---
>
> Plans appear in some Clerk components depending on what kind of Plan it is.
> All Plans can appear in the `<PricingTable />` component. If it's a user Plan,
> it can appear in the `<UserProfile />` component. When adding a Feature to a
> Plan, it will also automatically appear in the corresponding Plan. When
> creating or editing a Feature, if you'd like to hide it from appearing in
> Clerk components, you can toggle the **Publicly available** option off.

## Create a pricing page

You can create a pricing page by using the
[<PricingTable />](https://clerk.com/docs/react/reference/components/billing/pricing-table.md)
component. This component displays a table of Plans and Features that users can
subscribe to. **It's recommended to create a dedicated page**, as shown in the
following example.

filename: src/screens/pricing.tsx

```tsx
import { PricingTable } from "@clerk/react";

export default function PricingScreen() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 1rem" }}>
      <PricingTable />
    </div>
  );
}
```

## Control access with Features and Plans

You can use Clerk's Features and Plans to gate access to the content. There are
a few ways to do this, but the recommended approach is to either use the
[`has()`](https://clerk.com/docs/reference/backend/types/auth-object.md#has)
method or the
[<Show>](https://clerk.com/docs/react/reference/components/control/show.md)
component.

### Example: Using `has()`

Use the `has()` method to test if the user has access to a **Plan**:

```jsx
const hasPremiumAccess = has({ plan: "gold" });
```

Or a **Feature**:

```jsx
const hasPremiumAccess = has({ feature: "widgets" });
```

The [`has()`](https://clerk.com/docs/reference/backend/types/auth-object.md#has)
method is a server-side helper that checks if the Organization has been granted
a specific type of access control (Role, Permission, Feature, or Plan) and
returns a boolean value. `has()` is available on the
[`auth` object](https://clerk.com/docs/reference/backend/types/auth-object.md),
which you will access differently
[depending on the framework you are using](https://clerk.com/docs/reference/backend/types/auth-object.md#how-to-access-the-auth-object).

**Plan**

The following example demonstrates how to use `has()` to check if a user has a
Plan.

filename: src/pages/bronze-content.tsx

```tsx
import { useAuth } from "@clerk/react";

export default function BronzeContentPage() {
  const { has, isLoaded } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;

  const hasBronzePlan = has({ plan: "bronze" });

  if (!hasBronzePlan) {
    return (
      <h1>Only subscribers to the Bronze plan can access this content.</h1>
    );
  }

  return <h1>For Bronze subscribers only</h1>;
}
```

**Feature**

The following example demonstrates how to use `has()` to check if a user has a
Feature.

filename: src/pages/premium-content.tsx

```tsx
import { useAuth } from "@clerk/react";

export default function PremiumContentPage() {
  const { isLoaded, has } = useAuth();

  if (!isLoaded) return <div>Loading...</div>;

  const hasPremiumAccess = has({ feature: "premium_access" });

  if (!hasPremiumAccess) {
    return (
      <h1>
        Only subscribers with the Premium Access feature can access this
        content.
      </h1>
    );
  }

  return <h1>Our Exclusive Content</h1>;
}
```

### Example: Using `<Show>`

The [<Show>](https://clerk.com/docs/react/reference/components/control/show.md)
component can be used to protect content or even entire routes by checking if
the user has been granted a specific type of access control (Role, Permission,
Feature, or Plan). You can pass a `fallback` prop to `<Show>` that will be
rendered if the user does not have the access control.

**Plan**

The following example demonstrates how to use `<Show>` to protect a page by
checking if the user has a Plan.

filename: src/pages/protected-content.tsx

```tsx
import { Show } from "@clerk/react";

export default function ProtectedContentPage() {
  return (
    <Show
      when={{ plan: "bronze" }}
      fallback={
        <p>Only subscribers to the Bronze plan can access this content.</p>
      }
    >
      <h1>Exclusive Bronze Content</h1>
      <p>This content is only visible to Bronze subscribers.</p>
    </Show>
  );
}
```

**Feature**

The following example demonstrates how to use `<Show>` to protect a page by
checking if the user has a Feature.

filename: src/pages/protected-premium-content.tsx

```tsx
import { Show } from "@clerk/react";

export default function ProtectedPremiumContentPage() {
  return (
    <Show
      when={{ feature: "premium_access" }}
      fallback="Only subscribers with the Premium Access feature can access this content."
    >
      <h1>Exclusive Premium Content</h1>
      <p>This content is only visible to users with Premium Access feature.</p>
    </Show>
  );
}
```
