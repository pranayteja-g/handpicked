import { useState, type FormEvent } from "react";
import { t } from "../i18n";
import { go } from "../router";
import { signIn } from "../data/api";
import { readPendingInvite } from "../data/key";
import { ErrorLine, errText } from "../ui/common";

export function Login() {
  const [username, setUsername] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(username, key);
      const pending = readPendingInvite();
      go(pending ? `/join/${pending}` : "/");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h1>{t("auth.signin.title")}</h1>
      <label className="field">
        <span>{t("auth.username")}</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          spellCheck={false}
          required
        />
      </label>
      <label className="field">
        <span>{t("auth.secretKey")}</span>
        <input
          className="mono"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="current-password"
          spellCheck={false}
          required
        />
      </label>
      <ErrorLine>{error}</ErrorLine>
      <button className="btn primary" disabled={busy || !username || !key}>
        {t("auth.signin.cta")}
      </button>
      <p className="muted center">
        {t("auth.noKey")} <a href="#/signup">{t("home.create")}</a>
      </p>
    </form>
  );
}
