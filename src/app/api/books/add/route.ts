import axios from "axios";
import { NextResponse } from "next/server";

import { awardXP } from "../../../../../lib/gamification";
import { getOpenAIClient } from "../../../../../lib/openai";
import { getSupabaseServiceClient } from "../../../../../lib/supabase";
import { normalizeUserId } from "../../../../../lib/user-id";

type AddBookRequest = {
  title?: unknown;
  author?: unknown;
  user_id?: unknown;
  status?: unknown;
};

type OpenLibraryDoc = {
  isbn?: string[];
  number_of_pages_median?: number;
  first_publish_year?: number;
  subject?: string[];
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
};

type ExaResult = {
  text?: string;
  snippet?: string;
  title?: string;
};

type ExaResponse = {
  results?: ExaResult[];
};

type GptMetadata = {
  genre: string[] | null;
  mood: string[] | null;
  themes: string[] | null;
  setting: string | null;
  pacing: "slow-burn" | "steady" | "fast-paced" | "variable" | null;
  era: string | null;
};

const VALID_PACING = new Set(["slow-burn", "steady", "fast-paced", "variable"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (typeof value === "string") {
    return [value];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const values = value.filter((item): item is string => typeof item === "string");

  return values.length > 0 ? values : null;
}

function normalizeMetadata(value: unknown): GptMetadata {
  if (!isRecord(value)) {
    return {
      genre: null,
      mood: null,
      themes: null,
      setting: null,
      pacing: null,
      era: "unknown",
    };
  }

  const setting = typeof value.setting === "string" ? value.setting.slice(0, 60) : null;
  const pacing = typeof value.pacing === "string" && VALID_PACING.has(value.pacing)
    ? (value.pacing as GptMetadata["pacing"])
    : null;
  const era = typeof value.era === "string" && value.era.trim().length > 0
    ? value.era
    : "unknown";

  return {
    genre: normalizeStringArray(value.genre),
    mood: normalizeStringArray(value.mood),
    themes: normalizeStringArray(value.themes),
    setting,
    pacing,
    era,
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
      agent_name: "book_enrichment",
      trigger: "user_add_book",
      duration_ms: params.durationMs,
      success: params.success,
      error: params.error ?? null,
    });
  } catch (error) {
    console.error("Failed to write book_enrichment agent log", error);
  }
}

async function fetchOpenLibraryBook(title: string, author: string | null) {
  const response = await axios.get<OpenLibraryResponse>(
    "https://openlibrary.org/search.json",
    {
      params: {
        title,
        author: author ?? undefined,
        limit: 1,
      },
    },
  );

  const doc = response.data.docs?.[0];

  return {
    isbn: doc?.isbn?.[0] ?? null,
    pages: doc?.number_of_pages_median ?? null,
    year: doc?.first_publish_year ?? null,
    subjects: doc?.subject?.slice(0, 8) ?? [],
  };
}

async function fetchExaContext(title: string, author: string | null) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing EXA_API_KEY.");
  }

  const response = await axios.post<ExaResponse>(
    "https://api.exa.ai/search",
    {
      query: `${title} ${author ?? ""} book genre themes mood`.trim(),
      numResults: 5,
      useAutoprompt: true,
    },
    {
      headers: {
        "x-api-key": apiKey,
      },
    },
  );

  return response.data.results
    ?.map((result) => result.text ?? result.snippet ?? result.title ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n") ?? "";
}

function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase();
}

function inferMetadataFromSubjects(subjects: string[]) {
  const normalizedSubjects = subjects
    .map(normalizeSubject)
    .filter(Boolean);
  const genreCandidates = normalizedSubjects.filter((subject) => (
    [
      "fiction",
      "fantasy",
      "science fiction",
      "mystery",
      "thriller",
      "romance",
      "historical",
      "literary",
      "young adult",
      "coming of age",
      "adventure",
    ].some((keyword) => subject.includes(keyword))
  ));
  const themeCandidates = normalizedSubjects.filter((subject) => (
    ["friendship", "grief", "games", "video", "family", "identity", "love", "art"].some(
      (keyword) => subject.includes(keyword),
    )
  ));
  const moodCandidates = normalizedSubjects.filter((subject) => (
    ["emotional", "funny", "dark", "lyrical", "intense", "warm"].some((keyword) => subject.includes(keyword))
  ));

  return {
    genre: genreCandidates.length > 0
      ? Array.from(new Set(genreCandidates)).slice(0, 3)
      : ["literary fiction"],
    mood: moodCandidates.length > 0
      ? Array.from(new Set(moodCandidates)).slice(0, 3)
      : ["emotional"],
    themes: themeCandidates.length > 0
      ? Array.from(new Set(themeCandidates)).slice(0, 4)
      : normalizedSubjects.slice(0, 3),
    setting: null,
    pacing: null,
    era: "unknown",
  } satisfies GptMetadata;
}

async function extractMetadataWithGpt(params: {
  title: string;
  author: string | null;
  exaContext: string;
}) {
  const openai = getOpenAIClient();
  const author = params.author ?? "unknown author";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a book metadata extractor. Return only valid JSON. No explanation, no markdown.",
      },
      {
        role: "user",
        content: `Extract structured metadata for this book using the search results below.

Book: ${params.title} by ${author}

Search results:
${params.exaContext}

Return this exact JSON:
{
  "genre": ["array of 1-3 strings"],
  "mood": ["array of 1-4 adjectives"],
  "themes": ["array of 2-5 noun phrases"],
  "setting": "one sentence, max 60 characters",
  "pacing": "one of: slow-burn | steady | fast-paced | variable",
  "era": "decade or period, e.g. '1990s'"
}`,
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
    const body = (await request.json()) as AddBookRequest;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const author = typeof body.author === "string" && body.author.trim().length > 0
      ? body.author.trim()
      : null;
    const rawUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const userId = rawUserId ? normalizeUserId(rawUserId) : "";

    if (!title || !userId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const openLibraryBook = await fetchOpenLibraryBook(title, author).catch((error) => {
      console.error("Open Library lookup failed", error);

      return {
        isbn: null,
        pages: null,
        year: null,
        subjects: [],
      };
    });
    const exaContext = await fetchExaContext(title, author).catch((error) => {
      console.error("Exa lookup failed", error);
      return "";
    });
    const rawMetadata = exaContext
      ? await extractMetadataWithGpt({ title, author, exaContext }).catch((error) => {
          console.error("Metadata extraction failed", error);
          return null;
        })
      : null;
    const metadata = rawMetadata
      ? normalizeMetadata(rawMetadata)
      : inferMetadataFromSubjects(openLibraryBook.subjects);
    const enriched = rawMetadata !== null;

    if (openLibraryBook.isbn) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("books")
        .select("id")
        .eq("isbn", openLibraryBook.isbn)
        .eq("user_id", userId)
        .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicate) {
        await logAgentRun({
          durationMs: Date.now() - startedAt,
          success: false,
          error: "book_already_exists",
        });

        return NextResponse.json({ error: "book_already_exists" }, { status: 409 });
      }
    }

    const duplicateQuery = supabase
      .from("books")
      .select("id")
      .eq("user_id", userId)
      .eq("title", title);
    const duplicateByTitleQuery = author
      ? duplicateQuery.eq("author", author)
      : duplicateQuery.is("author", null);
    const { data: duplicateByTitle, error: duplicateByTitleError } = await duplicateByTitleQuery.maybeSingle();

    if (duplicateByTitleError) {
      throw duplicateByTitleError;
    }

    if (duplicateByTitle) {
      await logAgentRun({
        durationMs: Date.now() - startedAt,
        success: false,
        error: "book_already_exists",
      });

      return NextResponse.json({ error: "book_already_exists" }, { status: 409 });
    }

    const { data: insertedBook, error: insertError } = await supabase
      .from("books")
      .insert({
        user_id: userId,
        title,
        author,
        isbn: openLibraryBook.isbn,
        pages: openLibraryBook.pages,
        year: openLibraryBook.year,
        genre: metadata.genre,
        mood: metadata.mood,
        themes: metadata.themes,
        setting: metadata.setting,
        pacing: metadata.pacing,
        era: metadata.era,
        enriched,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    const xpEvent = await awardXP(userId, "add_book");

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return NextResponse.json({
      ...insertedBook,
      xp_event: xpEvent,
    }, { status: 200 });
  } catch (error) {
    console.error("Book enrichment failed", error);

    await logAgentRun({
      durationMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : "internal_error",
    });

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
