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
};
