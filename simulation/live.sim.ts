// pnpm sim:live – colleagues keep answering while you use the app. Duration: SIMULATION_MINUTES (default 15).
import { it } from "vitest";
import { live } from "./engine";

const minutes = Number(process.env.SIMULATION_MINUTES ?? 15);

it(`live simulation for ${minutes} minutes`, async () => {
  await live(minutes);
}, (minutes + 10) * 60_000);
