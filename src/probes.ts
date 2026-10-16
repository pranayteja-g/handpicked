// M0 reachability probes. No third-party SDKs on purpose.

export type ProbeResult = {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
};

const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const PROXY_RAW = (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/$/, "");
const PROXY = PROXY_RAW && /^https?:\/\//.test(PROXY_RAW) ? PROXY_RAW : undefined;

const TIMEOUT_MS = 10000;

async function timedFetch(
  name: string,
  url: string,
  init: RequestInit = {},
  anyReply = false,
): Promise<ProbeResult> {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const ms = Math.round(performance.now() - t0);
    return { name, ok: anyReply ? res.status < 500 : res.ok, ms, detail: `HTTP ${res.status}` };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e instanceof DOMException && e.name === "AbortError" ? "timeout 10s" : String(e);
    return { name, ok: false, ms, detail: msg };
  } finally {
    clearTimeout(timer);
  }
}

function wsProbe(name: string, base: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const wsUrl =
      base.replace(/^http/, "ws") + `/realtime/v1/websocket?apikey=${SB_KEY ?? ""}&vsn=1.0.0`;
    let done = false;
    const finish = (ok: boolean, detail: string) => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve({ name, ok, ms: Math.round(performance.now() - t0), detail });
    };
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      resolve({ name, ok: false, ms: 0, detail: String(e) });
      return;
    }
    const timer = setTimeout(() => finish(false, "timeout 10s"), TIMEOUT_MS);
    ws.onopen = () => {
      clearTimeout(timer);
      finish(true, "ws open");
    };
    ws.onerror = () => {
      clearTimeout(timer);
      finish(false, "ws error");
    };
  });
}

function safeHost(u?: string): string {
  if (!u) return "(unset)";
  try {
    return new URL(u).host;
  } catch {
    return `(invalid URL: ${u})`;
  }
}

export function configStatus() {
  return {
    supabase: !!SB_URL && !!SB_KEY,
    proxy: !!PROXY,
    supabaseHost: safeHost(SB_URL),
    proxyHost: safeHost(PROXY),
  };
}

export async function runAll(): Promise<ProbeResult[]> {
  const jobs: Promise<ProbeResult>[] = [];
  const base = import.meta.env.BASE_URL;

  // 1. host self-test: own static asset
  jobs.push(timedFetch("host: static asset", `${base}probe.txt`));

  if (SB_URL && SB_KEY) {
    const h = { apikey: SB_KEY };
    jobs.push(timedFetch("supabase direct: auth health", `${SB_URL}/auth/v1/health`, { headers: h }));
    jobs.push(timedFetch("supabase direct: REST", `${SB_URL}/rest/v1/`, { headers: h }, true));
    jobs.push(wsProbe("supabase direct: realtime WS", SB_URL));
  }

  if (PROXY && SB_KEY) {
    const h = { apikey: SB_KEY };
    jobs.push(timedFetch("proxy: auth health", `${PROXY}/auth/v1/health`, { headers: h }));
    jobs.push(timedFetch("proxy: REST", `${PROXY}/rest/v1/`, { headers: h }, true));
    jobs.push(wsProbe("proxy: realtime WS", PROXY));
  }

  return Promise.all(jobs);
}

export function buildReport(results: ProbeResult[]): string {
  const lines = [
    `Handpicked spike report`,
    `time: ${new Date().toISOString()}`,
    `page: ${location.href}`,
    `net: ${(navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? "n/a"}`,
    `ua: ${navigator.userAgent}`,
    "",
    ...results.map((r) => `${r.ok ? "OK  " : "FAIL"} ${r.name} - ${r.ms}ms - ${r.detail}`),
  ];
  return lines.join("\n");
}
