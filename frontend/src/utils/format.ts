const time = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const formatTime = (value: string | number | Date) => time.format(new Date(value));
export const formatMiles = (value: number) => `${decimal.format(value)} mi`;

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} m` : `${minutes} m`;
}

/** "2026-10-20T14:30" in local time, as <input type="datetime-local"> expects. */
export function toLocalInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
