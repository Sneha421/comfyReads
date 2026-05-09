import { getSupabaseServiceClient } from "./supabase";

type UserStatsRow = {
  total_xp: number | null;
  current_streak: number | null;
  last_activity_date: string | null;
  level: number | null;
};

export type XpAward = {
  action: string;
  xp_awarded: number;
  total_xp: number;
  level: number;
  leveled_up: boolean;
  current_streak: number;
};

const XP_BY_ACTION: Record<string, number> = {
  add_book: 10,
  review_short: 20,
  review_long: 40,
  streak_continued: 15,
  vibe_battle_win: 50,
  challenge_complete: 100,
};

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 250 },
  { level: 4, xp: 500 },
  { level: 5, xp: 1000 },
  { level: 6, xp: 2000 },
  { level: 7, xp: 3500 },
  { level: 8, xp: 5000 },
  { level: 9, xp: 7500 },
  { level: 10, xp: 10000 },
];

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateStringFromUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function yesterdayUtc() {
  return dateStringFromUtc(addUtcDays(new Date(), -1));
}

function calculateStreak(previousDate: string | null, previousStreak: number | null) {
  const today = todayUtc();

  if (previousDate === today) {
    return previousStreak ?? 1;
  }

  if (previousDate === yesterdayUtc()) {
    return (previousStreak ?? 0) + 1;
  }

  return 1;
}

function calculateLevel(totalXp: number) {
  return LEVEL_THRESHOLDS.reduce((level, threshold) => (
    totalXp >= threshold.xp ? threshold.level : level
  ), 1);
}

async function logAgentRun(params: {
  action: string;
  durationMs: number;
  success: boolean;
  error?: string;
}) {
  try {
    const supabase = getSupabaseServiceClient();

    await supabase.from("agent_logs").insert({
      agent_name: "gamification",
      trigger: params.action,
      duration_ms: params.durationMs,
      success: params.success,
      error: params.error ?? null,
    });
  } catch (error) {
    console.error("Failed to write gamification agent log", error);
  }
}

export async function awardXP(user_id: string, action: string): Promise<XpAward> {
  const startedAt = Date.now();
  const xpAwarded = XP_BY_ACTION[action] ?? 0;

  if (!(action in XP_BY_ACTION)) {
    console.warn(`Unknown gamification action: ${action}`);
  }

  try {
    const supabase = getSupabaseServiceClient();
    const now = new Date().toISOString();

    const { error: eventError } = await supabase
      .from("xp_events")
      .insert({
        user_id,
        action,
        xp_awarded: xpAwarded,
        created_at: now,
      });

    if (eventError) {
      throw eventError;
    }

    const { data: stats, error: statsError } = await supabase
      .from("user_stats")
      .select("total_xp, current_streak, last_activity_date, level")
      .eq("user_id", user_id)
      .maybeSingle<UserStatsRow>();

    if (statsError) {
      throw statsError;
    }

    let result: XpAward;

    if (!stats) {
      const level = calculateLevel(xpAwarded);
      const currentStreak = 1;
      const { error: insertStatsError } = await supabase
        .from("user_stats")
        .insert({
          user_id,
          total_xp: xpAwarded,
          current_streak: currentStreak,
          last_activity_date: todayUtc(),
          level,
        });

      if (insertStatsError) {
        throw insertStatsError;
      }

      result = {
        action,
        xp_awarded: xpAwarded,
        total_xp: xpAwarded,
        level,
        leveled_up: level > 1,
        current_streak: currentStreak,
      };
    } else {
      const previousLevel = stats.level ?? calculateLevel(stats.total_xp ?? 0);
      const totalXp = (stats.total_xp ?? 0) + xpAwarded;
      const currentStreak = calculateStreak(
        stats.last_activity_date,
        stats.current_streak,
      );
      const level = calculateLevel(totalXp);
      const { error: updateStatsError } = await supabase
        .from("user_stats")
        .update({
          total_xp: totalXp,
          current_streak: currentStreak,
          last_activity_date: todayUtc(),
          level,
        })
        .eq("user_id", user_id);

      if (updateStatsError) {
        throw updateStatsError;
      }

      result = {
        action,
        xp_awarded: xpAwarded,
        total_xp: totalXp,
        level,
        leveled_up: level > previousLevel,
        current_streak: currentStreak,
      };
    }

    await logAgentRun({
      action,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return result;
  } catch (error) {
    await logAgentRun({
      action,
      durationMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : "internal_error",
    });

    throw error;
  }
}
