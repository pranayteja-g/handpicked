import { useState } from "react";
import { t } from "../i18n";
import { formatKey } from "../data/key";
import { CopyButton } from "./common";

export function SecretKeyCard({
  secret,
  username,
  onDone,
}: {
  secret: string;
  username: string;
  onDone: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const shown = formatKey(secret);

  const download = () => {
    const body = `Handpicked\nUsername: ${username}\nSecret key: ${shown}\n\nKeep this safe. It is your password; there is no reset.\n`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `handpicked-${username}-key.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card stack">
      <h1>{t("key.title")}</h1>
      <p className="muted">{t("key.body")}</p>
      <div className="keybox" aria-label={t("key.title")}>
        {shown}
      </div>
      <div className="row">
        <CopyButton text={shown} />
        <button type="button" className="btn" onClick={download}>
          {t("key.download")}
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>{t("key.saved")}</span>
      </label>
      <button type="button" className="btn primary" disabled={!saved} onClick={onDone}>
        {t("key.done")}
      </button>
    </section>
  );
}
