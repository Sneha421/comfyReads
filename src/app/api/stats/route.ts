import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "../../../../lib/supabase";
import { normalizeUserId } from "../../../../lib/user-id";

type UserStatsRow = {
  total_xp: number | null;
  current_streak: number | null;
  level: number | null;
};

const LEVEL_NAMES: Record<number, string> = {
  1: "The Skimmer",
  2: "The Commuter",
  3: "The One-More-Chapter",
  4: "The Annotator",
  5: "The Recommender",
  6: "The Completionist",
  7: "The Lore Keeper",
  8: "The Bibliophile",
  9: "The Arbiter of Taste",
  10: "The Oracle",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get("user_id")?.trim() ?? "";
    const userId = rawUserId ? normalizeUserId(rawUserId) : "";

    if (!userId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: stats, error } = await supabase
      .from("user_stats")
      .select("total_xp, current_streak, level")
      .eq("user_id", userId)
      .maybeSingle<UserStatsRow>();

    if (error) {
      throw error;
    }

    const level = stats?.level ?? 1;

    return NextResponse.json({
      total_xp: stats?.total_xp ?? 0,
      current_streak: stats?.current_streak ?? 0,
      level,
      level_name: LEVEL_NAMES[level] ?? LEVEL_NAMES[1],
    }, { status: 200 });
  } catch (error) {
    console.error("Stats lookup failed", error);

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
