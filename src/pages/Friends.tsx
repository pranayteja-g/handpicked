import { useCallback, useEffect, useState } from "react";
import { t } from "../i18n";
import {
  blockUser,
  createInvite,
  getActiveInvite,
  inviteUrl,
  listFriends,
  removeFriend,
  revokeInvite,
} from "../data/api";
import type { Invite, Profile } from "../data/types";
import { useMe } from "../auth/AuthProvider";
import { Avatar, CopyButton, ErrorLine, Spinner, errText } from "../ui/common";
import { useToast } from "../ui/toast";

export function Friends() {
  const me = useMe();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setFriends(await listFriends(me.id));
      setError("");
    } catch (e) {
      setError(errText(e));
      setFriends([]);
    }
  }, [me.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      toast(errText(e));
    }
  };

  return (
    <div className="stack-lg">
      <section className="stack">
        <h1>{t("friends.title")}</h1>
        <ErrorLine>{error}</ErrorLine>
        {friends === null ? (
          <Spinner />
        ) : friends.length === 0 ? (
          <p className="muted">{t("friends.empty")}</p>
        ) : (
          <ul className="plain list">
            {friends.map((f) => (
              <li key={f.id} className="item">
                <Avatar username={f.username} name={f.display_name} />
                <div className="grow">
                  <div className="name">{f.display_name}</div>
                  <div className="muted small">@{f.username}</div>
                </div>
                <button
                  className="link"
                  onClick={() =>
                    window.confirm(t("friends.removeConfirm", { name: f.display_name })) &&
                    act(() => removeFriend(me.id, f.id))
                  }
                >
                  {t("friends.remove")}
                </button>
                <button
                  className="link danger"
                  onClick={() =>
                    window.confirm(t("friends.blockConfirm", { name: f.display_name })) &&
                    act(() => blockUser(f.id))
                  }
                >
                  {t("friends.block")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <InvitePanel name={me.display_name} />
    </div>
  );
}

function InvitePanel({ name }: { name: string }) {
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined);
  const [days, setDays] = useState<string>("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getActiveInvite()
      .then(setInvite)
      .catch((e) => {
        setError(errText(e));
        setInvite(null);
      });
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      setInvite(await createInvite(days === "never" ? null : Number(days)));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await revokeInvite();
      setInvite(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const url = invite ? inviteUrl(invite.code) : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section className="card stack">
      <h2>{t("invite.title")}</h2>
      <p className="muted">{t("invite.body")}</p>
      <ErrorLine>{error}</ErrorLine>
      {invite === undefined ? (
        <Spinner />
      ) : (
        <>
          {invite && (
            <>
              <input className="mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <p className="muted small">
                {invite.expiresAt
                  ? t("invite.expires", { date: new Date(invite.expiresAt).toLocaleDateString() })
                  : t("invite.never")}
              </p>
              <div className="row">
                <CopyButton text={url} className="btn primary" />
                {canShare && (
                  <button
                    className="btn"
                    onClick={() =>
                      navigator.share({ text: t("invite.shareText", { name }), url }).catch(() => {})
                    }
                  >
                    {t("invite.share")}
                  </button>
                )}
                <button className="btn" disabled={busy} onClick={turnOff}>
                  {t("invite.revoke")}
                </button>
              </div>
            </>
          )}
          <div className="row">
            <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Validity">
              <option value="7">{t("invite.valid7")}</option>
              <option value="30">{t("invite.valid30")}</option>
              <option value="never">{t("invite.never")}</option>
            </select>
            <button className={invite ? "btn" : "btn primary"} disabled={busy} onClick={create}>
              {invite ? t("invite.new") : t("invite.create")}
            </button>
          </div>
          {invite && <p className="muted small">{t("invite.newWarn")}</p>}
        </>
      )}
    </section>
  );
}
