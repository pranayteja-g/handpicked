import { t, type StringKey } from "../i18n";
import type { Rec } from "../data/recs";
import { timeAgo } from "../lib/time";

export function CategoryTag({ category }: { category: Rec["category"] }) {
  return <span className="tag">{t(`cat.${category}` as StringKey)}</span>;
}

export function RecCard({ rec, mode }: { rec: Rec; mode: "inbox" | "sent" }) {
  const sub =
    mode === "inbox"
      ? t("inbox.from", { name: rec.author?.display_name ?? t("inbox.unknown") })
      : rec.recipientIds.length === 1
        ? t("sent.to1")
        : t("sent.toN", { n: rec.recipientIds.length });

  return (
    <a className={`reccard${rec.unread ? " unread" : ""}`} href={`#/r/${rec.id}`}>
      <div className="row between">
        <CategoryTag category={rec.category} />
        <span className="muted small">{timeAgo(rec.createdAt)}</span>
      </div>
      <div className="rectitle">
        {rec.unread && <span className="dot" aria-label="unread" />}
        {rec.title}
      </div>
      <div className="muted small">
        {sub}
        {rec.imagePath ? " · photo" : ""}
      </div>
    </a>
  );
}
