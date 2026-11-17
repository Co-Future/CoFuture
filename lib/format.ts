const TIME_ZONE = "Europe/Berlin";

const dateTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "17.11.2026, 12:00 Uhr" in German time, regardless of the server's time zone. */
export function formatDateTime(iso: string | Date): string {
  return `${dateTime.format(new Date(iso))} Uhr`;
}

/** True once the given moment has passed. Kept out of components so render code stays pure. */
export function isPast(iso: string): boolean {
  return Date.parse(iso) <= Date.now();
}

/** "noch 2 Tage 3 Std.", "noch 4 Std. 15 Min.", "noch 9 Min.", "noch unter 1 Min.", or null once over. */
export function formatRemaining(ms: number): string | null {
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "noch unter 1 Min.";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `noch ${days} ${days === 1 ? "Tag" : "Tage"} ${hours} Std.` : `noch ${days} ${days === 1 ? "Tag" : "Tage"}`;
  if (hours > 0) return mins > 0 ? `noch ${hours} Std. ${mins} Min.` : `noch ${hours} Std.`;
  return `noch ${mins} Min.`;
}
