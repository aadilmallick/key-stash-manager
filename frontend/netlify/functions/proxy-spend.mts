import type { Config } from "@netlify/functions";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import spendProxyModule from "./_shared/spendProxy.cjs";
import { verifyProAccess } from "./lib/verifyProAccess";

const { handleSpendProxyRequest } = spendProxyModule;

// Thin wrapper: all provider allowlisting, request validation, and upstream
// fetch logic lives in _shared/spendProxy.cjs so it's identical between
// this Netlify Function and the Express route in server.js (Docker/local).
// The Clerk sign-in + Pro-plan check below is Netlify-only (see
// lib/verifyProAccess.ts) - server.js's self-hosted path has no Clerk
// wiring and isn't guarded.
export default async (req: Request) => {
  const access = await verifyProAccess(req);
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => null);
  const { status, body: responseBody } = await handleSpendProxyRequest(body);
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

// No custom `path` here - setting one would make the function reachable
// ONLY at that path, not at its default /.netlify/functions/proxy-spend
// URL, which is what the netlify.toml `/api/*` redirect targets below.
export const config: Config = {
  method: ["POST"],
};
