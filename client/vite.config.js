import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiBaseUrl = env.TASKIN_API_BASE_URL?.trim();

  if (mode === "production") {
    if (!apiBaseUrl) {
      throw new Error(
        "VITE_API_BASE_URL is required for a production deployment",
      );
    }

    const parsedApiUrl = new URL(apiBaseUrl);
    if (parsedApiUrl.protocol !== "https:") {
      throw new Error("VITE_API_BASE_URL must use HTTPS in production");
    }
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["icon.svg"],
        manifest: {
          name: "Khorocha — Personal Finance",
          short_name: "Khorocha",
          description: "Plan. Track. Save.",
          theme_color: "#07111f",
          background_color: "#07111f",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: { navigateFallback: "/index.html" },
      }),
    ],
    server: { port: 5173 },
  };
});
