export function formatHourShort(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const d = hr % 12 === 0 ? 12 : hr % 12;
  return `${d}${hr < 12 ? "a" : "p"}`;
}

export function formatHour12(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const d = hr % 12 === 0 ? 12 : hr % 12;
  return `${d} ${hr < 12 ? "AM" : "PM"}`;
}

export function relativeAge(iso: string, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}
