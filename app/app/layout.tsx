import { Suspense } from "react";
import { Sidebar, SidebarSkeleton } from "@/components/app-shell/sidebar";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
