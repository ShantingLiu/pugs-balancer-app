import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
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
      "@utils": resolve(__dirname, "./src/utils"),
    },
  },
});
