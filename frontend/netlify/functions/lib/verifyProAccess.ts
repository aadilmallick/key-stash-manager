import { createClerkClient } from "@clerk/backend";
import { config } from "../../../src/lib/config/config";

export interface ProAccessResult {
  ok: boolean;
  status: number;
  error?: string;
}

// Server-side counterpart to PayWall.tsx's client-side has({plan}) check -
// closes the gap where anyone could call /api/proxy-spend directly and
// bypass the UI-only paywall. Netlify-only: server.js's self-hosted Express
// path has no Clerk wiring and isn't a multi-tenant concern, so it isn't
// guarded here.
export async function verifyProAccess(req: Request): Promise<ProAccessResult> {
  // Only enforced for real deployed traffic - process.env.CONTEXT is always
  // "dev" under `netlify dev` (and "deploy-preview"/"branch-deploy" for
  // those contexts), so local testing stays exactly as frictionless as
  // today. This is the server-side analog of VITE_IS_TESTING's dev bypass.
  if (process.env.CONTEXT !== "production") {
    return { ok: true, status: 200 };
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!secretKey || !publishableKey) {
    return {
      ok: false,
      status: 500,
      error: "Server auth is not configured (missing Clerk keys).",
    };
  }

  const clerkClient = createClerkClient({ secretKey, publishableKey });
  const requestState = await clerkClient.authenticateRequest(req, {
    authorizedParties: [process.env.URL, process.env.DEPLOY_PRIME_URL].filter(
      (v): v is string => !!v,
    ),
  });

  if (!requestState.isAuthenticated) {
    return {
      ok: false,
      status: 401,
      error: "Sign in with a Pro account to use API Spend.",
    };
  }

  const auth = requestState.toAuth();
  if (!auth.has({ plan: config.payments.varstashProPlanKey })) {
    return { ok: false, status: 403, error: "API Spend is a Pro feature." };
  }

  return { ok: true, status: 200 };
}
