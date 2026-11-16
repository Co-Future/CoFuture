import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <Link href="/" aria-label="CoFuture Startseite">
        <Logo fontSize={22} />
      </Link>
      <main className="mt-8 w-full max-w-[420px] rounded-lg border border-line bg-card p-6 shadow-card">{children}</main>
    </div>
  );
}
