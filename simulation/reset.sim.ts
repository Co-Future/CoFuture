// pnpm sim:reset – deletes the simulated organization and all simulated accounts.
import { it } from "vitest";
import { log, reset } from "./engine";

it("removes the simulation", async () => {
  const removed = await reset();
  log(removed > 0 ? `${removed} simulierte Konten und ihre Organisation gelöscht.` : "Keine Simulation gefunden, nichts zu löschen.");
}, 5 * 60_000);
