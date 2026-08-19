# Add API spend feature

Implementing client-side API spend and limit monitoring in a local-first
application like KeyStash is straightforward because you already hold the API
keys locally in IndexedDB. Instead of sending keys to a backend server, your
browser app directly queries each provider's usage and account APIs on a
scheduled interval or on demand.

Here is an architectural breakdown of how to build client-side spend monitoring,
along with technical hurdles and workarounds.

---

### 1. Client-Side Fetching Architecture

Because KeyStash operates local-first, the client handles the API requests
directly using the stored keys:

1. **Storage & Decryption:** Retrieve the user’s unencrypted API key from
   IndexedDB in the browser memory.
2. **Direct API Poll:** Make a client-side `fetch()` call directly to the
   provider’s usage or billing endpoint.
3. **Cache & Render:** Store the fetched usage metrics (e.g., current month
   spend, remaining credits, rate limit headers) back into IndexedDB to render
   unified progress bars across all providers in your dashboard.

---

### 2. Provider API Implementation Details

Different LLM providers expose usage data through different endpoints:

#### OpenAI

- **Endpoint:** `https://api.openai.com/v1/organization/usage/completions` (or
  billing limits via `https://api.openai.com/v1/dashboard/billing/credit_grants`
  if session/admin keys are used).
- **Headers:** `Authorization: Bearer <OPENAI_API_KEY>`
- **Implementation Note:** OpenAI provides usage data aggregated by date ranges,
  allowing you to calculate daily or monthly consumption directly on the client.

#### Anthropic (Claude)

- **Endpoint:** Anthropic uses workspace/admin keys or reports rate/cost limits
  via response headers on standard requests (e.g.,
  `anthropic-ratelimit-tokens-limit`, `anthropic-ratelimit-tokens-remaining`).
- **Implementation:** For direct cost calculations, you can either poll their
  usage endpoints or track total token usage client-side on API calls to
  calculate estimated spend against current pricing models ($/1k tokens).

#### OpenRouter / Alternative Providers

- **Endpoint:** `https://openrouter.ai/api/v1/auth/key`
- **Headers:** `Authorization: Bearer <OPENROUTER_API_KEY>`
- **Implementation Note:** OpenRouter returns a clean JSON response containing
  `usage` (total USD spent) and `limit` (spending cap set on that specific key)
  in a single request.

---

### 3. Handling the Main Technical Challenge: CORS

The primary obstacle when making direct API calls from a browser application
(`localhost` or a web app domain) to third-party provider endpoints is **CORS
(Cross-Origin Resource Sharing)**. If a provider's API does not set
`Access-Control-Allow-Origin: *` on their billing endpoints, the browser will
block the response.

Here are three ways to solve CORS while keeping data local-first:

#### Option A: Lightweight CORS Proxy (Recommended for Pro Tier)

Deploy a minimal, stateless Cloudflare Worker or Netlify cloud function or
Vercel Edge Function that acts solely as a CORS proxy for billing requests.

- **How it works:** The browser sends the request to your proxy Worker along
  with the target URL. The Worker forwards the request to OpenAI/Anthropic and
  adds the proper CORS headers to the response.
- **Privacy Guarantee:** The proxy is 100% stateless—it never logs, stores, or
  inspects the API keys passing through memory.

#### Option B: Embedded Relay for Docker/Local Users

Since KeyStash offers an open-source Docker version:

- The local Express/Node backend running inside Docker handles the `fetch` calls
  to OpenAI/Anthropic server-side, completely bypassing browser CORS
  restrictions before passing the parsed spend data back to the local React UI.

---

### 4. Implementation Checklist for Pro Feature Integration

1. **Adapter Pattern:** Build a unified TypeScript interface for providers
   (e.g., `ProviderAdapter.getSpend(apiKey: string): Promise<SpendData>`).
2. **Background Sync:** Implement a web worker or scheduled interval that
   refreshes spend metrics every 15–30 minutes to prevent API spam.
3. **Visual Spend Thresholds:** Render visual warning indicators (e.g., yellow
   at 80% limit, red at 95% or revoked key status) right next to the
   corresponding key in your folder view.

### 1. UX Structure: Dedicated Cost Dashboard vs. Fine-Grained Keys

Separating cost analytics into its own dedicated tab/view is the right
architectural move for two major reasons:

1. **Least-Privilege Security:** Fine-grained API keys (e.g., standard project
   keys used in your code) should _never_ have billing or admin permissions.
2. **Provider Key Realities:** Billing endpoints require
   admin/organization-level tokens. Asking users to enter a dedicated
   **Read-Only Billing Key** in a separate "Spend Analytics" or "Integrations"
   tab aligns with standard developer workflows and prevents mixing execution
   keys with monitoring keys.

### 2. Supported Providers for MVP

For your initial release, limit scope to **3 high-value providers** that
non-technical builders and solo AI developers use daily:

| **Provider**   | **Endpoint / Auth Requirement**                                                                                                                                                                        | **Metrics Returned**                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **OpenAI**     | Admin/Service Account Key with `Organization Read` (`[https://api.openai.com/v1/organization/usage/completions](https://api.openai.com/v1/organization/usage/completions)` & `/v1/organization/costs`) | Daily/Monthly USD spend, project breakdowns.                                               |
| **OpenRouter** | Standard API Key (`[https://openrouter.ai/api/v1/auth/key](https://openrouter.ai/api/v1/auth/key)`)                                                                                                    | Direct JSON response with `usage` (total USD spent) and `limit` (credit balance/cap).      |
| **Anthropic**  | Admin API Key (`[https://api.anthropic.com/v1/organizations/usage](https://api.anthropic.com/v1/organizations/usage)` or Workspace Admin)                                                              | Token consumption per model; calculate spend client-side based on Anthropic model pricing. |

#### The Correct Stateless Proxy Architecture

Make the Netlify Function a **100% Stateless Ephemeral Proxy (Passthrough)**
over HTTPS:

```
+------------------+                    +-------------------------+                    +--------------------+
|  Browser Client  | --(HTTPS POST)-->  | Netlify / Edge Function | --(Upstream API)-> |  Provider (OpenAI) |
| (Key in memory)  |   [Bearer Token]   |     (Stateless Proxy)   |                    |                    |
+------------------+                    +-------------------------+                    +--------------------+
        ^                                           |                                             |
        |                                           |                                             |
        +---------(JSON: Usage Metrics Only)--------+<----------------(Raw Billing Response)------+
```

1. **Storage:** The Admin/Billing key is encrypted locally in the browser using
   the user's master key in **IndexedDB**.
2. **In-Flight Protection:** When polling for usage, the client decrypts the key
   in memory and sends it over standard **TLS/HTTPS** directly in the
   `Authorization` header to your Netlify serverless function.
3. **Stateless Forwarding:** The Netlify function acts solely to bypass CORS:

   - It takes the target URL and headers, forwards the request upstream to
     OpenAI/Anthropic/OpenRouter, and strips sensitive response headers.
   - **Zero Persistence:** It does _not_ log, write to disk, or store the
     request payload or API keys anywhere.
4. **Response:** The function returns the billing JSON payload to the browser
   with standard CORS headers (`Access-Control-Allow-Origin: *`).

### 4. Dual-Environment Implementation (SaaS vs. Docker Self-Hosted)

By defining a unified adapter interface, your frontend code remains identical
whether running against your hosted Netlify service or local Docker:

TypeScript

```
// Unified Proxy Client Interface
interface SpendProxyRequest {
  provider: 'openai' | 'anthropic' | 'openrouter';
  endpoint: string;
  adminApiKey: string;
  params?: Record<string, string>;
}

export async function fetchProviderSpend(req: SpendProxyRequest) {
  // Check if running in local Docker self-hosted mode or cloud SaaS
  const baseUrl = process.env.NEXT_PUBLIC_IS_DOCKER 
    ? 'http://localhost:3000/api/proxy-spend' 
    : 'https://api.keystash.app/.netlify/functions/proxy-spend';

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  return await res.json();
}
```

- **Hosted SaaS (Netlify/Vercel Edge):** Routes through the stateless serverless
  function to bypass CORS.
- **Docker Self-Hosted (Node/Express):** Routes through the local containerized
  Express server (`/api/proxy-spend`), which issues the Node `fetch` call
  locally with zero outbound proxy dependencies.

### 5. Step-by-Step UX Flow for the "Spend Analytics" Tab

1. **Route** `/spend`: Display a dedicated card for each provider (OpenAI,
   OpenRouter, Anthropic) with status badges (`Connected`, `Needs Billing Key`,
   `Not Configured`).
2. **Onboarding Modal:** When clicking _Setup OpenAI Spend_:

   - Provide step-by-step instructions: _"Go to platform.openai.com -> Settings
     -> Organization -> Create Read-Only Admin Key."_
   - Input field: Enter Admin Key.
3. **Validation & Sync:**

   - Test the key against `/v1/organization/usage`.
   - If successful, encrypt the billing key into IndexedDB under a dedicated
     `_internal_billing_keys` namespace.
4. **Rendering:** Display monthly cost progress bars, limit caps, and warning
   thresholds (80% / 95% spend) directly on the dashboard.

## Resources

- [https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs)
-

## Metadata

- URL:
  [https://linear.app/2022amallickprojects/issue/AAD-69/add-api-spend-feature](https://linear.app/2022amallickprojects/issue/AAD-69/add-api-spend-feature)
- Identifier: AAD-69
- Status: Backlog
- Priority: No priority
- Assignee: Unassigned
- Project:
  [KeyStash Local](https://linear.app/2022amallickprojects/project/keystash-local-1f2211ffe4c8/overview).
  An improvement on https://keystashmanager.netlify.app/ where everything is
  completely local, but encrypts secrets before sharing them, you can send
  time-based encryption key where anyone you want to share it with has to use
  that key to decrypt the secret.
- Project milestone: MVP
- Created: 2026-08-16T22:22:58.922Z
- Updated: 2026-08-16T22:40:00.661Z
