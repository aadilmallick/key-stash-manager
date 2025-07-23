import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// if running locally, we don't want to use the pwa plugin
// if published, we want to use the pwa plugin
const isUsingServer = process.env.USING_SERVER === "true";

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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), isUsingServer ? null : pwaPlugin],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
