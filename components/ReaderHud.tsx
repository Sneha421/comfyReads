"use client";

import { useEffect, useState } from "react";
import { Flame, Sparkles, Trophy } from "lucide-react";

import { USER_ID } from "../lib/user";
import { getXpProgress } from "../lib/xp";

type StatsSummary = {
  total_xp: number;
  current_streak: number;
  level: number;
  level_name: string;
};

type ReaderHudProps = {
  variant?: "hero" | "compact";
};

function HudSkeleton({ variant }: { variant: ReaderHudProps["variant"] }) {
  if (variant === "compact") {
    return <div className="h-10 w-36 animate-pulse rounded-full bg-white/12" />;
  }

  return (
    <section className="hud-card animate-pulse">
      <div className="h-4 w-28 rounded bg-white/15" />
      <div className="mt-4 h-10 w-2/3 rounded bg-white/15" />
      <div className="mt-3 h-4 w-40 rounded bg-white/15" />
      <div className="mt-6 h-2 w-full rounded-full bg-white/10" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="h-20 rounded-[20px] bg-white/10" />
        <div className="h-20 rounded-[20px] bg-white/10" />
        <div className="hidden rounded-[20px] bg-white/10 sm:block" />
      </div>
    </section>
  );
}

export default function ReaderHud({
  variant = "hero",
}: ReaderHudProps) {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch(
          `/api/stats?user_id=${encodeURIComponent(USER_ID)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Failed to load reader hud");
        }

        const data = (await response.json()) as StatsSummary;

        if (!cancelled) {
          setStats(data);
        }
      } catch (error) {
        console.error("Reader HUD failed", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || !stats) {
    return <HudSkeleton variant={variant} />;
  }

  const progress = getXpProgress(stats.total_xp, stats.level);

  if (variant === "compact") {
    return (
      <div className="hud-compact hidden md:flex">
        <span className="hud-compact-chip">
          <Trophy size={14} />
          L{stats.level}
        </span>
        <span className="hud-compact-chip">
          <Flame size={14} />
          {stats.current_streak || 0}
        </span>
      </div>
    );
  }

  return (
    <section className="hud-card">
      <div className="hud-orb hud-orb-left" aria-hidden="true" />
      <div className="hud-orb hud-orb-right" aria-hidden="true" />

      <div className="relative z-[1]">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-[#f7e9d3]">
          <Sparkles size={14} />
          Reader HUD
        </div>

        <h2 className="mt-5 font-display text-4xl text-white sm:text-5xl">
          {stats.level_name}
        </h2>
        <p className="mt-2 text-sm text-[#f3e0ca]">
          Level {stats.level}. Your shelf is finally behaving like a game.
        </p>

        <div className="mt-6 flex items-center justify-between gap-4 text-sm">
          <p className="font-medium text-white">{stats.total_xp} XP</p>
          <p className="text-[#f3e0ca]">{progress.remainingLabel}</p>
        </div>

        <div className="mt-3 h-3 rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#f39c12] via-[#d4a574] to-[#c0392b]"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="hud-mini">
            <p className="hud-mini-label">Current streak</p>
            <p className="hud-mini-value">
              <Flame size={16} />
              {stats.current_streak || 0} days
            </p>
          </div>
          <div className="hud-mini">
            <p className="hud-mini-label">Current level</p>
            <p className="hud-mini-value">
              <Trophy size={16} />
              L{stats.level}
            </p>
          </div>
          <div className="hud-mini col-span-2 sm:col-span-1">
            <p className="hud-mini-label">Mood</p>
            <p className="hud-mini-value">
              <Sparkles size={16} />
              Quiet menace
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
