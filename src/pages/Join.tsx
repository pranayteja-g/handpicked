import { useEffect, useState } from "react";
import { t } from "../i18n";
import { go } from "../router";
import { acceptInvite, previewInvite } from "../data/api";
import { clearPendingInvite, stashPendingInvite } from "../data/key";
import type { InvitePreview } from "../data/types";
import { useAuth } from "../auth/AuthProvider";
import { Avatar, ErrorLine, Spinner, errText } from "../ui/common";
import { useToast } from "../ui/toast";

export function Join({ code }: { code: string }) {
  const { status, profile } = useAuth();
  const { toast } = useToast();
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stale = false;
    previewInvite(code)
      .then((p) => !stale && setPreview(p))
      .catch((e) => {
        if (stale) return;
        setError(errText(e));
        setPreview(null);
      });
    return () => {
      stale = true;
    };
  }, [code]);

  // remember the invite so signup/login can come back here
  const remember = () => stashPendingInvite(code);

  if (preview === undefined || status === "loading") return <Spinner />;

  if (!preview) {
    return (
      <section className="card stack">
        <p>{error || t("join.invalid")}</p>
        <a className="btn" href="#/">
          {t("common.back")}
        </a>
      </section>
    );
  }

  const own = profile?.username === preview.username;

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      await acceptInvite(code);
      clearPendingInvite();
      toast(t("join.success", { name: preview.display_name }));
      go("/friends");
    } catch (e) {
      const msg = errText(e);
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <section className="card stack center">
      <Avatar username={preview.username} name={preview.display_name} />
      <h1>{t("join.title", { name: preview.display_name })}</h1>
      <p className="muted">{t("join.sub", { username: preview.username })}</p>
      <ErrorLine>{error}</ErrorLine>
      {status === "in" ? (
        own ? (
          <p className="muted">{t("join.own")}</p>
        ) : (
          <button className="btn primary" disabled={busy} onClick={accept}>
            {t("join.accept")}
          </button>
        )
      ) : (
        <>
          <a className="btn primary" href="#/signup" onClick={remember}>
            {t("join.signup")}
          </a>
          <a className="btn" href="#/login" onClick={remember}>
            {t("join.signin")}
          </a>
        </>
      )}
    </section>
  );
}
