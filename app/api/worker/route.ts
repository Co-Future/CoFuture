import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api/respond";
import { serverEnv } from "@/lib/env";
import { runAnalyzeJobs } from "@/lib/jobs/analyze";
import { runEmbedJobs } from "@/lib/jobs/embed";
import { runTranscribeJobs, sweepOldAudio } from "@/lib/jobs/transcribe";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = serverEnv().WORKER_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/**
 * POST /api/worker (Authorization: Bearer WORKER_SECRET) → 200 { transcribe, analyze, sweptAudio }.
 * Backup path for jobs that the immediate after() run did not finish, plus audio cleanup.
 * Meant to be called by pg_cron every minute once a stable deployment URL exists.
 */
export async function POST(request: Request) {
  if (!authorized(request)) return apiError(401, "unauthenticated", "Nicht berechtigt.");
  const transcribe = await runTranscribeJobs({ limit: 10 });
  const analyze = await runAnalyzeJobs({ limit: 2 });
  const embed = await runEmbedJobs({ limit: 100 });
  const sweptAudio = await sweepOldAudio();
  return Response.json({ transcribe, analyze, embed, sweptAudio });
}
