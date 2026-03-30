import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // Proxy `/api` → backend. Default 5000 matches backend/src/server.ts when PORT is unset; override with VITE_PROXY_TARGET.
  const proxyTarget =
    env.VITE_PROXY_TARGET || env.VITE_DEV_API_URL || "http://127.0.0.1:5000"

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
