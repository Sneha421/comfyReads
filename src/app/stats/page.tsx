"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import Toast from "../../../components/Toast";
import { useToast } from "../../../lib/use-toast";
import { USER_ID } from "../../../lib/user";

type StatsSummary = {
  total_xp: number;
  current_streak: number;
  level: number;
  level_name: string;
};

type StatsDetail = {
  books_count: number;
  reviews_count: number;
  average_rating: number;
  top_vibe_tag: string | null;
};

type Status = "loading" | "success" | "error";

type VibeCardResult = {
  html: string;
};

const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 3500,
  8: 5000,
  9: 7500,
  10: 10000,
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-card bg-white p-card shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="h-8 w-20 rounded bg-[#ebe5dc]" />
      <div className="mt-6 h-4 w-28 rounded bg-[#ebe5dc]" />
    </div>
  );
}

function formatXpLabel(value: number) {
  return `${value} XP`;
}

function formatAverageRating(value: number) {
  return value.toFixed(1);
}

function getProgressData(totalXp: number, level: number) {
  const currentThreshold = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[1];
  const nextThreshold = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[10];

  if (level >= 10) {
    return {
      progressPercent: 100,
      remainingLabel: "Max level reached",
    };
  }

  const denominator = nextThreshold - currentThreshold;
  const rawProgress = denominator > 0 ? (totalXp - currentThreshold) / denominator : 1;
  const progressPercent = Math.max(0, Math.min(100, rawProgress * 100));

  return {
    progressPercent,
    remainingLabel: `${nextThreshold} XP to next level`,
  };
}

export default function StatsPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [detail, setDetail] = useState<StatsDetail | null>(null);
  const [vibeCard, setVibeCard] = useState<VibeCardResult | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const { toast, toastVisible, showToast } = useToast();

  async function loadStats() {
    setStatus("loading");

    try {
      const [summaryResponse, detailResponse] = await Promise.all([
        fetch(`/api/stats?user_id=${encodeURIComponent(USER_ID)}`, { cache: "no-store" }),
        fetch(`/api/stats/detail?user_id=${encodeURIComponent(USER_ID)}`, { cache: "no-store" }),
      ]);

      if (!summaryResponse.ok || !detailResponse.ok) {
        throw new Error("Failed to load stats");
      }

      const [summaryData, detailData] = await Promise.all([
        summaryResponse.json() as Promise<StatsSummary>,
        detailResponse.json() as Promise<StatsDetail>,
      ]);

      setSummary(summaryData);
      setDetail(detailData);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  async function handleGenerateVibeCard() {
    setIsGeneratingCard(true);

    try {
      const response = await fetch("/api/vibecard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: USER_ID,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate vibe card");
      }

      const data = (await response.json()) as VibeCardResult;
      setVibeCard(data);
    } catch {
      showToast("Write a review first. The card needs a signal.", "error");
    } finally {
      setIsGeneratingCard(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-56 animate-pulse rounded bg-[#ebe5dc]" />
          <div className="h-4 w-20 animate-pulse rounded bg-[#ebe5dc]" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-16 animate-pulse rounded bg-[#ebe5dc]" />
            <div className="h-4 w-28 animate-pulse rounded bg-[#ebe5dc]" />
          </div>
          <div className="h-2 w-full animate-pulse rounded-full bg-[#ebe5dc]" />
        </div>

        <div className="h-6 w-48 animate-pulse rounded bg-[#ebe5dc]" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (status === "error" || !summary || !detail) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Something went wrong loading your stats. Try refreshing.
        </p>
        <button
          type="button"
          onClick={() => void loadStats()}
          className="w-fit text-sm text-ember"
        >
          Refresh
        </button>
      </div>
    );
  }

  const progress = getProgressData(summary.total_xp, summary.level);
  const streakText = summary.current_streak > 0
    ? `🔥 ${summary.current_streak}-day streak`
    : "No streak yet. Read something today.";
  const isEmptyState = summary.total_xp === 0
    && detail.books_count === 0
    && detail.reviews_count === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1
          className="font-display text-[36px] italic text-ink"
        >
          {summary.level_name}
        </h1>
        <p className="text-sm text-muted">Level {summary.level}</p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="font-medium text-ink">{formatXpLabel(summary.total_xp)}</p>
          <p className="text-muted">{progress.remainingLabel}</p>
        </div>
        <div className="h-2 w-full rounded-full bg-[#e8e2d9]">
          <div
            className="h-full rounded-full bg-ember"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
      </section>

      <section>
        {summary.current_streak > 0 ? (
          <p className="text-base font-medium text-ink">{streakText}</p>
        ) : (
          <p
            className="text-base italic text-muted"
          >
            {streakText}
          </p>
        )}
      </section>

      {isEmptyState ? (
        <section className="rounded-card bg-white p-card text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p
            className="text-[20px] text-muted"
            style={{ fontFamily: "var(--font-display-italic), Georgia, serif" }}
          >
            Nothing to tally yet.
          </p>
          <p className="mt-2 text-sm text-muted">
            Add a book and leave a review. Your stats will stop looking so modest.
          </p>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: "books on shelf", value: String(detail.books_count) },
          { label: "reviews written", value: String(detail.reviews_count) },
          { label: "average rating", value: formatAverageRating(detail.average_rating) },
          { label: "most common vibe tag", value: detail.top_vibe_tag ?? "None" },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-card bg-white p-card shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          >
            <p className="font-display text-[32px] leading-tight text-ink">
              {item.value}
            </p>
            <p className="mt-6 text-[13px] text-muted">{item.label}</p>
          </article>
        ))}
      </section>

      <section className="rec-shelf-board">
        <div className="relative z-[1] flex flex-col gap-4">
          <p className="screen-kicker">
            <Sparkles size={14} />
            Reader vibe card
          </p>
          <div>
            <h2 className="font-display text-3xl text-page">
              One card. Your whole reading damage.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-page/70">
              Generated from the books you&apos;ve reviewed, not one isolated opinion.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleGenerateVibeCard()}
            disabled={isGeneratingCard || detail.reviews_count === 0}
            className="ember-button inline-flex w-fit items-center justify-center gap-2 rounded-button border-0 px-5 py-[10px] text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingCard ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Generating card
              </>
            ) : (
              "Generate reader vibe card"
            )}
          </button>

          {vibeCard ? (
            <iframe
              srcDoc={vibeCard.html}
              sandbox=""
              title="Generated reader vibe card"
              className="mt-2 w-full rounded-card border-0"
              style={{ aspectRatio: "1200 / 630" }}
            />
          ) : null}
        </div>
      </section>

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          visible={toastVisible}
        />
      ) : null}
    </div>
  );
}
