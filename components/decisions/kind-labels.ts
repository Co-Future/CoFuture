import type { MapKind } from "@/components/perspective-map";

/** Plain labels for perspective-map cluster kinds (usable in Server Components), same wording as question-summary.tsx. */
export const KIND_LABELS: Record<MapKind, string> = {
  consensus: "Viele sehen es so",
  dissent: "Bedenken",
  single_voice: "Einzelne Stimme",
  off_topic: "Anderes Thema",
  unassigned: "Nicht zugeordnet",
};
