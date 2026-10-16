import { useState } from "react";
import { buildReport, configStatus, runAll, type ProbeResult } from "../probes";

// Reachability test page, kept at #/spike for testers in restricted networks.
export function Spike() {
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
    <section className="card stack">
      <h1>Reachability test</h1>
      <p className="muted">
        Host: {location.host}
        <br />
        Backend: {cfg.supabaseHost}
        <br />
        Proxy: {cfg.proxyHost}
      </p>
      <button className="btn primary" onClick={run} disabled={running}>
        {running ? "Testing…" : "Run tests"}
      </button>
      {results.length > 0 && (
        <>
          <ul className="plain">
            {results.map((r) => (
              <li key={r.name} className="probe">
                <strong className={r.ok ? "ok" : "bad"}>{r.ok ? "OK" : "FAIL"}</strong> {r.name}
                <br />
                <small className="muted">
                  {r.ms}ms · {r.detail}
                </small>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={copy}>
            {copied ? "Copied" : "Copy report"}
          </button>
        </>
      )}
    </section>
  );
}
