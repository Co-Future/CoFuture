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
