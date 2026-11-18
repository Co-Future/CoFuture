import { LayoutDashboard, Mail, Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { NavLink } from "@/components/app-shell/nav-link";
import { OrgSwitcher } from "@/components/app-shell/org-switcher";
import { SidebarFrame } from "@/components/app-shell/sidebar-frame";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { phaseLabel, plannedFeatures } from "@/components/teams/planned-features";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyTeams, teamDotClass } from "@/lib/teams/my-teams";
import { getCurrentOrganization, getMyOrganizations } from "@/lib/organizations/current";
import { getMyInvitations } from "@/lib/organizations/invitations";

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-6 pb-1">
      <span className="text-caption font-semibold tracking-wide text-ink-muted uppercase">{children}</span>
      {action}
    </div>
  );
}

/** Main navigation: organization menu, personal overview, teams, organization and planned features. */
export async function Sidebar() {
  const user = await getCurrentUser();
  const [organizations, current, invitations] = await Promise.all([
    getMyOrganizations(user.id),
    getCurrentOrganization(user.id),
    getMyInvitations(),
  ]);
  const teams = await getMyTeams(user.id, current?.id ?? null);

  return (
    <SidebarFrame>
      <OrgSwitcher organizations={organizations} currentId={current?.id ?? null} />

      <nav aria-label="Bereiche" className="mt-4 flex flex-col">
        <NavLink href="/app" icon={<LayoutDashboard size={20} strokeWidth={1.75} aria-hidden />} exact>
          Übersicht
        </NavLink>
        {invitations.length > 0 ? (
          <NavLink
            href="/app#einladungen"
            icon={<Mail size={20} strokeWidth={1.75} aria-hidden />}
            exact
            trailing={
              <span className="rounded-full bg-primary-soft px-2 text-caption text-ink">
                {invitations.length}
                <span className="sr-only"> offen</span>
              </span>
            }
          >
            Einladungen
          </NavLink>
        ) : null}

        <SectionLabel
          action={
            current?.role === "guest" ? null : (
            <Link
              href="/app/teams/neu"
              aria-label="Team anlegen"
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-ink-muted hover:bg-sunken hover:text-ink"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden />
            </Link>
            )
          }
        >
          Teams
        </SectionLabel>
        {teams.length > 0 ? (
          <ul className="flex flex-col">
            {teams.map((team, i) => (
              <li key={team.id}>
                <NavLink
                  href={`/app/teams/${team.id}`}
                  dotClass={teamDotClass(i)}
                  trailing={
                    team.openRounds > 0 ? (
                      <span className="rounded-full bg-primary-soft px-2 text-caption text-ink">
                        {team.openRounds}
                        <span className="sr-only"> offene Austausche</span>
                      </span>
                    ) : null
                  }
                >
                  {team.name}
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-body-sm text-ink-muted">
            Noch kein Team.{" "}
            {current?.role === "guest" ? null : (
              <Link href="/app/teams/neu" className="font-semibold text-primary underline">
                Team anlegen
              </Link>
            )}
          </p>
        )}

        {current ? (
          <>
            <SectionLabel>Organisation</SectionLabel>
            <NavLink href="/app/organisation" icon={<Users size={20} strokeWidth={1.75} aria-hidden />} exact>
              {current.role === "owner" ? "Personen und Zugänge" : "Personen"}
            </NavLink>
          </>
        ) : null}

        <details className="group mt-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-3 text-body text-ink-muted hover:bg-sunken hover:text-ink [&::-webkit-details-marker]:hidden">
            <Sparkles size={20} strokeWidth={1.75} aria-hidden />
            <span className="flex-1">Kommt noch</span>
            <span className="text-caption">{plannedFeatures.length}</span>
          </summary>
          <ul className="mt-1 flex flex-col">
            {plannedFeatures.map(({ id, title, phase, Icon }) => (
              <li key={id}>
                <Link
                  href={`/app/kommt-noch#${id}`}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-body-sm text-ink-muted hover:bg-sunken hover:text-ink"
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                  <span className="rounded-full bg-sunken px-2 text-caption">{phaseLabel[phase]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <p className="px-3 text-body-sm text-ink-muted">
          Angemeldet als <span className="font-semibold text-ink">{user.displayName}</span>
        </p>
        <SignOutButton />
      </div>
    </SidebarFrame>
  );
}

export function SidebarSkeleton() {
  return <div aria-hidden className="hidden w-72 shrink-0 border-r border-line bg-paper lg:block" />;
}
