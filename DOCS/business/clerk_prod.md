# Production Deployment Guide: Clerk Authentication & Clerk Billing

This document provides a comprehensive, step-by-step walkthrough for preparing, configuring, and deploying **Clerk Authentication** and **Clerk Billing (B2C)** for **KeyStash / VarStash** (`varstash.com`).

---

## 1. Executive Summary & Architecture Overview

In development, Clerk runs on shared development infrastructure:
- **Keys**: `pk_test_...` (Frontend) and `sk_test_...` (Backend).
- **Domain**: Hosted on a Clerk-managed dev domain (e.g. `your-app.clerk.accounts.dev`).
- **OAuth**: Uses shared sandbox OAuth credentials for Google, GitHub, etc.
- **Billing**: Uses the **Clerk Development Gateway** (a mock Stripe test sandbox where test cards work automatically).

In **Production**, your app shifts to:
- **Keys**: `pk_live_...` and `sk_live_...`.
- **Domain**: First-party custom domain (`varstash.com` / `clerk.varstash.com` / `accounts.varstash.com`). This ensures auth cookies are set as first-party cookies (preventing cross-origin Safari/Chrome ITP blocking).
- **OAuth**: Dedicated OAuth Client IDs and Secrets registered under your Google Cloud and GitHub developer accounts.
- **Billing**: Connected directly to your registered, live **Stripe** account. All payments process in real USD via Stripe, with Clerk orchestrating plans, entitlements, and checkout UI.

```mermaid
flowchart TD
    subgraph Client ["Frontend (varstash.com)"]
        UI[React UI / PayWall / PricingTable]
        ClerkSDK["@clerk/react (pk_live_...)"]
    end

    subgraph ClerkCloud ["Clerk Production Cloud"]
        FAPI["Frontend API (clerk.varstash.com)"]
        AuthEngine["Auth Engine & Session Store"]
        BillingEngine["Clerk Billing (Plans: varstash_pro)"]
        SvixWebhook["Svix Webhook Delivery"]
    end

    subgraph StripeCloud ["Your Live Stripe Account"]
        StripeConnect["Stripe Payment Gateway"]
        CustomerVault["Credit Card Processing"]
    end

    subgraph BackendGateway ["KeyStash Express Backend / Webhook Receiver"]
        Express["server.js /api/webhooks/clerk"]
        DB[(keys.json / DB State)]
    end

    UI --> ClerkSDK
    ClerkSDK <--> FAPI
    FAPI <--> AuthEngine
    FAPI <--> BillingEngine
    BillingEngine <--> StripeConnect
    StripeConnect --> CustomerVault
    ClerkCloud -- Webhook Events --> Express
    Express --> DB
```

---

## 2. Clerk Authentication Production Setup

### Step 1: Create the Production Instance
1. Go to the [Clerk Dashboard](https://dashboard.clerk.com/).
2. In the top-left instance switcher (currently showing your Development instance, e.g., `app_3JFDwvSQjgZMolcY1d57Z2iSGtl`), click the dropdown and select **"Create production instance"**.
3. Choose **"Clone settings from development"** so your auth settings (email/password, social providers, user settings) copy over automatically.
   > **Note**: For security reasons, Paths, SSO connections, and Integrations do **not** copy over automatically and must be verified.

*(Alternative via CLI)*:
```bash
npx clerk@latest deploy
```

---

### Step 2: Configure Your Custom Domain in Clerk
1. In your Clerk Production instance dashboard, navigate to **Configure > Domains** (or [dashboard.clerk.com/~/domains](https://dashboard.clerk.com/~/domains)).
2. Enter your primary domain: `varstash.com`.
3. Clerk will generate DNS records (CNAME records) for:
   - **Frontend API (FAPI)**: Usually `clerk.varstash.com` pointing to `frontend-api.clerk.services`.
   - **Accounts Portal**: `accounts.varstash.com` pointing to `accounts.clerk.services`.
   - **Mail Delivery (DKIM/SPF)**: 3 CNAME records (e.g. `clk._domainkey.varstash.com`, `clk2._domainkey.varstash.com`, `clkmail.varstash.com`) so that Clerk's verification emails (OTPs, password resets) are sent directly from `@varstash.com` with 100% inbox delivery.
4. Keep this page open while you add these records to Namecheap (detailed in Section 4).
5. Once DNS records are saved in your registrar, return to the Clerk Dashboard and click **"Deploy certificates"**. Clerk will provision automated SSL/TLS certificates via Let's Encrypt / Google Trust Services.

---

### Step 3: Setup Production OAuth Providers (Google & GitHub)
In development, social logins use Clerk's shared credentials. In production, users will see "Clerk Shared App" unless you provide your own OAuth credentials.

#### A. Google OAuth Setup
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `VarStash`.
3. Configure the **OAuth Consent Screen**:
   - User Type: **External**.
   - App Name: `VarStash`.
   - User Support Email: `support@varstash.com`.
   - Authorized Domains: `varstash.com` and `clerk.varstash.com`.
   - Developer Contact Email: your email.
4. Navigate to **Credentials > Create Credentials > OAuth client ID**:
   - Application Type: **Web application**.
   - Name: `VarStash Production`.
   - Authorized JavaScript Origins: `https://varstash.com`, `https://clerk.varstash.com`, `https://accounts.varstash.com`.
   - Authorized Redirect URIs: Enter the exact Redirect URI provided in your Clerk Production Dashboard under **User & Authentication > Social Connections > Google** (format: `https://clerk.varstash.com/v1/oauth_callback` or `https://accounts.varstash.com/v1/oauth_callback`).
5. Copy the **Client ID** and **Client Secret** into the Clerk Google Social Connection settings in your Clerk Dashboard and toggle it on.

#### B. GitHub OAuth Setup
1. Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**:
   - Application Name: `VarStash`.
   - Homepage URL: `https://varstash.com`.
   - Authorization Callback URL: Copy from Clerk Dashboard (**User & Authentication > Social Connections > GitHub**).
3. Generate a **Client Secret**.
4. Paste the Client ID and Client Secret into Clerk and save.

---

### Step 4: Security Hardening & Session Allowlisting

#### A. Configure `authorizedParties` (Prevent CSRF & Subdomain Hijacking)
By default, Clerk's Frontend API accepts requests from any subdomain on your root domain. To prevent cross-subdomain cookie leakage, restrict origins to only your production app URL:

In your frontend / backend middleware:
```typescript
// If verifying JWTs in backend Express:
clerkClient.authenticateRequest(req, {
  authorizedParties: ['https://varstash.com', 'https://www.varstash.com'],
});
```

#### B. Subdomain Allowlist
In Clerk Dashboard: **Configure > Domains > Subdomain allowlist**, add:
- `https://varstash.com`
- `https://www.varstash.com`

#### C. Session Expiration & Inactivity
Under **Configure > Sessions**:
- Lifetime: Set an appropriate session lifetime (e.g., 7 days or 30 days).
- Inactivity timeout: Optional auto-lock (e.g., after 30 minutes of inactivity, user re-authenticates to access encrypted vaults).

---

## 3. Clerk Billing Production Setup (B2C SaaS)

Clerk Billing utilizes Stripe as its underlying payment rails, but **all plans, tiers, prices, and entitlements are defined within Clerk**. You do not create products in Stripe Billing.

### Step 1: Prepare Your Stripe Production Account
> [!IMPORTANT]
> A Stripe account created for a development instance is a sandbox account and **cannot** be used for production. You must connect a verified live Stripe account.

1. Create or log into your [Stripe Dashboard](https://dashboard.stripe.com/).
2. Complete your Stripe business profile:
   - Legal business name / DBA (`VarStash` or your legal entity).
   - Tax ID / EIN (or SSN if sole proprietor).
   - Bank account for payouts.
   - Public business details: Statement descriptor (e.g. `VARSTASH*PRO`), support email (`support@varstash.com`), support website (`https://varstash.com`).
3. Ensure your Stripe account is **Activated** and in **Live Mode**.

---

### Step 2: Connect Stripe to Clerk Production
1. In the Clerk Dashboard for your **Production Instance**, go to **Billing > Settings** (or run `npx clerk@latest enable billing --for users`).
2. Click **Connect Stripe account**.
3. You will be redirected to Stripe's Connect authorization portal.
4. Select your activated live Stripe account and grant Clerk permission.
5. Once returned to Clerk, the status should indicate **Stripe Connected (Live)**.

---

### Step 3: Configure Subscription Plans & Entitlements

In the Clerk Dashboard under **Billing > Subscription plans** (`Plans for Users` tab):

#### 1. Free Tier (`free_user`)
- **Plan Name**: Free
- **Price**: $0
- **Publicly Available**: Enabled
- **Features / Entitlements**:
  - `unlimited_local_secrets`: Unlimited local secrets
  - `visual_canvas`: Visual canvas & profiles
  - `manual_export`: Manual .env export

#### 2. Pro Tier (`varstash_pro`)
- **Plan Name**: Pro (or VarStash Pro)
- **Plan Key / ID**: `varstash_pro` (This **must** match `config.payments.varstashProPlanKey = "varstash_pro"` in [config.ts](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/src/lib/config/config.ts)).
- **Pricing**:
  - Monthly: $5.00 / month (or your target price, e.g. $9/mo)
  - Annual (Optional): Discounted at $48.00 / year ($4/mo)
- **Publicly Available**: Enabled
- **Features / Entitlements**:
  - `api_spend`: Unified API Spend & Limits Dashboard
  - `e2e_sharing`: Cloud Encrypted Handoff & Magic-Link Sharing
  - `hardware_lock`: WebAuthn TouchID / FaceID Vault Lock

---

### Step 4: Verify Frontend Pricing & Access Control Code

In your codebase, ensure the paywall and authorization components match the Clerk production plan ID:

1. **Plan Key Definition** ([frontend/src/lib/config/config.ts](file:///Users/aadilmallick/Documents/aadildev/projects/key-stash-manager/frontend/src/lib/config/config.ts)):
   ```typescript
   export const config = {
       payments: {
           varstashProPlanKey: "varstash_pro",
           freePlanKey: "free_user",
       },
   };
   ```

2. **Paywall Check** (Using Clerk's `has()` helper):
   ```tsx
   import { useAuth } from "@clerk/react";
   import { config } from "@/lib/config/config";

   export function useHasPro() {
       const { has, isLoaded } = useAuth();
       if (!isLoaded) return false;
       return has({ plan: config.payments.varstashProPlanKey });
   }
   ```

3. **Pricing Table Component**:
   The `<PricingTable />` component from `@clerk/react` automatically fetches all publicly available plans from your live Clerk production instance:
   ```tsx
   import { PricingTable } from "@clerk/react";

   export function PricingModal() {
       return (
           <div className="max-w-4xl mx-auto p-6">
               <PricingTable />
           </div>
       );
   }
   ```

4. **Self-Serve Customer Portal**:
   Clerk's `<UserProfile />` component has built-in subscription management tabs where users can view active invoices, update credit cards, upgrade/downgrade, or cancel their subscription.

---

### Step 5: Webhook Setup for Subscription Lifecycle

If your backend (`server.js`) needs to record subscription status (e.g. for backend API access or email delivery entitlements):

1. In Clerk Production Dashboard: Go to **Configure > Webhooks** > **Add Endpoint**.
2. Endpoint URL: `https://varstash.com/api/webhooks/clerk` (or your backend API URL).
3. Subscribe to Billing Events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.active`
   - `subscriptionItem.active`
   - `subscriptionItem.canceled`
   - `subscriptionItem.pastDue`
   - `paymentAttempt.updated`
4. Copy the **Signing Secret** (`whsec_...`) and store it as `CLERK_WEBHOOK_SECRET` in your backend environment variables.
5. In Express, verify payloads using `svix`:
   ```javascript
   import { Webhook } from 'svix';

   app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), (req, res) => {
       const svix_id = req.headers["svix-id"];
       const svix_timestamp = req.headers["svix-timestamp"];
       const svix_signature = req.headers["svix-signature"];

       const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
       let evt;
       try {
           evt = wh.verify(req.body, {
               "svix-id": svix_id,
               "svix-timestamp": svix_timestamp,
               "svix-signature": svix_signature,
           });
       } catch (err) {
           return res.status(400).json({ error: "Webhook verification failed" });
       }

       const { type, data } = evt;
       if (type === 'subscriptionItem.active') {
           // User upgraded to paid plan
           console.log(`User ${data.payer_id} unlocked plan: ${data.plan_id}`);
       } else if (type === 'subscriptionItem.canceled') {
           // Plan canceled
           console.log(`User ${data.payer_id} canceled subscription`);
       }

       res.status(200).json({ received: true });
   });
   ```

---

## 4. Namecheap DNS Setup for Clerk

In your Namecheap Dashboard:
1. Go to **Domain List** > Click **Manage** next to `varstash.com`.
2. Select the **Advanced DNS** tab.
3. In **Host Records**, add the CNAME entries provided by Clerk:

| Type | Host | Value | TTL | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `clerk` | `frontend-api.clerk.services` | Automatic | Clerk Frontend API |
| **CNAME** | `accounts` | `accounts.clerk.services` | Automatic | Clerk Account Portal |
| **CNAME** | `clk` | `mail.clerk.services` (check exact Clerk value) | Automatic | DKIM Key 1 |
| **CNAME** | `clk2` | `mail2.clerk.services` (check exact Clerk value) | Automatic | DKIM Key 2 |
| **CNAME** | `clkmail` | `mail.clerk.services` | Automatic | Return-Path / SPF |

> [!CAUTION]
> **Check for CAA Records**:
> Run `dig varstash.com +short CAA` in your terminal. If CAA records are present, ensure they authorize `letsencrypt.org` and `pki.goog`, or remove restrictive CAA records so Clerk can automatically issue TLS certificates.

---

## 5. Production Environment Variables Checklist

Ensure your production environment (Vercel, Render, Railway, or Docker host) has the live keys:

```bash
# Frontend (.env.production or Hosting Platform Environment Variables)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_USING_SERVER=true
VITE_IS_TESTING=false

# Backend (Express server.js)
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
NODE_ENV=production
PORT=3000
```

> [!WARNING]
> Never commit `pk_live_...` or `sk_live_...` into Git. Use your hosting provider's secrets manager.

---

## 6. Pre-Launch Verification Runbook

Before opening the site to real customers, perform this end-to-end verification:

1. **DNS Verification**:
   - Run `dig CNAME clerk.varstash.com +short` — should resolve to Clerk's proxy.
   - Run `dig CNAME accounts.varstash.com +short` — should resolve to Clerk's accounts proxy.
2. **Auth Verification**:
   - Visit `https://varstash.com`.
   - Click Sign Up with Email (test with a real personal email). Verify the OTP email arrives from `@varstash.com` (not `@clerk.com`).
   - Test Sign In with Google and GitHub. Verify the consent screen displays "VarStash" and the official logo.
3. **Billing $1 Test Verification**:
   - Create a temporary $1 test plan or use a real personal credit card on your $5 `varstash_pro` plan.
   - Go to the API spend tab -> verify Paywall displays `<PricingTable />`.
   - Complete checkout with a real card.
   - Confirm immediate entitlement unlock: The Paywall disappears and the API spend dashboard renders.
   - Confirm Stripe Dashboard receives the payment under **Payments**.
   - Navigate to `<UserProfile />` > Manage Subscription > Cancel Subscription (or refund from Stripe).
   - Confirm webhook receives `subscriptionItem.canceled` or `refund`.

Following this checklist ensures a seamless transition to production without authentication downtime, broken redirects, or billing discrepancies.
