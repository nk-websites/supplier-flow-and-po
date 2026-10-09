import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

// Load the CJS dev-only webforge plugin at runtime (its internal require("path")
// must not be inlined into the ESM config bundle).
const nodeRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webforgeLoc = nodeRequire("./.webforge/wf-vite-plugin.cjs");

export default defineConfig({
  plugins: [react(), webforgeLoc()],
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  server: {
    host: "0.0.0.0",
    port: 14775,
    strictPort: false,
    proxy: {
      "/api": "http://localhost:14776",
    },
  },
});
