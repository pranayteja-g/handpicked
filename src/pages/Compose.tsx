import { useEffect, useState, type FormEvent } from "react";
import { t, type StringKey } from "../i18n";
import { go } from "../router";
import { listFriends } from "../data/api";
import {
  CATEGORIES,
  createRecommendation,
  getRec,
  updateRecommendation,
  type Category,
} from "../data/recs";
import type { Profile } from "../data/types";
import { compressImage } from "../lib/image";
import { useMe } from "../auth/AuthProvider";
import { Avatar, ErrorLine, Spinner, errText } from "../ui/common";
import { useToast } from "../ui/toast";

// New recommendation, or edit an existing one when editId is set (text fields only).
export function Compose({ editId }: { editId?: string }) {
  const me = useMe();
  const { toast } = useToast();

  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [loaded, setLoaded] = useState(!editId);
  const [category, setCategory] = useState<Category>("movie_tv");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [all, setAll] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // friends (new mode only)
  useEffect(() => {
    if (editId) return;
    listFriends(me.id)
      .then(setFriends)
      .catch((e) => {
        setError(errText(e));
        setFriends([]);
      });
  }, [editId, me.id]);

  // existing values (edit mode)
  useEffect(() => {
    if (!editId) return;
    getRec(editId, me.id)
      .then((r) => {
        if (!r || r.authorId !== me.id) return go("/");
        setCategory(r.category);
        setTitle(r.title);
        setNote(r.note ?? "");
        setUrl(r.url ?? "");
        setLoaded(true);
      })
      .catch((e) => {
        setError(errText(e));
        setLoaded(true);
      });
  }, [editId, me.id]);

  useEffect(() => {
    if (!image) return setPreview(null);
    const u = URL.createObjectURL(image);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [image]);

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      setImage(await compressImage(file));
    } catch {
      setImage(null);
      setError(t("err.image_failed"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const canSend =
    title.trim().length > 0 && !busy && !photoBusy && (editId || all || picked.size > 0);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError("");
    try {
      if (editId) {
        await updateRecommendation(editId, { category, title, note, url });
        toast(t("new.savedToast"));
        go(`/r/${editId}`);
      } else {
        await createRecommendation(me.id, {
          category,
          title,
          note,
          url,
          image,
          recipientIds: [...picked],
          all,
        });
        toast(t("new.sentToast"));
        go("/sent");
      }
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  };

  if (!loaded || (!editId && friends === null)) return <Spinner />;

  if (!editId && friends && friends.length === 0) {
    return (
      <section className="card stack">
        <h1>{t("new.title")}</h1>
        <p className="muted">{t("new.noFriends")}</p>
        <a className="btn primary" href="#/friends">
          {t("new.noFriendsCta")}
        </a>
      </section>
    );
  }

  return (
    <form className="stack-lg" onSubmit={onSubmit}>
      <h1>{t(editId ? "edit.title" : "new.title")}</h1>

      <fieldset className="field plain-fieldset">
        <legend>{t("new.category")}</legend>
        <div className="chips" role="radiogroup" aria-label={t("new.category")}>
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={category === c}
              className={`chip${category === c ? " on" : ""}`}
              onClick={() => setCategory(c)}
            >
              {t(`cat.${c}` as StringKey)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>{t("new.titleLabel")}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
      </label>

      <label className="field">
        <span>{t("new.note")}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={4} />
        <small className="muted">{note.length}/500</small>
      </label>

      <label className="field">
        <span>{t("new.link")}</span>
        <input
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={2000}
        />
      </label>

      {!editId && (
        <div className="field">
          <span>{t("new.photo")}</span>
          {preview && <img className="preview" src={preview} alt="" />}
          <div className="row">
            <label className="btn">
              {photoBusy ? t("new.photoBusy") : t("new.photoAdd")}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={photoBusy}
                onChange={(e) => {
                  void onPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {image && (
              <button type="button" className="btn" onClick={() => setImage(null)}>
                {t("new.photoRemove")}
              </button>
            )}
          </div>
        </div>
      )}

      {!editId && friends && (
        <fieldset className="field plain-fieldset">
          <legend>{t("new.recipients")}</legend>
          <label className="check">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            <span>{t("new.all", { n: friends.length })}</span>
          </label>
          {!all && (
            <ul className="plain list">
              {friends.map((f) => (
                <li key={f.id}>
                  <label className="item pickable">
                    <input
                      type="checkbox"
                      checked={picked.has(f.id)}
                      onChange={() => toggle(f.id)}
                    />
                    <Avatar username={f.username} name={f.display_name} />
                    <div className="grow">
                      <div className="name">{f.display_name}</div>
                      <div className="muted small">@{f.username}</div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <small className="muted">{t("new.recipientsNote")}</small>
        </fieldset>
      )}

      <ErrorLine>{error}</ErrorLine>
      <button className="btn primary" disabled={!canSend}>
        {busy ? t("new.sending") : t(editId ? "new.save" : "new.send")}
      </button>
    </form>
  );
}
