import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// if running locally, we don't want to use the pwa plugin
// if published, we want to use the pwa plugin
const isUsingServer = process.env.VITE_USING_SERVER === "true";
console.log("isUsingServer", isUsingServer);

const pwaPlugin = VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "Key Stash Manager",
    short_name: "Key Stash",
    description: "Key stash manager, store your secrets in a secure way.",
    theme_color: "#2d73a6",
    background_color: "#ffffff",
    start_url: "/",
    display: "standalone",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  },
  devOptions: {
    enabled: false,
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg}"], // precaches all assets
  },
});

const plugins = [react()];
if (!isUsingServer) {
  plugins.push(pwaPlugin);
}
console.log("plugins", plugins.length);
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_IS_TESTING disables ClerkProvider and unlocks every paid/gated
  // feature (see lib/config/env.ts) - it must only ever be set per-command
  // for local dev/e2e, never baked into a real production build, or every
  // visitor to that build would get auth/billing silently disabled.
  if (mode === "production" && process.env.VITE_IS_TESTING === "true") {
    throw new Error(
      "Refusing to build: VITE_IS_TESTING=true is set for a production build. " +
        "Unset it (it must be passed per-command, not baked into .env) before building for production.",
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      // These construct Web Workers internally via `new URL(..., import.meta.url)`.
      // Vite's dev-mode dependency pre-bundler flattens/hashes packages into
      // node_modules/.vite/deps, which breaks that relative worker URL (it
      // resolves to index.html instead of the worker script, since the
      // pre-bundled path is a virtual asset Vite's dev server doesn't serve as
      // a real worker chunk). Excluding them lets Vite serve the packages
      // directly from node_modules, where the worker URL resolves correctly.
      // Production builds are unaffected (already verified via `npm run build`).
      exclude: ["@journeyapps/wa-sqlite", "@tanstack/browser-db-sqlite-persistence"],
    },
  };
});
