import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.{js,jsx}", "src/ui/**/*.test.{js,jsx}"],
    setupFiles: [],
  },
});
