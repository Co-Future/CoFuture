"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, FormError } from "@/components/ui/form";
import { apiFetch } from "@/lib/api/client";
import { createOrganizationSchema } from "@/lib/validation/organization";

/** Create an organization and become its admin. The app switches to it right away. */
export function CreateOrganizationForm() {
  const router = useRouter();
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const formElement = event.currentTarget;
    const parsed = createOrganizationSchema.safeParse(Object.fromEntries(new FormData(formElement)));
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setPending(true);
    const result = await apiFetch("/api/organizations", { method: "POST", body: parsed.data });
    setPending(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    // Next keeps this page alive (Activity) after navigating away: start fresh for the next visit.
    formElement.reset();
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-[680px] flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Field id="org-name" name="name" label="Name der Organisation" maxLength={80} error={fieldError} />
      </div>
      <Button type="submit" disabled={pending} className="sm:mt-6">
        Organisation anlegen
      </Button>
      {formError ? <FormError>{formError}</FormError> : null}
    </form>
  );
}
