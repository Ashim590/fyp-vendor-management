import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

/** Read `PORT` from `backend/.env` so dev proxy matches local API without duplicating the port. */
function defaultBackendOriginFromBackendDotenv() {
  try {
    const envPath = path.resolve(__dirname, "../backend/.env");
    if (!fs.existsSync(envPath)) return "http://127.0.0.1:5000";
    const raw = fs.readFileSync(envPath, "utf8");
    const line = raw.split("\n").find((l) => /^\s*PORT\s*=/.test(l));
    if (!line) return "http://127.0.0.1:5000";
    let port =
      line
        .split("=")[1]
        ?.trim()
        .replace(/^["']|["']$/g, "") || "5000";
    port = port.replace(/#.*/, "").trim();
    return `http://127.0.0.1:${port || "5000"}`;
  } catch {
    return "http://127.0.0.1:5000";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Proxy `/api` → backend. Override with VITE_PROXY_TARGET; else match backend/.env PORT; else 5000.
  const proxyTarget =
    env.VITE_PROXY_TARGET ||
    env.VITE_DEV_API_URL ||
    defaultBackendOriginFromBackendDotenv();

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("recharts")) return "recharts";
            if (id.includes("jspdf") || id.includes("html2canvas"))
              return "pdf";
            if (id.includes("framer-motion")) return "framer";
            if (id.includes("react-router")) return "router";
            if (id.includes("@reduxjs") || id.includes("/redux/"))
              return "redux";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("react-dom")) return "react-dom";
            if (id.includes("/react/")) return "react-core";
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
