import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import fs from "fs";
import { resolve } from "path";

const tauriConfig = JSON.parse(
  fs.readFileSync(resolve(__dirname, "./src-tauri/tauri.conf.json"), "utf8")
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(tauriConfig.version),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@engine": resolve(__dirname, "./src/engine"),
      "@config": resolve(__dirname, "./src/config"),
      "@store": resolve(__dirname, "./src/store"),
      "@services": resolve(__dirname, "./src/services"),
      "@utils": resolve(__dirname, "./src/utils"),
      "@hooks": resolve(__dirname, "./src/hooks"),
    },
  },
});
