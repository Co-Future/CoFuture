import type { MapKind } from "@/components/perspective-map";

/** Plain labels for perspective-map cluster kinds (usable in Server Components). */
export const KIND_LABELS: Record<MapKind, string> = {
  consensus: "Konsens",
  dissent: "Dissens",
  single_voice: "Einzelstimme",
  off_topic: "Andere Themen",
  unassigned: "Nicht zugeordnet",
};
