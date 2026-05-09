import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "../../../../../lib/supabase";
import { normalizeUserId } from "../../../../../lib/user-id";

type ReviewRow = {
  rating: number | null;
  vibe_tags: string[] | null;
};

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get("user_id")?.trim() ?? "";
    const userId = rawUserId ? normalizeUserId(rawUserId) : "";

    if (!userId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const [{ count: booksCount, error: booksError }, { data: reviews, error: reviewsError }] = await Promise.all([
      supabase
        .from("books")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("reviews")
        .select("rating, vibe_tags")
        .eq("user_id", userId),
    ]);

    if (booksError) {
      throw booksError;
    }

    if (reviewsError) {
      throw reviewsError;
    }

    const reviewRows = (reviews ?? []) as ReviewRow[];
    const ratings = reviewRows
      .map((review) => review.rating)
      .filter((rating): rating is number => typeof rating === "number");
    const averageRating = ratings.length > 0
      ? roundToOneDecimal(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length)
      : 0;

    const vibeTagCounts = new Map<string, number>();

    for (const review of reviewRows) {
      for (const tag of review.vibe_tags ?? []) {
        const normalizedTag = tag.trim();

        if (!normalizedTag) {
          continue;
        }

        vibeTagCounts.set(normalizedTag, (vibeTagCounts.get(normalizedTag) ?? 0) + 1);
      }
    }

    let topVibeTag: string | null = null;
    let highestCount = 0;

    for (const [tag, count] of vibeTagCounts.entries()) {
      if (count > highestCount) {
        highestCount = count;
        topVibeTag = tag;
      }
    }

    return NextResponse.json({
      books_count: booksCount ?? 0,
      reviews_count: reviewRows.length,
      average_rating: averageRating,
      top_vibe_tag: topVibeTag,
    }, { status: 200 });
  } catch (error) {
    console.error("Stats detail lookup failed", error);

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
