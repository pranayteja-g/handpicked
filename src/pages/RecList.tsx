import { useCallback, useEffect, useState } from "react";
import { t } from "../i18n";
import { PAGE_SIZE, listInbox, listSent, type Rec } from "../data/recs";
import { useMe } from "../auth/AuthProvider";
import { ErrorLine, Spinner, errText } from "../ui/common";
import { RecCard } from "../ui/RecCard";

// Inbox (received) and Sent share one list component.
export function RecList({ mode }: { mode: "inbox" | "sent" }) {
  const me = useMe();
  const [items, setItems] = useState<Rec[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(
    (before?: string) => (mode === "inbox" ? listInbox(me.id, before) : listSent(me.id, before)),
    [me.id, mode],
  );

  useEffect(() => {
    let stale = false;
    setItems(null);
    fetchPage()
      .then((rows) => {
        if (stale) return;
        setItems(rows);
        setMore(rows.length === PAGE_SIZE);
        setError("");
      })
      .catch((e) => {
        if (stale) return;
        setError(errText(e));
        setItems([]);
      });
    return () => {
      stale = true;
    };
  }, [fetchPage]);

  const loadMore = async () => {
    if (!items?.length) return;
    setBusy(true);
    try {
      const rows = await fetchPage(items[items.length - 1].createdAt);
      setItems([...items, ...rows]);
      setMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack">
      <h1>{t(mode === "inbox" ? "inbox.title" : "sent.title")}</h1>
      <ErrorLine>{error}</ErrorLine>
      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="stack">
          <p className="muted">{t(mode === "inbox" ? "inbox.empty" : "sent.empty")}</p>
          <a className="btn" href={mode === "inbox" ? "#/friends" : "#/new"}>
            {t(mode === "inbox" ? "inbox.emptyCta" : "sent.emptyCta")}
          </a>
        </div>
      ) : (
        <>
          <div className="stack">
            {items.map((r) => (
              <RecCard key={r.id} rec={r} mode={mode} />
            ))}
          </div>
          {more && (
            <button className="btn" disabled={busy} onClick={loadMore}>
              {t("inbox.more")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
