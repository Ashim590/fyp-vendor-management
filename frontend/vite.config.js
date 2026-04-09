import fs from "fs";
import path from "path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

/** `localhost` in the proxy target often yields AggregateError on macOS (IPv4 vs IPv6). */
function normalizeProxyTargetOrigin(origin) {
  if (!origin || typeof origin !== "string") return origin;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return origin.replace(/\/+$/, "");
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "::1") u.hostname = "127.0.0.1";
    return u.origin;
  } catch {
    return origin.replace(/\/+$/, "");
  }
}

/**
 * API origin for the Vite proxy: read `../backend/.env` when present so PORT / BACKEND_URL
 * stay the single source of truth. (Stale `VITE_PROXY_TARGET=http://127.0.0.1:3000` is a
 * common cause of ECONNREFUSED — those vars only apply when backend/.env is missing.)
 */
function readBackendApiOriginFromDotenv() {
  try {
    const envPath = path.resolve(__dirname, "../backend/.env");
    if (!fs.existsSync(envPath)) return null;
    const raw = fs.readFileSync(envPath, "utf8");
    let port = null;
    let origin = null;
    for (const line of raw.split("\n")) {
      const t = line.replace(/\r$/, "").trim();
      if (!t || t.startsWith("#")) continue;
      const portM = t.match(/^\s*PORT\s*=\s*(.*)$/i);
      if (portM) {
        let p = portM[1]
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/#.*/, "")
          .trim();
        if (p) port = p;
        continue;
      }
      const urlM = t.match(
        /^\s*(?:BACKEND_URL|SERVER_BASE_URL)\s*=\s*(.*)$/i,
      );
      if (urlM) {
        let u = urlM[1]
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/#.*/, "")
          .trim();
        if (u) origin = u.replace(/\/+$/, "");
      }
    }
    if (origin && /^https?:\/\//i.test(origin)) return origin;
    if (port) return `http://127.0.0.1:${port}`;
    return "http://127.0.0.1:5000";
  } catch {
    return null;
  }
}

/** Log proxy target and return JSON when the API is unreachable (wrong PORT / backend stopped). */
function apiProxyDevPlugin(proxyTarget) {
  return {
    name: "api-proxy-dev",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        console.log(`\n[Vite] /api → ${proxyTarget} (restart Vite if you change backend/.env PORT)\n`);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const fromBackendFile = readBackendApiOriginFromDotenv();
  const explicit =
    env.VITE_PROXY_TARGET?.trim() || env.VITE_DEV_API_URL?.trim() || "";
  const proxyTarget = normalizeProxyTargetOrigin(
    fromBackendFile ?? (explicit || "http://127.0.0.1:5000"),
  );

  if (fromBackendFile && explicit && explicit.replace(/\/+$/, "") !== fromBackendFile.replace(/\/+$/, "")) {
    console.warn(
      `[Vite] Using API proxy target from ../backend/.env → ${proxyTarget} (ignoring VITE_PROXY_TARGET / VITE_DEV_API_URL=${explicit}). Remove those from frontend env to avoid confusion.`,
    );
  }

  return {
    plugins: [react(), apiProxyDevPlugin(proxyTarget)],
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
          configure: (proxy) => {
            proxy.on("error", (err, _req, res) => {
              const detail = err?.message || String(err);
              console.error(`[Vite proxy] /api → ${proxyTarget}: ${detail}`);
              if (!res || res.writableEnded) return;
              try {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    message: `Cannot reach API at ${proxyTarget} (${detail}). Start the backend and restart Vite if you changed backend/.env PORT.`,
                  }),
                );
              } catch {
                /* ignore */
              }
            });
          },
        },
      },
    },
  };
});
