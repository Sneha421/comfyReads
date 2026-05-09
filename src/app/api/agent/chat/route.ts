import { NextResponse } from "next/server";

import { getOpenAIClient } from "../../../../../lib/openai";
import { getSupabaseServiceClient } from "../../../../../lib/supabase";
import { normalizeUserId } from "../../../../../lib/user-id";

type ChatMessage = {
  role?: unknown;
  content?: unknown;
};

type AgentChatRequest = {
  user_id?: unknown;
  messages?: unknown;
};

type BookRow = {
  title: string | null;
  author: string | null;
  genre: string[] | null;
  mood: string[] | null;
  themes: string[] | null;
};

type ReviewRow = {
  rating: number | null;
  review_text: string | null;
  vibe_tags: string[] | null;
};

type TasteProfileRow = {
  liked: string[] | null;
  disliked: string[] | null;
  vibe_tags: string[] | null;
  top_moods: string[] | null;
  top_themes: string[] | null;
};

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((message): message is ChatMessage => (
      typeof message === "object" && message !== null
    ))
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" as const : "user" as const,
      content: typeof message.content === "string" ? message.content.slice(0, 1200) : "",
    }))
    .filter((message) => message.content.trim().length > 0)
    .slice(-10);
}

function compactList(values: Array<string | null | undefined>, fallback = "none") {
  const cleanValues = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  return cleanValues.length > 0 ? cleanValues.join(", ") : fallback;
}

function fallbackReply(message: string) {
  const lowered = message.toLowerCase();

  if (lowered.includes("recommend")) {
    return "I can help with recommendations, but the model is unavailable right now. Try the For You shelf; it has fewer opinions and more API access.";
  }

  if (lowered.includes("review")) {
    return "For a review, start with what the book made you feel, then name one thing it did too much. Taste hides in the complaint.";
  }

  return "I can chat about your shelf, reviews, and reading taste once the model is available. For now, I remain decorative but well-labelled.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentChatRequest;
    const rawUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const userId = rawUserId ? normalizeUserId(rawUserId) : "";
    const messages = normalizeMessages(body.messages);

    if (!userId || messages.length === 0) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const [{ data: books }, { data: reviews }, { data: profile }] = await Promise.all([
      supabase
        .from("books")
        .select("title, author, genre, mood, themes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("reviews")
        .select("rating, review_text, vibe_tags")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("taste_profile")
        .select("liked, disliked, vibe_tags, top_moods, top_themes")
        .eq("user_id", userId)
        .maybeSingle<TasteProfileRow>(),
    ]);
    const bookRows = (books ?? []) as BookRow[];
    const reviewRows = (reviews ?? []) as ReviewRow[];
    const tasteProfile = profile as TasteProfileRow | null;
    const context = `Shelf:
${bookRows.map((book) => `- ${book.title ?? "Untitled"} by ${book.author ?? "unknown"} | genre: ${(book.genre ?? []).join(", ")} | mood: ${(book.mood ?? []).join(", ")} | themes: ${(book.themes ?? []).join(", ")}`).join("\n")}

Recent reviews:
${reviewRows.map((review) => `- ${review.rating ?? "?"}/5 | tags: ${(review.vibe_tags ?? []).join(", ")} | ${review.review_text ?? ""}`).join("\n")}

Taste profile:
- liked: ${compactList(tasteProfile?.liked ?? [])}
- disliked: ${compactList(tasteProfile?.disliked ?? [])}
- vibe tags: ${compactList(tasteProfile?.vibe_tags ?? [])}
- moods: ${compactList(tasteProfile?.top_moods ?? [])}
- themes: ${compactList(tasteProfile?.top_themes ?? [])}`;

    try {
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are Shelf Agent, the single chat agent inside ComfyReads.
Speak directly to the user as "you".
Use short sentences. Dry wit is fine. No exclamation marks.
Help with reading taste, shelf choices, review ideas, friend/group reading, recommendations, and music recommendations based on the user's shelf.
Use the provided shelf context. If you are missing data, say so plainly.
Do not pretend to modify the database or add books.`,
          },
          {
            role: "system",
            content: `When the user asks for music:
- Recommend music from shelf mood, review text, vibe tags, genres, and themes.
- Prefer albums, artists, or playlist directions over single isolated songs.
- Give 4-6 recommendations.
- For each one, include a short reason tied to a book mood, theme, or review signal.
- Keep it practical enough that the user could search it in a music app.
- Do not claim these are generated from Spotify or Apple Music data.`,
          },
          {
            role: "system",
            content: context,
          },
          ...messages,
        ],
        temperature: 0.8,
      });

      const reply = completion.choices[0]?.message.content?.trim();

      return NextResponse.json({
        reply: reply || fallbackReply(messages[messages.length - 1].content),
      }, { status: 200 });
    } catch (error) {
      console.error("Shelf Agent model call failed", error);

      return NextResponse.json({
        reply: fallbackReply(messages[messages.length - 1].content),
        fallback: true,
      }, { status: 200 });
    }
  } catch (error) {
    console.error("Shelf Agent failed", error);

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
