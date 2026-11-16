"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/form";
import { createClient } from "@/lib/db/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={signOut} disabled={pending}>
      <LogOut size={20} strokeWidth={1.75} aria-hidden />
      Abmelden
    </Button>
  );
}
