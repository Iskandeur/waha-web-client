import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // Overridden to "/whatsapp-sharp/" by the GitHub Pages deploy workflow (project pages are
    // served under a subpath); left as "/" for local dev and self-hosted deployments.
    base: env.VITE_BASE_PATH ?? "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": "http://localhost:8787",
      },
    },
  };
});
