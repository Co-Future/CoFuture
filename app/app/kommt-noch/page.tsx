import type { Metadata } from "next";
import { PlannedFeatures } from "@/components/teams/planned-features";

export const metadata: Metadata = { title: "Kommt noch – CoFuture" };

export default function PlannedPage() {
  return <PlannedFeatures headingLevel="h1" />;
}
