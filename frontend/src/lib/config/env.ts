export function verifyEnv(name: string): string {
    const value = import.meta.env[name];
    if (!value) {
        throw new Error(
            `Environment variable ${name} is required but not set.`,
        );
    }
    return value;
}

export function inProduction(): boolean {
    return import.meta.env.MODE === "production";
}

export const env = {
    VITE_CLERK_PUBLISHABLE_KEY: () => {
        return verifyEnv("VITE_CLERK_PUBLISHABLE_KEY");
    },
    VITE_USING_SERVER: () => {
        return import.meta.env.VITE_USING_SERVER === "true";
    },
    // Single source of truth for the local/e2e auth-and-billing bypass. When
    // true, App.tsx never mounts ClerkProvider and every Clerk-gated
    // component (AuthControls, PayWall) short-circuits instead of calling
    // Clerk hooks/components, so the app runs with no Clerk network
    // dependency and every plan-gated feature is unlocked. Set it per-run
    // (`VITE_IS_TESTING=true npm run dev` / `... npm run test:e2e`) rather
    // than baking it into `.env`, so real auth/billing stays the default.
    VITE_IS_TESTING: () => {
        return import.meta.env.VITE_IS_TESTING === "true";
    },
};
