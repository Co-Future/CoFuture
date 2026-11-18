import { ArrowLeft, CornerDownRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExchangeForm } from "@/components/rounds/exchange-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { uuidSchema } from "@/lib/validation/team";

export const metadata: Metadata = { title: "Austausch starten – CoFuture" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function NewRound({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: SearchParams }) {
  const { teamId } = await params;
  const query = await searchParams;
  const von = typeof query.von === "string" && uuidSchema.safeParse(query.von).success ? query.von : undefined;
  const frage = typeof query.frage === "string" ? query.frage.slice(0, 500) : undefined;
  if (!uuidSchema.safeParse(teamId).success) notFound();
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("id, name").eq("id", teamId).maybeSingle();
  if (!team) notFound();
  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, profiles(display_name)")
    .eq("team_id", team.id);
  const people = (members ?? [])
    .filter((m) => m.user_id !== user.id)
    .map((m) => ({ userId: m.user_id, name: m.profiles?.display_name ?? "Unbekannt" }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  // Follow-up exchange: only for a closed or decided exchange of this team.
  const { data: parent } = von
    ? await supabase.from("rounds").select("id, question, status").eq("id", von).eq("team_id", team.id).neq("status", "open").maybeSingle()
    : { data: null };

  return (
    <>
      <Link href={`/app/teams/${team.id}`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline">
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zurück zu {team.name}
      </Link>
      <h1 className="text-h1">{parent ? (frage ? "Rückfrage stellen" : "Folge-Austausch starten") : "Austausch starten"}</h1>
      {parent ? (
        <p className="mt-2 flex max-w-[680px] items-start gap-2 text-body text-ink-muted">
          <CornerDownRight aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            Verknüpft mit dem Ursprungs-Austausch: <span className="font-semibold text-ink">{parent.question}</span>
          </span>
        </p>
      ) : null}
      <div className="mt-6">
        <ExchangeForm
          key={`${parent?.id ?? "neu"}-${frage ?? ""}`}
          teamId={team.id}
          people={people}
          currentUserId={user.id}
          parentRoundId={parent?.id}
          defaultQuestion={parent ? frage : undefined}
        />
      </div>
    </>
  );
}

export default function NewRoundPage({ params, searchParams }: PageProps<"/app/teams/[teamId]/runden/neu">) {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Wird geladen …</p>}>
      <NewRound params={params} searchParams={searchParams} />
    </Suspense>
  );
}
