import { en, type StringKey } from "./en";

// To add a language: create ./xx.ts with the same keys and pick it here.
const dict: Record<StringKey, string> = en;

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = dict[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export type { StringKey };
