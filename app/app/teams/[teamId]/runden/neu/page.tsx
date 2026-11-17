import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CreateRoundForm } from "@/components/rounds/create-round-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

export const metadata: Metadata = { title: "Runde starten – CoFuture" };

async function NewRound({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  if (!uuidSchema.safeParse(teamId).success) notFound();
  await getCurrentUser();
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("id, name").eq("id", teamId).maybeSingle();
  if (!team) notFound();

  return (
    <>
      <Link href={`/app/teams/${team.id}`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline">
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zurück zu {team.name}
      </Link>
      <h1 className="mb-6 text-h1">Runde starten</h1>
      <CreateRoundForm teamId={team.id} />
    </>
  );
}

export default function NewRoundPage({ params }: PageProps<"/app/teams/[teamId]/runden/neu">) {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Wird geladen …</p>}>
      <NewRound params={params} />
    </Suspense>
  );
}
