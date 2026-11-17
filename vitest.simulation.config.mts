import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Office simulation (simulation/): runs against the Supabase project in .env.local (staging).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["simulation/**/*.sim.ts"],
    fileParallelism: false,
    // Print the simulation log as it happens, not after each test.
    disableConsoleIntercept: true,
    hookTimeout: 20 * 60_000,
  },
});
