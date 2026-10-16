import { useEffect, useState, type FormEvent } from "react";
import { t } from "../i18n";
import { go } from "../router";
import { isValidUsername, normalizeUsername, signUp, usernameAvailable } from "../data/api";
import { clearPendingKey, generateKey, readPendingInvite, readPendingKey, stashPendingKey } from "../data/key";
import { useAuth } from "../auth/AuthProvider";
import { ErrorLine, errText } from "../ui/common";
import { SecretKeyCard } from "../ui/SecretKeyCard";

type Avail = "idle" | "checking" | "yes" | "no" | "invalid" | "error";

export function SignUp() {
  const { profile } = useAuth();
  const [secret, setSecret] = useState<string | null>(readPendingKey());
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avail, setAvail] = useState<Avail>("idle");
  const [availErr, setAvailErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const u = normalizeUsername(username);

  // debounced availability check
  useEffect(() => {
    if (!u) return setAvail("idle");
    if (!isValidUsername(u)) return setAvail("invalid");
    setAvail("checking");
    let stale = false;
    const id = window.setTimeout(() => {
      usernameAvailable(u)
        .then((ok) => !stale && setAvail(ok ? "yes" : "no"))
        .catch((e) => {
          if (stale) return;
          setAvailErr(errText(e));
          setAvail("error");
        });
    }, 350);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [u]);

  const finish = () => {
    clearPendingKey();
    const pending = readPendingInvite();
    go(pending ? `/join/${pending}` : "/");
  };

  // Step 2: show the key (also resumes after an accidental reload)
  if (secret && profile) {
    return <SecretKeyCard secret={secret} username={profile.username} onDone={finish} />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (avail !== "yes" || busy) return;
    setBusy(true);
    setError("");
    const key = generateKey();
    try {
      stashPendingKey(key);
      await signUp(u, displayName, key);
      setSecret(key);
    } catch (err) {
      clearPendingKey();
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const hint =
    avail === "checking"
      ? t("auth.checking")
      : avail === "yes"
        ? t("auth.available")
        : avail === "no"
          ? t("auth.taken")
          : avail === "invalid"
            ? t("auth.invalid")
            : avail === "error"
              ? availErr
              : t("auth.usernameHint");

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h1>{t("auth.signup.title")}</h1>
      <label className="field">
        <span>{t("auth.username")}</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          spellCheck={false}
          maxLength={20}
          required
        />
        <small className={avail === "yes" ? "ok" : avail === "no" || avail === "invalid" ? "bad" : "muted"}>
          {hint}
        </small>
      </label>
      <label className="field">
        <span>{t("auth.displayName")}</span>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        <small className="muted">{t("auth.displayNameHint")}</small>
      </label>
      <ErrorLine>{error}</ErrorLine>
      <button className="btn primary" disabled={avail !== "yes" || busy}>
        {t("auth.signup.cta")}
      </button>
      <p className="muted center">
        {t("auth.haveKey")} <a href="#/login">{t("auth.signin.cta")}</a>
      </p>
    </form>
  );
}
