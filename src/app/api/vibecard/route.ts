import { NextResponse } from "next/server";

import { getOpenAIClient } from "../../../../lib/openai";
import { getSupabaseServiceClient } from "../../../../lib/supabase";
import { normalizeUserId } from "../../../../lib/user-id";

type VibeCardRequest = {
  user_id?: unknown;
};

type ReviewRow = {
  book_id: string | null;
  rating: number | null;
  review_text: string | null;
  vibe_tags: string[] | null;
  quote_for_vibe_card: string | null;
};

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  mood: string[] | null;
};

type Palette = {
  name: string;
  bg: string;
  accent: string;
  text: string;
};

type ReaderCardProfile = {
  archetype: string;
  headline: string;
  quote: string;
};

const DUSK_PALETTE: Palette = {
  name: "Dusk",
  bg: "#11111f",
  accent: "#7b7fc4",
  text: "#f5f0e8",
};

const PALETTES: Array<{
  keywords: string[];
  palette: Palette;
}> = [
  {
    keywords: ["epic", "dark", "grief", "intense"],
    palette: {
      name: "Ember",
      bg: "#160b10",
      accent: "#c0392b",
      text: "#f5f0e8",
    },
  },
  {
    keywords: ["cozy", "warm", "friendship"],
    palette: {
      name: "Hearthside",
      bg: "#2b1d16",
      accent: "#d4a574",
      text: "#f5e6d3",
    },
  },
  {
    keywords: ["lyrical", "introspective", "thoughtful"],
    palette: DUSK_PALETTE,
  },
  {
    keywords: ["thriller", "tense", "chilling"],
    palette: {
      name: "Midnight",
      bg: "#0b0d13",
      accent: "#e74c3c",
      text: "#e8e8f0",
    },
  },
  {
    keywords: ["light", "fun", "adventure"],
    palette: {
      name: "Lantern",
      bg: "#1d1728",
      accent: "#f0c040",
      text: "#fff9e6",
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTags(values: Array<string[] | null>) {
  return values
    .flatMap((value) => value ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function countTopTags(tags: string[], limit = 4) {
  const counts = new Map<string, number>();

  tags.forEach((tag) => {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function selectPalette(tags: string[]) {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  const match = PALETTES.find(({ keywords }) => (
    normalizedTags.some((tag) => keywords.some((keyword) => tag.includes(keyword)))
  ));

  return match?.palette ?? DUSK_PALETTE;
}

function normalizeQuote(value: unknown) {
  const quote = typeof value === "string" ? value.trim() : "";

  if (!quote) {
    return "";
  }

  if (quote.length <= 140) {
    return quote;
  }

  return `${quote.slice(0, 137)}...`;
}

function normalizeCardText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function normalizeReaderProfile(value: unknown, fallback: ReaderCardProfile): ReaderCardProfile {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    archetype: normalizeCardText(value.archetype, fallback.archetype, 26),
    headline: normalizeCardText(value.headline, fallback.headline, 82),
    quote: normalizeQuote(value.quote) || fallback.quote,
  };
}

function buildCardHtml(params: {
  profile: ReaderCardProfile;
  palette: Palette;
  topTags: string[];
  books: BookRow[];
  averageRating: number;
  reviewCount: number;
}) {
  const displayBooks = params.books.slice(0, 4);
  const tagMarkup = params.topTags.length > 0
    ? params.topTags.map((tag) => `<span style="border:1px solid ${params.palette.accent};border-radius:999px;padding:8px 14px;font-size:14px;color:${params.palette.text};background:rgba(255,255,255,.08);">${escapeHtml(tag)}</span>`).join("")
    : `<span style="border:1px solid ${params.palette.accent};border-radius:999px;padding:8px 14px;font-size:14px;color:${params.palette.text};background:rgba(255,255,255,.08);">still forming</span>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=1200, initial-scale=1">
    <title>ComfyReads Reader Vibe Card</title>
  </head>
  <body style="margin:0;">
    <div style="position:relative;width:1200px;height:630px;overflow:hidden;background:${params.palette.bg};color:${params.palette.text};font-family:Inter,system-ui,sans-serif;">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.08),transparent 36%),repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 78px);"></div>
      <div style="position:absolute;inset:-150px auto auto -90px;width:420px;height:420px;border-radius:999px;background:${params.palette.accent};opacity:.3;filter:blur(20px);"></div>
      <div style="position:absolute;right:-130px;bottom:-160px;width:520px;height:520px;border-radius:999px;background:${params.palette.accent};opacity:.18;filter:blur(22px);"></div>
      <div style="position:absolute;top:44px;left:62px;right:62px;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:14px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${params.palette.accent};">Reader Vibe Card</div>
        <div style="font-size:14px;color:${params.palette.text};opacity:.78;">ComfyReads</div>
      </div>
      <main style="position:absolute;left:62px;right:62px;top:92px;bottom:62px;display:grid;grid-template-columns:1.06fr .94fr;gap:42px;align-items:stretch;">
        <section style="display:flex;flex-direction:column;justify-content:space-between;border:1px solid rgba(255,255,255,.14);border-radius:34px;padding:38px;background:rgba(255,255,255,.06);box-shadow:0 28px 70px rgba(0,0,0,.28);">
          <div>
            <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${params.palette.accent};">Your archetype</div>
            <h1 style="margin:14px 0 0;font-family:'Playfair Display',Georgia,serif;font-size:50px;line-height:.98;letter-spacing:-1.5px;color:${params.palette.text};">
              ${escapeHtml(params.profile.archetype)}
            </h1>
            <p style="margin:22px 0 0;max-width:560px;font-size:20px;line-height:1.45;color:${params.palette.text};opacity:.82;">
              ${escapeHtml(params.profile.headline)}
            </p>
          </div>
          <blockquote style="margin:34px 0 0;border-left:4px solid ${params.palette.accent};padding-left:22px;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:28px;line-height:1.32;color:${params.palette.text};">
            ${escapeHtml(params.profile.quote)}
          </blockquote>
        </section>
        <section style="display:grid;grid-template-rows:auto 1fr auto;gap:18px;">
          <div style="border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:24px;background:rgba(255,255,255,.07);">
            <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${params.palette.accent};">Vibe ingredients</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;">
              ${tagMarkup}
            </div>
          </div>
          <div style="border:1px solid rgba(255,255,255,.14);border-radius:28px;padding:24px;background:rgba(255,255,255,.07);">
            <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${params.palette.accent};">Books in the signal</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:end;margin-top:24px;height:170px;">
              ${displayBooks.map((book, index) => `<div style="height:${116 + index * 14}px;border:2px solid rgba(255,255,255,.16);border-radius:14px 14px 8px 8px;background:linear-gradient(180deg,${params.palette.accent},rgba(255,255,255,.12));box-shadow:0 14px 28px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;padding:10px;"><div style="font-size:10px;font-weight:800;letter-spacing:1px;line-height:1.1;text-align:center;text-transform:uppercase;color:${params.palette.bg};writing-mode:vertical-rl;">${escapeHtml(book.title)}</div></div>`).join("")}
            </div>
            <div style="height:10px;border-radius:999px;background:${params.palette.accent};box-shadow:0 10px 20px rgba(0,0,0,.25);"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div style="border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:18px;background:rgba(255,255,255,.07);">
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${params.palette.accent};">Reviews read</div>
              <div style="margin-top:8px;font-family:'Playfair Display',Georgia,serif;font-size:38px;line-height:1;color:${params.palette.text};">${params.reviewCount}</div>
            </div>
            <div style="border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:18px;background:rgba(255,255,255,.07);">
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${params.palette.accent};">Avg rating</div>
              <div style="margin-top:8px;font-family:'Playfair Display',Georgia,serif;font-size:38px;line-height:1;color:${params.palette.text};">${params.averageRating.toFixed(1)}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </body>
</html>`;
}

async function logAgentRun(params: {
  durationMs: number;
  success: boolean;
  error?: string;
}) {
  try {
    const supabase = getSupabaseServiceClient();

    await supabase.from("agent_logs").insert({
      agent_name: "vibe_card_generator",
      trigger: "reader_vibe_card_requested",
      duration_ms: params.durationMs,
      success: params.success,
      error: params.error ?? null,
    });
  } catch (error) {
    console.error("Failed to write vibe_card_generator agent log", error);
  }
}

async function generateReaderProfile(params: {
  books: BookRow[];
  reviews: ReviewRow[];
  topTags: string[];
}) {
  const openai = getOpenAIClient();
  const bookList = params.books
    .slice(0, 8)
    .map((book) => `${book.title} by ${book.author ?? "unknown author"}`)
    .join("; ");
  const reviewSignals = params.reviews
    .slice(0, 8)
    .map((review) => {
      const tags = (review.vibe_tags ?? []).join(", ");
      const quote = review.quote_for_vibe_card ?? "";

      return `${review.rating ?? 0}/5 | tags: ${tags} | review: ${review.review_text ?? ""} | extracted quote: ${quote}`;
    })
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Return only valid JSON. No markdown.",
      },
      {
        role: "user",
        content: `Generate a reader-level vibe card profile from the books this person has read and reviewed.
Books: ${bookList}
Top vibe tags: ${params.topTags.join(", ")}
Review evidence:
${reviewSignals}

Rules:
- Base this on the reviews, extracted vibe tags, ratings, and book moods.
- Use second person.
- Dry wit is fine. No cheerleader language.
- Do not mention specific book titles in the quote.
- Keep it vivid and shareable.

Return:
{
  "archetype": "2-3 word reader archetype, max 26 chars",
  "headline": "one sentence explaining their taste, max 82 chars",
  "quote": "one vivid second-person sentence, max 140 chars, no book titles"
}`,
      },
    ],
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return "";
  }

  try {
    const parsed = JSON.parse(content) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function fallbackProfile(topTags: string[]): ReaderCardProfile {
  const [firstTag, secondTag] = topTags;

  if (firstTag && secondTag) {
    return {
      archetype: "The Soft Ruin",
      headline: `You keep choosing ${firstTag} and ${secondTag}. Subtle. Not invisible.`,
      quote: `You collect ${firstTag} and ${secondTag}, then pretend that was a casual reading phase.`,
    };
  }

  if (firstTag) {
    return {
      archetype: "The Signal Chaser",
      headline: `Your shelf keeps circling ${firstTag}. The pattern has receipts.`,
      quote: `You keep choosing ${firstTag}, which is either taste or a warning label.`,
    };
  }

  return {
    archetype: "The Mood Reader",
    headline: "Your reviews care about feeling first. The spreadsheet can cope.",
    quote: "You read for the feeling first. The spreadsheet can cope.",
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as VibeCardRequest;
    const rawUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const userId = rawUserId ? normalizeUserId(rawUserId) : "";

    if (!userId) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "invalid_request",
      });

      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select("book_id, rating, review_text, vibe_tags, quote_for_vibe_card")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (reviewsError) {
      throw reviewsError;
    }

    const reviewRows = (reviews ?? []) as ReviewRow[];
    const bookIds = Array.from(new Set(
      reviewRows
        .map((review) => review.book_id)
        .filter((bookId): bookId is string => typeof bookId === "string" && bookId.length > 0),
    ));

    if (reviewRows.length === 0 || bookIds.length === 0) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "no_reader_signal",
      });

      return NextResponse.json({ error: "no_reader_signal" }, { status: 404 });
    }

    const { data: books, error: booksError } = await supabase
      .from("books")
      .select("id, title, author, mood")
      .in("id", bookIds);

    if (booksError) {
      throw booksError;
    }

    const bookRows = (books ?? []) as BookRow[];
    const topTags = countTopTags([
      ...normalizeTags(reviewRows.map((review) => review.vibe_tags)),
      ...normalizeTags(bookRows.map((book) => book.mood)),
    ]);
    const palette = selectPalette(topTags);
    const fallback = fallbackProfile(topTags);
    const generatedProfile = await generateReaderProfile({
      books: bookRows,
      reviews: reviewRows,
      topTags,
    }).catch((error) => {
      console.error("Reader vibe profile generation failed", error);
      return null;
    });
    const profile = normalizeReaderProfile(generatedProfile, fallback);
    const averageRating = reviewRows.reduce((sum, review) => sum + (review.rating ?? 0), 0) / reviewRows.length;
    const html = buildCardHtml({
      profile,
      palette,
      topTags,
      books: bookRows,
      averageRating,
      reviewCount: reviewRows.length,
    });

    await supabase
      .from("vibe_cards")
      .delete()
      .eq("user_id", userId);

    const { error: insertError } = await supabase
      .from("vibe_cards")
      .insert({
        user_id: userId,
        book_id: null,
        review_id: null,
        quote: profile.quote,
        palette: palette.name,
      });

    if (insertError) {
      throw insertError;
    }

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return NextResponse.json({
      html,
      palette: palette.name,
      quote: profile.quote,
      archetype: profile.archetype,
      headline: profile.headline,
      top_tags: topTags,
    }, { status: 200 });
  } catch (error) {
    console.error("Vibe card generation failed", error);

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : "internal_error",
    });

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
