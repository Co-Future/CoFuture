import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/current-user";

async function UserName() {
  const user = await getCurrentUser();
  return <span className="hidden text-body-sm text-ink-muted sm:inline">Angemeldet als {user.displayName}</span>;
}

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/app" aria-label="CoFuture Übersicht">
            <Logo fontSize={20} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/app/organisation" className="inline-flex min-h-11 items-center text-label text-primary underline">
              Organisation
            </Link>
            <Suspense fallback={null}>
              <UserName />
            </Suspense>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
