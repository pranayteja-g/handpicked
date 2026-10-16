import { useState, type ReactNode } from "react";
import { t } from "../i18n";
import { ApiError } from "../data/types";
import type { StringKey } from "../i18n";

export function errText(e: unknown): string {
  if (e instanceof ApiError) return t(`err.${e.code}` as StringKey);
  return t("err.unknown");
}

export function ErrorLine({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="error" role="alert">
      {children}
    </p>
  );
}

export function Avatar({ username, name }: { username: string; name: string }) {
  let h = 0;
  for (const ch of username) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initial = (name.trim()[0] ?? username[0] ?? "?").toUpperCase();
  return (
    <span className="avatar" style={{ ["--h" as string]: String(h) }} aria-hidden="true">
      {initial}
    </span>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts / older WebViews
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className ?? "btn"}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } else {
          window.prompt(t("common.copy"), text);
        }
      }}
    >
      {done ? t("common.copied") : t("common.copy")}
    </button>
  );
}

export function Spinner() {
  return <p className="muted">{t("common.loading")}</p>;
}
