import { useEffect, useState, type FormEvent } from "react";
import { t } from "../i18n";
import { go } from "../router";
import { changeKey, deleteAccount, listBlocked, signOut, unblockUser, updateDisplayName } from "../data/api";
import { clearPendingInvite, clearPendingKey, generateKey, stashPendingKey } from "../data/key";
import type { Profile } from "../data/types";
import { useAuth, useMe } from "../auth/AuthProvider";
import { Avatar, ErrorLine, errText } from "../ui/common";
import { SecretKeyCard } from "../ui/SecretKeyCard";
import { useToast } from "../ui/toast";

export function Settings() {
  const me = useMe();
  const { reloadProfile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(me.display_name);
  const [blocked, setBlocked] = useState<Profile[] | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");

  const loadBlocked = () =>
    listBlocked()
      .then(setBlocked)
      .catch(() => setBlocked([]));

  useEffect(() => {
    void loadBlocked();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errText(e));
    }
  };

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await updateDisplayName(name);
      await reloadProfile();
      toast(t("common.saved"));
    });
  };

  const rotate = () =>
    run(async () => {
      const k = generateKey();
      await changeKey(k);
      stashPendingKey(k);
      setNewKey(k);
    });

  if (newKey) {
    return (
      <SecretKeyCard
        secret={newKey}
        username={me.username}
        onDone={() => {
          clearPendingKey();
          setNewKey(null);
        }}
      />
    );
  }

  return (
    <div className="stack-lg">
      <h1>{t("settings.title")}</h1>
      <ErrorLine>{error}</ErrorLine>

      <form className="card stack" onSubmit={saveName}>
        <h2>{t("settings.profile")}</h2>
        <p className="muted">
          {t("settings.username")}: @{me.username}
        </p>
        <label className="field">
          <span>{t("settings.displayName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
        </label>
        <button className="btn primary" disabled={!name.trim() || name.trim() === me.display_name}>
          {t("common.save")}
        </button>
      </form>

      <section className="card stack">
        <h2>{t("settings.blocked")}</h2>
        {blocked === null ? null : blocked.length === 0 ? (
          <p className="muted">{t("settings.noBlocked")}</p>
        ) : (
          <ul className="plain list">
            {blocked.map((b) => (
              <li key={b.id} className="item">
                <Avatar username={b.username} name={b.display_name} />
                <div className="grow">
                  <div className="name">{b.display_name}</div>
                  <div className="muted small">@{b.username}</div>
                </div>
                <button
                  className="link"
                  onClick={() => run(async () => (await unblockUser(b.id), loadBlocked()))}
                >
                  {t("settings.unblock")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack">
        <h2>{t("settings.key")}</h2>
        <p className="muted">{t("settings.keyBody")}</p>
        <button
          className="btn"
          onClick={() => window.confirm(t("settings.keyBody")) && rotate()}
        >
          {t("settings.keyRotate")}
        </button>
      </section>

      <section className="card stack">
        <p className="muted">{t("settings.signoutWarn")}</p>
        <button
          className="btn"
          onClick={async () => {
            await signOut();
            go("/");
          }}
        >
          {t("settings.signout")}
        </button>
      </section>

      <section className="card stack danger-zone">
        <h2>{t("settings.delete.title")}</h2>
        <p className="muted">{t("settings.delete.warn")}</p>
        <label className="field">
          <span>{t("settings.delete.confirm", { username: me.username })}</span>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button
          className="btn danger"
          disabled={confirmName.trim().toLowerCase() !== me.username}
          onClick={() =>
            run(async () => {
              await deleteAccount();
              clearPendingKey();
              clearPendingInvite();
              go("/");
            })
          }
        >
          {t("settings.delete.cta")}
        </button>
      </section>
    </div>
  );
}
