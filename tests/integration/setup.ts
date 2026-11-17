import { afterAll } from "vitest";
import { cleanUpTestRun } from "./helpers";

// Every test file deletes the accounts it created. Without SUPABASE_SECRET_KEY the hourly
// job purge-test-users in the database removes them instead.
afterAll(async () => {
  await cleanUpTestRun();
});
