import { useEffect, useState } from "react";
import { t } from "../i18n";
import { go } from "../router";
import { deleteRecommendation, getRec, imageUrl, markRead, type Rec } from "../data/recs";
import { useMe } from "../auth/AuthProvider";
import { Avatar, ErrorLine, Spinner, errText } from "../ui/common";
import { CategoryTag } from "../ui/RecCard";
import { useToast } from "../ui/toast";
import { hostOf, isHttpUrl, timeAgo } from "../lib/time";

export function RecDetail({ id }: { id: string }) {
  const me = useMe();
  const { toast } = useToast();
  const [rec, setRec] = useState<Rec | null | undefined>(undefined);
  const [img, setImg] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stale = false;
    setRec(undefined);
    getRec(id, me.id)
      .then(async (r) => {
        if (stale) return;
        setRec(r);
        if (!r) return;
        if (r.imagePath) imageUrl(r.imagePath).then((u) => !stale && setImg(u));
        if (r.unread) {
          await markRead(r.id).catch(() => {});
          window.dispatchEvent(new Event("hp:unread")); // refresh the tab badge
        }
      })
      .catch((e) => {
        if (stale) return;
        setError(errText(e));
        setRec(null);
      });
    return () => {
      stale = true;
    };
  }, [id, me.id]);

  if (rec === undefined) return <Spinner />;
  if (!rec) {
    return (
      <section className="card stack">
        <p>{error || t("detail.notFound")}</p>
        <a className="btn" href="#/">
          {t("nav.inbox")}
        </a>
      </section>
    );
  }

  const mine = rec.authorId === me.id;

  const remove = async () => {
    if (!window.confirm(t("detail.deleteConfirm"))) return;
    try {
      await deleteRecommendation(rec);
      toast(t("detail.deletedToast"));
      go("/sent");
    } catch (e) {
      setError(errText(e));
    }
  };

  return (
    <article className="stack-lg">
      <div className="stack">
        <div className="row between">
          <CategoryTag category={rec.category} />
          <span className="muted small">{timeAgo(rec.createdAt)}</span>
        </div>
        <h1>{rec.title}</h1>
        <div className="row muted">
          {rec.author && <Avatar username={rec.author.username} name={rec.author.display_name} />}
          <span>
            {t("detail.from", {
              name: mine ? t("detail.you") : (rec.author?.display_name ?? t("inbox.unknown")),
            })}
          </span>
        </div>
      </div>

      {img && <img className="recimg" src={img} alt={rec.title} loading="lazy" />}
      {rec.note && <p className="note">{rec.note}</p>}

      {isHttpUrl(rec.url) && (
        <a className="btn" href={rec.url} target="_blank" rel="noopener noreferrer nofollow">
          {t("detail.openLink")} · {hostOf(rec.url)}
        </a>
      )}

      <section className="stack">
        <h2>{t("detail.sentTo")}</h2>
        <p className="muted">
          {rec.recipients
            .map((p, i) =>
              rec.recipientIds[i] === me.id
                ? t("detail.you")
                : (p?.display_name ?? t("detail.someone")),
            )
            .join(", ")}
        </p>
      </section>

      <ErrorLine>{error}</ErrorLine>

      {mine && (
        <div className="row">
          <a className="btn" href={`#/edit/${rec.id}`}>
            {t("detail.edit")}
          </a>
          <button className="btn danger" onClick={remove}>
            {t("detail.delete")}
          </button>
        </div>
      )}
    </article>
  );
}
