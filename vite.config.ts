import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tauri-apps/api/core": path.resolve(__dirname, "./src/shims/tauri-core.ts"),
      "@tauri-apps/api/event": path.resolve(__dirname, "./src/shims/tauri-event.ts"),
      "@tauri-apps/api/window": path.resolve(__dirname, "./src/shims/tauri-window.ts"),
      "@tauri-apps/api/webviewWindow": path.resolve(__dirname, "./src/shims/tauri-webviewWindow.ts"),
      "@tauri-apps/api/path": path.resolve(__dirname, "./src/shims/tauri-path.ts"),
      "@tauri-apps/api/app": path.resolve(__dirname, "./src/shims/tauri-app.ts"),
      "@tauri-apps/plugin-store": path.resolve(__dirname, "./src/shims/plugin-store.ts"),
      "@tauri-apps/plugin-os": path.resolve(__dirname, "./src/shims/plugin-os.ts"),
      "@tauri-apps/plugin-opener": path.resolve(__dirname, "./src/shims/plugin-opener.ts"),
      "@tauri-apps/plugin-process": path.resolve(__dirname, "./src/shims/plugin-process.ts"),
      "@tauri-apps/plugin-updater": path.resolve(__dirname, "./src/shims/plugin-updater.ts"),
      "@tauri-apps/plugin-autostart": path.resolve(__dirname, "./src/shims/plugin-autostart.ts"),
    },
  },
  esbuild: {
    drop: mode === "production" ? (["debugger"] as ["debugger"]) : [],
    pure:
      mode === "production"
        ? ["console.debug", "console.info", "console.trace"]
        : [],
  },
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "es2020",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        settings: path.resolve(__dirname, "settings.html"),
      },
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;

          if (id.includes("@ai-sdk/anthropic")) return "ai-anthropic";
          if (id.includes("@ai-sdk/google")) return "ai-google";
          if (id.includes("@ai-sdk/openai-compatible"))
            return "ai-openai-compat";
          if (id.includes("@ai-sdk/openai")) return "ai-openai";
          if (id.includes("@ai-sdk/cerebras")) return "ai-cerebras";
          if (id.includes("@ai-sdk/groq")) return "ai-groq";
          if (id.includes("@ai-sdk/xai")) return "ai-xai";
          if (id.includes("@ai-sdk/")) return "ai-sdk-shared";

          if (id.includes("/xterm/") || id.includes("@xterm/")) return "xterm";
          if (
            id.includes("@codemirror/") ||
            id.includes("@uiw/codemirror") ||
            id.includes("@replit/codemirror")
          )
            return "codemirror";
          if (id.includes("/streamdown/") || id.includes("@streamdown/"))
            return "streamdown";
          if (id.includes("/motion/") || id.includes("framer-motion"))
            return "motion";
          if (
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          )
            return "react";
          if (id.includes("@radix-ui/") || id.includes("/radix-ui/"))
            return "radix";
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 5000,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://127.0.0.1:3001",
        ws: true,
        changeOrigin: true,
      },
    },
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
