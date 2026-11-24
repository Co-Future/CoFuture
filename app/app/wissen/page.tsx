import { Search } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { KnowledgeHitCard } from "@/components/knowledge/knowledge-hit";
import { buttonStyles } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { recentKnowledge, searchKnowledge, type KnowledgeSearch } from "@/lib/knowledge/search";
import { getCurrentOrganization } from "@/lib/organizations/current";
import { getMyTeams } from "@/lib/teams/my-teams";
import { knowledgeSearchSchema } from "@/lib/validation/knowledge";

export const metadata: Metadata = { title: "Wissen – CoFuture" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Knowledge({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const org = await getCurrentOrganization(user.id);
  const params = await searchParams;
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const rawTeam = typeof params.team === "string" && params.team ? params.team : undefined;

  if (!org) {
    return (
      <p className="text-body text-ink-muted">Du bist noch in keiner Organisation. Lege eine an oder nimm eine Einladung an.</p>
    );
  }

  const supabase = await createClient();
  const teams = await getMyTeams(user.id, org.id);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const teamId = rawTeam && teamName.has(rawTeam) ? rawTeam : undefined;

  const parsed = rawQuery ? knowledgeSearchSchema.safeParse({ q: rawQuery, team: teamId }) : null;
  let result: KnowledgeSearch | null = null;
  let searchError: string | null =
    parsed && !parsed.success ? (parsed.error.issues[0]?.message ?? "Die Suche ist ungültig.") : null;
  if (parsed?.success) {
    try {
      result = await searchKnowledge(supabase, { organizationId: org.id, query: parsed.data.q, teamId });
    } catch {
      searchError = "Die Suche hat nicht geklappt. Versuch es gleich noch einmal.";
    }
  }
  const recent = result || rawQuery ? [] : await recentKnowledge(supabase, { organizationId: org.id, teamId });

  return (
    <>
      <form
        method="get"
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        aria-label="Wissensspeicher durchsuchen"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-label">
            Suchbegriff oder Frage
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={rawQuery}
            maxLength={200}
            placeholder="z. B. Hotline am Freitag"
            className="min-h-11 rounded-md border border-border-strong bg-card px-3 text-body text-ink"
          />
        </div>
        {teams.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team" className="text-label">
              Team
            </label>
            <select
              id="team"
              name="team"
              defaultValue={teamId ?? ""}
              className="min-h-11 rounded-md border border-border-strong bg-card px-3 text-body text-ink"
            >
              <option value="">Alle Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button type="submit" className={buttonStyles.primary}>
          <Search size={20} strokeWidth={1.75} aria-hidden />
          Wissen durchsuchen
        </button>
      </form>

      {searchError ? (
        <p role="alert" className="mt-6 text-body text-danger-ink">
          {searchError}
        </p>
      ) : null}

      {result ? (
        <section aria-labelledby="hits-heading" className="mt-8 flex flex-col gap-4">
          <div>
            <h2 id="hits-heading" className="text-h2">
              {result.hits.length === 0
                ? "Keine Treffer"
                : result.hits.length === 1
                  ? "1 Treffer"
                  : `${result.hits.length} Treffer`}
            </h2>
            <p className="mt-1 text-body-sm text-ink-muted">
              {result.mode === "hybrid"
                ? "Gesucht nach Stichwort und nach Bedeutung. Du siehst nur, was du auch im Original sehen darfst."
                : "Gerade nur nach Stichwort gesucht, die Suche nach Bedeutung ist kurz nicht erreichbar."}
            </p>
          </div>
          {result.hits.length === 0 ? (
            <p className="text-body text-ink-muted">
              Dazu gibt es noch nichts im Wissensspeicher. Er füllt sich mit jeder Zusammenfassung und jedem Beschluss.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {result.hits.map((hit) => (
                <li key={hit.id}>
                  <KnowledgeHitCard hit={hit} teamName={teamName.get(hit.teamId) ?? "Team"} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : !searchError ? (
        <section aria-labelledby="recent-heading" className="mt-8 flex flex-col gap-4">
          <h2 id="recent-heading" className="text-h2">
            Zuletzt hinzugekommen
          </h2>
          {recent.length === 0 ? (
            <p className="text-body text-ink-muted">
              Noch leer. Sobald AsyncMeet einen Austausch zusammengefasst hat oder ein Beschluss steht, findest du es hier.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recent.map((hit) => (
                <li key={hit.id}>
                  <KnowledgeHitCard hit={hit} teamName={teamName.get(hit.teamId) ?? "Team"} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}

export default function KnowledgePage({ searchParams }: PageProps<"/app/wissen">) {
  return (
    <div className="max-w-[760px]">
      <h1 className="text-h1">Wissen</h1>
      <p className="mt-2 mb-6 text-body-lg text-ink-muted">
        Zusammenfassungen, Themengruppen und Beschlüsse aus allen Teams deiner Organisation, die du sehen darfst.
      </p>
      <Suspense fallback={<p className="text-body text-ink-muted">Wird geladen …</p>}>
        <Knowledge searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
