const rtf =
  typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
    ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
    : null;

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const sec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(sec);
  if (!rtf || abs > 60 * 60 * 24 * 14) return d.toLocaleDateString();
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  return rtf.format(Math.round(sec / 86400), "day");
}

export function isHttpUrl(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

export function hostOf(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
