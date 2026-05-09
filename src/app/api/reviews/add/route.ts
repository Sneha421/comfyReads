import { NextResponse } from "next/server";

import { awardXP } from "../../../../../lib/gamification";
import { getOpenAIClient } from "../../../../../lib/openai";
import { getSupabaseServiceClient } from "../../../../../lib/supabase";
import { normalizeUserId } from "../../../../../lib/user-id";

type AddReviewRequest = {
  book_id?: unknown;
  user_id?: unknown;
  rating?: unknown;
  review_text?: unknown;
};

type BookRow = {
  title: string;
  author: string | null;
  genre: string[] | null;
  mood: string[] | null;
  themes: string[] | null;
};

type TasteProfileRow = {
  liked: string[] | null;
  disliked: string[] | null;
  vibe_tags: string[] | null;
};

type ReviewSignals = {
  liked: string[];
  disliked: string[];
  vibe_tags: string[];
  emotional_intensity: number;
  quote_for_vibe_card: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeArray(value: unknown, limit?: number) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];

  const normalized = items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return typeof limit === "number" ? normalized.slice(0, limit) : normalized;
}

function uniqueAppend(existing: string[] | null, incoming: string[]) {
  return Array.from(new Set([...(existing ?? []), ...incoming]));
}

function clampIntensity(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(1, Math.max(0, numberValue));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuote(value: unknown, title: string) {
  const quote = typeof value === "string" ? value.trim() : "";
  const withoutTitle = quote.replace(new RegExp(escapeRegExp(title), "gi"), "").trim();

  if (!withoutTitle) {
    return "";
  }

  if (withoutTitle.length <= 140) {
    return withoutTitle;
  }

  return `${withoutTitle.slice(0, 137)}...`;
}

function normalizeSignals(value: unknown, title: string): ReviewSignals {
  if (!isRecord(value)) {
    return {
      liked: [],
      disliked: [],
      vibe_tags: [],
      emotional_intensity: 0,
      quote_for_vibe_card: "",
    };
  }

  return {
    liked: normalizeArray(value.liked),
    disliked: normalizeArray(value.disliked),
    vibe_tags: normalizeArray(value.vibe_tags, 3),
    emotional_intensity: clampIntensity(value.emotional_intensity),
    quote_for_vibe_card: normalizeQuote(value.quote_for_vibe_card, title),
  };
}

function buildFallbackReviewSignals(params: {
  rating: number;
  reviewText: string;
}) {
  const loweredText = params.reviewText.toLowerCase();
  const liked: string[] = [];
  const disliked: string[] = [];
  const vibeTags: string[] = [];

  const keywordSignals = [
    { needle: "friendship", signal: "friendship", vibeTag: "friendship-heavy" },
    { needle: "grief", signal: "grief", vibeTag: "grief-laced" },
    { needle: "video game", signal: "video games", vibeTag: "game-literate" },
    { needle: "games", signal: "video games", vibeTag: "game-literate" },
    { needle: "feel", signal: "emotional punch", vibeTag: "emotionally-wrecked" },
    { needle: "deeply", signal: "emotional punch", vibeTag: "emotionally-wrecked" },
  ];

  for (const keywordSignal of keywordSignals) {
    if (!loweredText.includes(keywordSignal.needle)) {
      continue;
    }

    if (params.rating >= 4) {
      liked.push(keywordSignal.signal);
    } else if (params.rating <= 2) {
      disliked.push(keywordSignal.signal);
    }

    vibeTags.push(keywordSignal.vibeTag);
  }

  const firstSentence = params.reviewText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .find(Boolean) ?? "";
  const quote = firstSentence.length > 0
    ? firstSentence
    : params.rating >= 4
      ? "You felt this one land harder than expected."
      : "You were not buying what this one was selling.";

  return {
    liked: Array.from(new Set(liked)).slice(0, 4),
    disliked: Array.from(new Set(disliked)).slice(0, 4),
    vibe_tags: Array.from(new Set(vibeTags)).slice(0, 3),
    emotional_intensity: loweredText.includes("deeply") || loweredText.includes("grief") ? 0.9 : 0.65,
    quote_for_vibe_card: quote,
  };
}

async function logAgentRun(params: {
  durationMs: number;
  success: boolean;
  error?: string;
}) {
  try {
    const supabase = getSupabaseServiceClient();

    await supabase.from("agent_logs").insert({
      agent_name: "review_analysis",
      trigger: "user_submit_review",
      duration_ms: params.durationMs,
      success: params.success,
      error: params.error ?? null,
    });
  } catch (error) {
    console.error("Failed to write review_analysis agent log", error);
  }
}

async function extractReviewSignals(params: {
  book: BookRow;
  rating: number;
  reviewText: string;
}) {
  const openai = getOpenAIClient();
  const author = params.book.author ?? "unknown author";
  const genre = params.book.genre?.join(", ") ?? "";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a reading taste analyser. Return only valid JSON. No explanation, no markdown.",
      },
      {
        role: "user",
        content: `A reader has reviewed a book. Extract their taste signals.

Book: ${params.book.title} by ${author}
Genre: ${genre}
Rating: ${params.rating}/5
Review: "${params.reviewText}"

Return this exact JSON:
{
  "liked": ["specific elements they enjoyed - empty array if nothing mentioned"],
  "disliked": ["specific elements they disliked - empty array if nothing mentioned"],
  "vibe_tags": ["1 to 3 short evocative tags like cozy-epic, brain-full, emotionally-wrecked"],
  "emotional_intensity": 0.0,
  "quote_for_vibe_card": "One vivid sentence in the reader's voice, max 140 characters, no book title"
}

Rules:
- If rating is 1 or 2, disliked[] must be populated if review text gives any signal
- If rating is 4 or 5, liked[] must be populated if review text gives any signal
- emotional_intensity is a float from 0.0 (analytical) to 1.0 (deeply emotional)
- quote_for_vibe_card must not contain the book title
- vibe_tags maximum 3 items`,
      },
    ],
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as AddReviewRequest;
    const bookId = typeof body.book_id === "string" ? body.book_id.trim() : "";
    const rawUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const userId = rawUserId ? normalizeUserId(rawUserId) : "";
    const reviewText = typeof body.review_text === "string"
      ? body.review_text.trim()
      : "";
    const rating = typeof body.rating === "number" ? body.rating : NaN;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "invalid_rating",
      });

      return NextResponse.json({ error: "invalid_rating" }, { status: 400 });
    }

    if (reviewText.length > 0 && reviewText.length < 10) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "review_too_short",
      });

      return NextResponse.json({ error: "review_too_short" }, { status: 400 });
    }

    if (!bookId || !userId) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "invalid_request",
      });

      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("title, author, genre, mood, themes")
      .eq("id", bookId)
      .maybeSingle<BookRow>();

    if (bookError) {
      throw bookError;
    }

    if (!book) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "book_not_found",
      });

      return NextResponse.json({ error: "book_not_found" }, { status: 404 });
    }

    const rawSignals = await extractReviewSignals({
      book,
      rating,
      reviewText,
    }).catch((error) => {
      console.error("Review signal extraction failed", error);
      return buildFallbackReviewSignals({
        rating,
        reviewText,
      });
    });
    const signals = normalizeSignals(rawSignals, book.title);

    const { data: insertedReview, error: reviewError } = await supabase
      .from("reviews")
      .insert({
        user_id: userId,
        book_id: bookId,
        rating,
        review_text: reviewText,
        liked: signals.liked,
        disliked: signals.disliked,
        vibe_tags: signals.vibe_tags,
        emotional_intensity: signals.emotional_intensity,
        quote_for_vibe_card: signals.quote_for_vibe_card,
      })
      .select()
      .single();

    if (reviewError) {
      throw reviewError;
    }

    const reviewWordCount = reviewText.split(/\s+/).filter(Boolean).length;
    const xpEvent = await awardXP(userId, reviewWordCount >= 50 ? "review_long" : "review_short");

    const { data: profile, error: profileError } = await supabase
      .from("taste_profile")
      .select("liked, disliked, vibe_tags")
      .eq("user_id", userId)
      .maybeSingle<TasteProfileRow>();

    if (profileError) {
      throw profileError;
    }

    if (profile) {
      const { error: updateProfileError } = await supabase
        .from("taste_profile")
        .update({
          liked: uniqueAppend(profile.liked, signals.liked),
          disliked: uniqueAppend(profile.disliked, signals.disliked),
          vibe_tags: uniqueAppend(profile.vibe_tags, signals.vibe_tags),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateProfileError) {
        throw updateProfileError;
      }
    } else {
      const { error: insertProfileError } = await supabase
        .from("taste_profile")
        .insert({
          user_id: userId,
          liked: signals.liked,
          disliked: signals.disliked,
          vibe_tags: signals.vibe_tags,
          top_moods: book.mood ?? [],
          top_themes: book.themes ?? [],
        });

      if (insertProfileError) {
        throw insertProfileError;
      }
    }

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return NextResponse.json({
      ...insertedReview,
      xp_event: xpEvent,
    }, { status: 200 });
  } catch (error) {
    console.error("Review analysis failed", error);

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : "internal_error",
    });

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
