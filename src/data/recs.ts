import { supabase } from "./client";
import { IMAGE_BUCKET, check, profilesByIds, toError } from "./api";
import { ApiError, type Profile } from "./types";

export const CATEGORIES = [
  "movie_tv",
  "music",
  "book",
  "food",
  "place",
  "product",
  "app",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Rec = {
  id: string;
  authorId: string;
  category: Category;
  title: string;
  note: string | null;
  url: string | null;
  imagePath: string | null;
  createdAt: string;
  recipientIds: string[];
  unread: boolean;
  author: Profile | null;
  /** same order as recipientIds; null = profile not visible to me */
  recipients: (Profile | null)[];
};

type Row = {
  id: string;
  author_id: string;
  category: Category;
  title: string;
  note: string | null;
  url: string | null;
  image_path: string | null;
  created_at: string;
  recommendation_recipients: { recipient_id: string }[];
  rec_reads: { read_at: string }[];
};

const SELECT =
  "id, author_id, category, title, note, url, image_path, created_at, " +
  "recommendation_recipients(recipient_id), rec_reads(read_at)";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hydrate(rows: Row[], me: string): Promise<Rec[]> {
  const ids: string[] = [];
  for (const r of rows) {
    ids.push(r.author_id);
    for (const x of r.recommendation_recipients) ids.push(x.recipient_id);
  }
  const people = new Map((await profilesByIds(ids)).map((p) => [p.id, p]));
  return rows.map((r) => {
    const recipientIds = r.recommendation_recipients.map((x) => x.recipient_id);
    return {
      id: r.id,
      authorId: r.author_id,
      category: r.category,
      title: r.title,
      note: r.note,
      url: r.url,
      imagePath: r.image_path,
      createdAt: r.created_at,
      recipientIds,
      unread: r.author_id !== me && r.rec_reads.length === 0,
      author: people.get(r.author_id) ?? null,
      recipients: recipientIds.map((id) => people.get(id) ?? null),
    };
  });
}

export const PAGE_SIZE = 30;

/** Recommendations sent TO me (RLS also requires I'm still friends with the author). */
export async function listInbox(me: string, before?: string): Promise<Rec[]> {
  let q = supabase
    .from("recommendations")
    .select(SELECT)
    .neq("author_id", me)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) q = q.lt("created_at", before);
  return hydrate(check(await q) as unknown as Row[], me);
}

export async function listSent(me: string, before?: string): Promise<Rec[]> {
  let q = supabase
    .from("recommendations")
    .select(SELECT)
    .eq("author_id", me)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (before) q = q.lt("created_at", before);
  return hydrate(check(await q) as unknown as Row[], me);
}

export async function getRec(id: string, me: string): Promise<Rec | null> {
  if (!UUID_RE.test(id)) return null;
  const res = await supabase.from("recommendations").select(SELECT).eq("id", id).maybeSingle();
  const row = check(res) as unknown as Row | null;
  if (!row) return null;
  return (await hydrate([row], me))[0];
}

export type NewRec = {
  category: Category;
  title: string;
  note: string;
  url: string;
  image: Blob | null;
  recipientIds: string[];
  all: boolean;
};

export async function createRecommendation(me: string, input: NewRec): Promise<string> {
  let path: string | null = null;
  const bucket = supabase.storage.from(IMAGE_BUCKET);

  if (input.image) {
    const ext = input.image.type === "image/webp" ? "webp" : "jpg";
    path = `${me}/${crypto.randomUUID()}.${ext}`;
    const up = await bucket.upload(path, input.image, {
      contentType: input.image.type,
      upsert: false,
    });
    if (up.error) throw new ApiError("image_failed", up.error.message);
  }

  try {
    const id = check(
      await supabase.rpc("create_recommendation", {
        p_category: input.category,
        p_title: input.title,
        p_note: input.note,
        p_url: input.url,
        p_image_path: path,
        p_recipients: input.recipientIds,
        p_all: input.all,
      }),
    ) as string;
    return id;
  } catch (e) {
    if (path) await bucket.remove([path]).catch(() => {});
    throw e instanceof ApiError ? e : toError(e as Error);
  }
}

export async function updateRecommendation(
  id: string,
  f: { category: Category; title: string; note: string; url: string },
): Promise<void> {
  check(
    await supabase
      .from("recommendations")
      .update({
        category: f.category,
        title: f.title.trim(),
        note: f.note.trim() || null,
        url: f.url.trim() || null,
      })
      .eq("id", id),
  );
}

export async function deleteRecommendation(rec: Pick<Rec, "id" | "imagePath">): Promise<void> {
  check(await supabase.from("recommendations").delete().eq("id", rec.id));
  if (rec.imagePath) {
    await supabase.storage
      .from(IMAGE_BUCKET)
      .remove([rec.imagePath])
      .catch(() => {});
  }
}

export async function markRead(id: string): Promise<void> {
  check(await supabase.rpc("mark_read", { p_rec: id }));
}

export async function unreadCount(): Promise<number> {
  return (check(await supabase.rpc("unread_count")) as number) ?? 0;
}

/** Short-lived signed link for a private image. */
export async function imageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}
