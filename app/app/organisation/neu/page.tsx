import type { Metadata } from "next";
import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";

export const metadata: Metadata = { title: "Organisation anlegen – CoFuture" };

export default function NewOrganizationPage() {
  return (
    <>
      <h1 className="text-h1">Organisation anlegen</h1>
      <p className="mt-1 mb-6 max-w-[680px] text-body text-ink-muted">
        Du wirst Owner der neuen Organisation. Zwischen deinen Organisationen wechselst du oben im Menü links.
      </p>
      <CreateOrganizationForm />
    </>
  );
}
