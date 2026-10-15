import { useState } from "react";
import { buildReport, configStatus, runAll, type ProbeResult } from "./probes";

export function App() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = configStatus();

  const run = async () => {
    setRunning(true);
    setCopied(false);
    setResults(await runAll());
    setRunning(false);
  };

  const copy = async () => {
    const text = buildReport(results);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy report:", text);
    }
  };

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Handpicked - reachability spike</h1>
      <p style={{ fontSize: 14, opacity: 0.8 }}>
        Host: {location.host}
        <br />
        Supabase: {cfg.supabaseHost}
        <br />
        Proxy: {cfg.proxyHost}
      </p>
      <button onClick={run} disabled={running} style={btn}>
        {running ? "Testing..." : "Run tests"}
      </button>
      {results.length > 0 && (
        <>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
            {results.map((r) => (
              <li key={r.name} style={{ padding: "8px 0", borderBottom: "1px solid #8884" }}>
                <strong style={{ color: r.ok ? "#16a34a" : "#dc2626" }}>{r.ok ? "OK" : "FAIL"}</strong>{" "}
                {r.name}
                <br />
                <small>
                  {r.ms}ms - {r.detail}
                </small>
              </li>
            ))}
          </ul>
          <button onClick={copy} style={btn}>
            {copied ? "Copied" : "Copy report"}
          </button>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            Tester: run on Wi-Fi, then mobile data. Paste the report to Gyptor each time.
          </p>
        </>
      )}
    </main>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #888",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
