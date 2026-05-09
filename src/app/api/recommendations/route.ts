import axios from "axios";
import { NextResponse } from "next/server";

import { getOpenAIClient } from "../../../../lib/openai";
import { getSupabaseServiceClient } from "../../../../lib/supabase";
import { normalizeUserId } from "../../../../lib/user-id";

type TasteProfileRow = {
  liked: string[] | null;
  disliked: string[] | null;
  vibe_tags: string[] | null;
  top_moods: string[] | null;
  top_themes: string[] | null;
};

type BookRow = {
  title: string | null;
};

type ExaResult = {
  title?: string;
  author?: string;
  text?: string;
  snippet?: string;
  url?: string;
};

type ExaResponse = {
  results?: ExaResult[];
};

type Candidate = {
  title: string;
  author: string;
};

type Recommendation = {
  rank: number;
  title: string;
  author: string;
  reason: string;
  confidence: number;
};

type CatalogEntry = {
  title: string;
  author: string;
  tags: string[];
};

const EMPTY_PROFILE: TasteProfileRow = {
  liked: [],
  disliked: [],
  vibe_tags: [],
  top_moods: [],
  top_themes: [],
};

const FALLBACK_CATALOG: CatalogEntry[] = [
  {
    title: "The Animators",
    author: "Kayla Rae Whitaker",
    tags: ["friendship", "creative ambition", "grief", "games"],
  },
  {
    title: "The Amazing Adventures of Kavalier & Clay",
    author: "Michael Chabon",
    tags: ["friendship", "art", "play", "grief"],
  },
  {
    title: "Tomorrow, and Tomorrow, and Tomorrow",
    author: "Gabrielle Zevin",
    tags: ["friendship", "games", "grief"],
  },
  {
    title: "Station Eleven",
    author: "Emily St. John Mandel",
    tags: ["grief", "art", "friendship"],
  },
  {
    title: "Never Let Me Go",
    author: "Kazuo Ishiguro",
    tags: ["friendship", "grief", "lyrical"],
  },
  {
    title: "The Goldfinch",
    author: "Donna Tartt",
    tags: ["grief", "friendship", "introspective"],
  },
  {
    title: "Sea of Tranquility",
    author: "Emily St. John Mandel",
    tags: ["grief", "lyrical", "time"],
  },
  {
    title: "A Little Life",
    author: "Hanya Yanagihara",
    tags: ["friendship", "grief", "emotionally-wrecked"],
  },
  {
    title: "The Interestings",
    author: "Meg Wolitzer",
    tags: ["friendship", "art", "long-view"],
  },
  {
    title: "The House in the Cerulean Sea",
    author: "TJ Klune",
    tags: ["happy", "hopeful", "cozy", "found family", "warm"],
  },
  {
    title: "Legends & Lattes",
    author: "Travis Baldree",
    tags: ["happy", "cozy", "low-stakes", "comfort", "warm"],
  },
  {
    title: "The Very Secret Society of Irregular Witches",
    author: "Sangu Mandanna",
    tags: ["happy", "warm", "cozy", "found family", "romantic"],
  },
  {
    title: "A Psalm for the Wild-Built",
    author: "Becky Chambers",
    tags: ["hopeful", "gentle", "comfort", "philosophical", "cozy"],
  },
  {
    title: "Good Omens",
    author: "Terry Pratchett and Neil Gaiman",
    tags: ["funny", "happy", "witty", "light", "chaotic"],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampConfidence(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(1, Math.max(0, numberValue));
}

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function expandMoodTerms(moodOverride: string) {
  const normalized = moodOverride.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const synonyms: Record<string, string[]> = {
    cozy: ["cozy", "warm", "comfort", "gentle", "low-stakes"],
    funny: ["funny", "witty", "humorous", "light", "chaotic"],
    happy: ["happy", "joyful", "uplifting", "hopeful", "light", "warm", "comfort"],
    hopeful: ["hopeful", "uplifting", "warm", "gentle", "healing"],
    light: ["light", "fun", "easy", "uplifting", "hopeful"],
    sad: ["sad", "grief", "melancholy", "bittersweet", "emotional"],
    spooky: ["spooky", "gothic", "eerie", "atmospheric", "chilling"],
  };

  const matched = Object.entries(synonyms)
    .filter(([key]) => normalized.includes(key))
    .flatMap(([, values]) => values);

  return Array.from(new Set([normalized, ...matched]));
}

function isReadTitle(title: string, readTitles: string[]) {
  const normalizedTitle = normalizeTitle(title);

  return readTitles.some((readTitle) => normalizeTitle(readTitle) === normalizedTitle);
}

function mergeCandidates(existing: Candidate[], incoming: Candidate[], readTitles: string[]) {
  const seen = new Set(existing.map((candidate) => normalizeTitle(candidate.title)));
  const merged = [...existing];

  for (const candidate of incoming) {
    const normalizedTitle = normalizeTitle(candidate.title);

    if (!normalizedTitle || seen.has(normalizedTitle) || isReadTitle(candidate.title, readTitles)) {
      continue;
    }

    seen.add(normalizedTitle);
    merged.push(candidate);
  }

  return merged;
}

function hasTaste(profile: TasteProfileRow) {
  return [
    profile.liked,
    profile.disliked,
    profile.vibe_tags,
    profile.top_moods,
    profile.top_themes,
  ].some((items) => (items ?? []).length > 0);
}

function buildSearchQuery(params: {
  profile: TasteProfileRow;
  moodOverride: string;
  hasProfile: boolean;
}) {
  const liked = params.profile.liked ?? [];
  const vibeTags = params.profile.vibe_tags ?? [];
  const topThemes = params.profile.top_themes ?? [];
  const moodTerms = expandMoodTerms(params.moodOverride);

  if (!params.hasProfile || !hasTaste(params.profile)) {
    return moodTerms.length > 0
      ? `books for a ${params.moodOverride} mood: ${moodTerms.join(", ")} highly rated fiction`
      : "popular literary fiction fantasy thriller 2020s highly rated";
  }

  const query = `books matching reader taste themes: ${liked.slice(0, 4).join(", ")} vibe tags: ${vibeTags.join(", ")} book themes: ${topThemes.join(", ")}`;

  return moodTerms.length > 0
    ? `current mood request is "${params.moodOverride}" (${moodTerms.join(", ")}). Prioritize books that satisfy this mood while still matching taste. ${query}`
    : query;
}

async function logAgentRun(params: {
  durationMs: number;
  success: boolean;
  error?: string;
}) {
  try {
    const supabase = getSupabaseServiceClient();

    await supabase.from("agent_logs").insert({
      agent_name: "recommendation",
      trigger: "user_request_recommendations",
      duration_ms: params.durationMs,
      success: params.success,
      error: params.error ?? null,
    });
  } catch (error) {
    console.error("Failed to write recommendation agent log", error);
  }
}

async function searchExa(query: string) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing EXA_API_KEY.");
  }

  const response = await axios.post<ExaResponse>(
    "https://api.exa.ai/search",
    {
      query,
      numResults: 10,
      useAutoprompt: true,
      contents: {
        text: true,
      },
    },
    {
      headers: {
        "x-api-key": apiKey,
      },
    },
  );

  return response.data.results ?? [];
}

function exaResultsToContext(results: ExaResult[]) {
  return results
    .map((result, index) => {
      const title = result.title?.trim() || "Untitled result";
      const url = result.url?.trim() || "No URL";
      const text = (result.text ?? result.snippet ?? "").trim().slice(0, 1200);

      return `Result ${index + 1}
Page title: ${title}
URL: ${url}
Text: ${text}`;
    })
    .join("\n\n");
}

function normalizeCandidates(value: unknown, readTitles: string[]) {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    return [];
  }

  const candidates = value.candidates
    .filter(isRecord)
    .map((candidate): Candidate => ({
      title: typeof candidate.title === "string" ? candidate.title.trim() : "",
      author: typeof candidate.author === "string" ? candidate.author.trim() : "Unknown",
    }))
    .filter((candidate) => candidate.title.length > 0)
    .filter((candidate) => candidate.author.length > 0)
    .filter((candidate) => !isReadTitle(candidate.title, readTitles));

  return mergeCandidates([], candidates, readTitles);
}

async function extractCandidatesWithGpt(params: {
  exaResults: ExaResult[];
  readTitles: string[];
}) {
  const context = exaResultsToContext(params.exaResults);

  if (!context.trim()) {
    return [];
  }

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You extract real book titles and authors from search results. Return only valid JSON. No explanation, no markdown.",
      },
      {
        role: "user",
        content: `Extract actual books from these Exa search results.

Already read (exclude these): ${params.readTitles.join(", ")}

Search results:
${context}

Return this exact JSON:
{
  "candidates": [
    {
      "title": "real book title",
      "author": "book author"
    }
  ]
}

Rules:
- Extract only actual book titles, not article titles, forum titles, social posts, lists, websites, or videos.
- Use "Unknown" for author only if the search result names a real book but not its author.
- Return up to 10 candidates.
- Never include a title from the already-read list.`,
      },
    ],
  });

  const content = completion.choices[0]?.message.content;

  if (!content) {
    return [];
  }

  try {
    return normalizeCandidates(JSON.parse(content) as unknown, params.readTitles);
  } catch {
    return [];
  }
}

async function rankWithGpt(params: {
  profile: TasteProfileRow;
  moodOverride: string;
  readTitles: string[];
  candidates: Candidate[];
}) {
  const openai = getOpenAIClient();
  const liked = params.profile.liked ?? [];
  const disliked = params.profile.disliked ?? [];
  const vibeTags = params.profile.vibe_tags ?? [];
  const moodTerms = expandMoodTerms(params.moodOverride);
  const moodLine = params.moodOverride
    ? `- Today's mood override: ${params.moodOverride}
- Mood expansion: ${moodTerms.join(", ")}
- Treat this as a strong steering signal. Do not ignore it unless no candidate fits it.`
    : "";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a book recommendation engine. Return only valid JSON. No explanation, no markdown.",
      },
      {
        role: "user",
        content: `Rank the best 5 books from the candidates list for this reader.

Reader taste profile:
- Loved: ${liked.join(", ")}
- Disliked: ${disliked.join(", ")}
- Favourite moods: ${vibeTags.join(", ")}
${moodLine}

Already read (exclude these): ${params.readTitles.join(", ")}

Candidates:
${JSON.stringify(params.candidates)}

Return this exact JSON:
{
  "recommendations": [
    {
      "rank": 1,
      "title": "string",
      "author": "string",
      "reason": "max 200 characters - must reference a specific element from the reader's taste profile",
      "confidence": 0.0
    }
  ]
}

Rules:
- Return exactly 5 items ranked 1 to 5
- If Today's mood override is present, each reason should explain how the book fits that mood and connect it to taste profile
- If no mood override is present, reason must mention at least one word from liked[] or vibe_tags[]
- never write a generic reason
- confidence is 0.0 to 1.0
- Never include a title from the already-read list`,
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

function normalizeRecommendations(value: unknown, readTitles: string[]) {
  if (!isRecord(value) || !Array.isArray(value.recommendations)) {
    return [];
  }

  const recommendations = value.recommendations
    .filter(isRecord)
    .map((item, index): Recommendation => ({
      rank: typeof item.rank === "number" && Number.isInteger(item.rank)
        ? item.rank
        : index + 1,
      title: typeof item.title === "string" ? item.title.trim() : "",
      author: typeof item.author === "string" ? item.author.trim() : "Unknown",
      reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 200) : "",
      confidence: clampConfidence(item.confidence),
    }))
    .filter((recommendation) => recommendation.title.length > 0)
    .filter((recommendation) => !isReadTitle(recommendation.title, readTitles));

  if (recommendations.length !== 5) {
    console.warn(`Recommendation agent returned ${recommendations.length} recommendations instead of 5.`);
  }

  return recommendations.map((recommendation, index) => ({
    ...recommendation,
    rank: index + 1,
  }));
}

function rankFallbackRecommendations(params: {
  profile: TasteProfileRow;
  readTitles: string[];
  moodOverride: string;
}) {
  const tasteTerms = [
    ...(params.profile.liked ?? []),
    ...(params.profile.vibe_tags ?? []),
    ...(params.profile.top_themes ?? []),
    ...expandMoodTerms(params.moodOverride),
  ]
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

  const scored = FALLBACK_CATALOG
    .filter((entry) => !isReadTitle(entry.title, params.readTitles))
    .map((entry) => {
      const matched = tasteTerms.filter((term) => (
        entry.tags.some((tag) => tag.includes(term) || term.includes(tag))
      ));
      const moodTerms = expandMoodTerms(params.moodOverride);
      const moodMatched = moodTerms.filter((term) => (
        entry.tags.some((tag) => tag.includes(term) || term.includes(tag))
      ));
      const primarySignal = matched[0] ?? entry.tags[0];
      const confidence = Math.min(0.95, 0.58 + matched.length * 0.06 + moodMatched.length * 0.08);

      return {
        title: entry.title,
        author: entry.author,
        reason: params.moodOverride
          ? `You asked for ${params.moodOverride}; this leans ${primarySignal} without abandoning your usual taste signals.`
          : `Your pull toward ${primarySignal} points here too, with the same emotional spillover.`,
        confidence,
        score: matched.length + moodMatched.length * 2,
      };
    })
    .sort((left, right) => right.score - left.score || right.confidence - left.confidence)
    .slice(0, 5);

  return scored.map((entry, index) => ({
    rank: index + 1,
    title: entry.title,
    author: entry.author,
    reason: entry.reason.slice(0, 200),
    confidence: clampConfidence(entry.confidence),
  }));
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get("user_id")?.trim() ?? "";
    const userId = rawUserId ? normalizeUserId(rawUserId) : "";
    const moodOverride = searchParams.get("mood_override")?.trim() ?? "";

    if (!userId) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "invalid_request",
      });

      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: profileRow, error: profileError } = await supabase
      .from("taste_profile")
      .select("liked, disliked, vibe_tags, top_moods, top_themes")
      .eq("user_id", userId)
      .maybeSingle<TasteProfileRow>();

    if (profileError) {
      throw profileError;
    }

    const profile: TasteProfileRow = profileRow ?? EMPTY_PROFILE;
    const hasTasteProfile = profileRow !== null && hasTaste(profile);

    if (!hasTasteProfile) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: true,
      });

      return NextResponse.json({
        has_taste_profile: false,
        recommendations: [],
      }, { status: 200 });
    }

    const { data: books, error: booksError } = await supabase
      .from("books")
      .select("title")
      .eq("user_id", userId);

    if (booksError) {
      throw booksError;
    }

    const readTitles = ((books ?? []) as BookRow[])
      .map((book) => book.title)
      .filter((title): title is string => typeof title === "string" && title.trim().length > 0);
    const query = buildSearchQuery({
      profile,
      moodOverride,
      hasProfile: hasTasteProfile,
    });
    let recommendations: Recommendation[] = [];

    try {
      const firstResults = await searchExa(query);
      let candidates = await extractCandidatesWithGpt({
        exaResults: firstResults,
        readTitles,
      });

      if (candidates.length < 3) {
        const moodTerms = expandMoodTerms(moodOverride);
        const fallbackQuery = moodTerms.length > 0
          ? `best ${moodOverride} books ${moodTerms.join(" ")}`
          : `best books ${(profile.vibe_tags ?? [])[0] ?? ""}`.trim();
        const fallbackResults = await searchExa(fallbackQuery);
        candidates = mergeCandidates(
          candidates,
          await extractCandidatesWithGpt({
            exaResults: fallbackResults,
            readTitles,
          }),
          readTitles,
        );
      }

      const rawRankings = await rankWithGpt({
        profile,
        moodOverride,
        readTitles,
        candidates,
      });
      recommendations = normalizeRecommendations(rawRankings, readTitles);
    } catch (error) {
      console.error("Primary recommendation flow failed", error);
    }

    if (recommendations.length < 5) {
      recommendations = rankFallbackRecommendations({
        profile,
        readTitles,
        moodOverride,
      });
    }

    const { error: deleteError } = await supabase
      .from("recommendations")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      throw deleteError;
    }

    if (recommendations.length > 0) {
      const { error: insertError } = await supabase
        .from("recommendations")
        .insert(recommendations.map((recommendation) => ({
          user_id: userId,
          rank: recommendation.rank,
          title: recommendation.title,
          author: recommendation.author,
          reason: recommendation.reason,
          confidence: recommendation.confidence,
        })));

      if (insertError) {
        throw insertError;
      }
    }

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return NextResponse.json({
      has_taste_profile: true,
      recommendations,
    }, { status: 200 });
  } catch (error) {
    console.error("Recommendation agent failed", error);

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : "internal_error",
    });

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
