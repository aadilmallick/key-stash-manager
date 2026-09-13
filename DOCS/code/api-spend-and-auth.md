# API Spend & Auth/Billing

This is the deeper narrative behind two features that don't fit neatly
into `DOCS/CODEBASE.md`'s data-layer framing: the API Spend tracker (a
client feature that needs a server-side proxy) and Clerk auth/billing
(which gates it). Read `DOCS/CODEBASE.md` first for the data model and
general architecture — this doc assumes that context.

## Why API Spend needs a proxy at all

KeyStash already holds the user's OpenAI/OpenRouter API keys locally —
the whole point of the app. So instead of a backend that stores or
proxies *secrets* long-term, the browser sends the key straight through
to a same-origin `/api/proxy-spend` endpoint for a single request, and
the server-side proxy uses it to call the provider's billing endpoint on
the browser's behalf. The only reason a server is involved at all is that
browsers can't call `api.openai.com` or `openrouter.ai` directly: those
endpoints don't send permissive CORS headers, so a same-origin `fetch()`
straight from the app would be blocked regardless of the key being valid.
The proxy's only job is to relay that one request server-side and hand
back the response — it never stores or logs anything.

## One proxy implementation, two runtimes

The actual proxy logic lives in exactly one file:
`frontend/netlify/functions/_shared/spendProxy.cjs`. Both deployment
targets call into it unmodified:

- **Netlify Function** (`frontend/netlify/functions/proxy-spend.mts`) — a
  ~10-line wrapper: `import spendProxyModule from "./_shared/spendProxy.cjs"`
  (default import + destructure, since esbuild's CJS→ESM interop for
  `.cjs` files isn't guaranteed to expose named exports), read the
  request body, call `handleSpendProxyRequest`, return the result as a
  `Response`.
- **Express** (`server.js`) — `const { handleSpendProxyRequest } =
  require("./frontend/netlify/functions/_shared/spendProxy.cjs")`, then a
  plain `app.post("/api/proxy-spend", ...)` route that does the same
  three lines.

**Why `.cjs` specifically**: the repo root `package.json` is `"type":
"commonjs"` and `frontend/package.json` is `"type": "module"`. Node
resolves module format from the file extension for `.cjs`/`.mjs`
regardless of the nearest `package.json`, which is what lets one file
load cleanly from either caller's module resolution. The shared file is
also deliberately dependency-free (no Zod, even though both the root and
`frontend/` have it — they're on different major versions, and this file
needs to load correctly from either).

**What actually closes the SSRF risk**: `spendProxy.cjs`'s
`PROVIDER_CONFIGS` map hardcodes the two upstream URLs and how to build
each provider's request. The client-supplied request body carries a
`provider` enum value and the API key/params — **never** a URL or path.
A naive "pass-through proxy" (relay whatever URL the client asks for)
would be an open proxy; this one can only ever reach
`api.openai.com`/`openrouter.ai`, full stop.

**Response contract** (`{ status, body }`, mapped straight to an HTTP
response by both callers): `200 { provider, raw }` (verbatim upstream
JSON; parsing into the app's `SpendSnapshot` type stays client-side via
the adapter — see below), `400 { error }` (bad request, no outbound fetch
attempted), `502 { error, status, body }` (upstream reachable but
non-2xx, e.g. a bad key → 401; relaying the upstream's own error body is
safe since it never contains the caller's key), `500 { error }`
(network/timeout — a 10s `AbortController` timeout is set on the
outbound fetch). **Zero logging of the API key, headers, or response
bodies anywhere in this file** — that's the one hard rule for any change
here.

## The provider adapter abstraction

`frontend/src/lib/spend/`:

- `types.ts` — `ProviderAdapter` interface: `id`, `label`, `keyLabel`,
  `keyPlaceholder`, `setupSteps` (onboarding copy + links shown in
  `AddSpendProviderModal`), `buildProxyParams()` (provider-specific query
  params, or `undefined`), `parseSnapshot(raw): SpendSnapshot`.
  `SpendSnapshot` carries a `periodLabel` because the two providers report
  fundamentally different things: OpenRouter's `usage` is **lifetime**
  spend on that key; OpenAI's cost endpoint is **this calendar month**
  (UTC). Conflating them in the UI would silently show the wrong number's
  meaning, not just the wrong number.
- `openaiAdapter.ts` — sums `results[].amount.value` across the paginated
  bucket response; `limitUsd`/`remainingUsd` are always `null` (OpenAI's
  cost API has no cap/limit concept — any "budget" the user sees is a
  value they typed in locally, never fetched); `buildProxyParams()`
  computes `startTime`/`endTime` for the current UTC month.
- `openrouterAdapter.ts` — maps `data.usage`/`limit`/`limit_remaining`
  directly; `buildProxyParams()` returns `undefined` (no params needed).
- `registry.ts` — `PROVIDER_ADAPTERS` + `listProviderAdapters()`/
  `getProviderAdapter(id)`. Adding a third provider is a new adapter file
  + one registry entry, not a rewrite.
- `proxyClient.ts` — `fetchProviderSpend(adapter, apiKey)` POSTs to the
  fixed relative path `/api/proxy-spend`. No `isUsingServer`-style
  branching: Netlify resolves the path via the redirect in `netlify.toml`,
  Express via the route in `server.js`, and plain `vite dev` (no proxy
  at all) simply 404s — caught into a `SpendProxyError` rather than
  thrown uncaught, which is what makes graceful degradation in plain
  `vite dev` work (see below).

## Three deployment modes, one behavior contract

1. **Plain `npm run dev --prefix frontend`** — no proxy route exists at
   all. Every refresh gets a `SpendProxyError` from the failed fetch,
   which lands in the row's `lastError` exactly like a real 502 would.
   The Secrets tab and its hooks import nothing from `lib/spend/`, so
   there's zero blast radius here by construction.
2. **`netlify dev`** (needs `netlify.toml`, which is why it exists at
   repo root) — unifies the Vite dev server and the Netlify Function on
   one local origin, so `/api/proxy-spend` actually resolves. The `[dev]`
   block's `command` is explicit (`npm run dev --prefix frontend`, not
   bare `npm run dev`) because `[dev].command` always runs from the repo
   root regardless of `[build].base` — a bare `npm run dev` would resolve
   to the *root* `package.json`'s Docker/Express script instead of the
   frontend's Vite server, and `netlify dev` would hang forever waiting
   for port 5173.
3. **Docker/Express** (`npm run dev` at repo root, or `docker compose
   up`) — hits the built app, exercises `/api/proxy-spend` via
   `server.js`'s route, same shared `.cjs` logic.

`netlify.toml`'s redirect **order matters**: `/api/* → /.netlify/
functions/:splat` must come before the SPA catch-all (`/* → /index.html`),
or the catch-all would swallow `/api/proxy-spend` and every proxy call
would just get the HTML shell back instead of a real response.

## Auth & billing (Clerk)

Confirmed scope: **feature-gated, not app-wide**. Secrets, folders,
search, export, and drag-and-drop all work with zero account — matching
the local-first design — only the API Spend tab requires sign-in + the
Pro plan.

- `App.tsx` mounts `<ClerkProvider publishableKey={env.
  VITE_CLERK_PUBLISHABLE_KEY()}>` around the app (unless `VITE_IS_TESTING`
  is set — see below).
- `AuthControls.tsx` (header) — `Show when="signed-out"` renders
  `SignInButton`/`SignUpButton` (`mode="modal"`, no dedicated `/sign-in`
  route needed); `Show when="signed-in"` renders `UserButton`. This is
  the newer Clerk React API — `@clerk/react` doesn't export `SignedIn`/
  `SignedOut`; `<Show>` replaces them.
- `PayWall.tsx` wraps `<SpendTab/>`. It checks `useAuth().has({ plan:
  config.payments.varstashProPlanKey })` directly, rather than branching
  UI on `isSignedIn` first — a signed-out user and a signed-in-but-free
  user both get `has() === false`, so both see the same explanation +
  Clerk `<PricingTable/>`, with just an extra "you'll need a free account
  first" nudge shown only when signed out.
- **The Pro plan slug is `varstash_pro`** (`config.payments.
  varstashProPlanKey` in `frontend/src/lib/config/config.ts`) —
  a leftover name from an earlier project rename, confirmed against the
  live Clerk dashboard (the `<PricingTable/>` genuinely renders a plan
  labeled "VarStash pro" at $3.49/mo). Don't rename this to match the
  app's current name without first confirming the actual plan slug in
  the Clerk dashboard — the two names have already diverged once.

## `VITE_IS_TESTING`: the auth/billing bypass

Set per-run (`VITE_IS_TESTING=true npm run dev` / `... npm run test:e2e`),
deliberately not written into `.env`, so real auth/billing stays the
default everywhere else. When set:

- `App.tsx` never mounts `ClerkProvider` at all — not just a bypassed
  check further down. `AppShell` (the actual app tree) is extracted so
  this is a one-line conditional wrap, not duplicated JSX.
- `AuthControls.tsx` returns `null` immediately, before touching any
  Clerk component (`<Show>`/`SignInButton`/etc. all require a mounted
  `ClerkProvider` ancestor or they throw).
- `PayWall.tsx` returns its children immediately, before calling
  `useAuth()` at all.

The `PayWall.tsx` early return is a genuinely conditional hook call
(`useAuth()` is skipped entirely in testing mode) — marked with an
`eslint-disable-next-line react-hooks/rules-of-hooks` and a comment
explaining why it's safe: `VITE_IS_TESTING` is read once from
`import.meta.env` and is fixed for the entire lifetime of a running app
instance, so the branch is always taken the same way across every render
of a given `PayWall` — it never actually violates the invariant the lint
rule exists to protect, it just can't prove that statically.

**Why go this far instead of just short-circuiting the `has()` check**:
the point isn't only "let me see the Pro UI without paying" — it's
removing the real network dependency on Clerk's CDN entirely. Every test
that never touches auth was still paying for `ClerkProvider`'s script
load, and under Playwright's default 5-way parallel workers this was
enough to occasionally starve an unrelated, timing-sensitive test (see
`DOCS/CODEBASE.md`'s Testing section). `VITE_IS_TESTING=true` fixed that
symptom empirically, not just the auth-bypass use case it was built for.

**Test-suite implication**: `api-spend-tab.spec.ts` (asserts the real
paywall renders for a signed-out visitor) and `testing-mode-bypass.spec.ts`
(asserts the real tab renders instead) are two halves of the same
behavior and can't both be meaningfully true in the same run — each one
`test.skip()`s itself under the wrong condition, so running the suite
either with or without the flag is always internally consistent, never a
false failure.
