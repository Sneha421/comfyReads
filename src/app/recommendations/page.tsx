"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookMarked, Compass, RefreshCw, Sparkles } from "lucide-react";

import ReaderHud from "../../../components/ReaderHud";
import Toast from "../../../components/Toast";
import XpPopup, { type XpPopupEvent } from "../../../components/XpPopup";
import { saveBookStatus, type BookStatus } from "../../../lib/book-status";
import { useToast } from "../../../lib/use-toast";
import { USER_ID } from "../../../lib/user";

type Recommendation = {
  rank: number;
  title: string;
  author: string;
  reason: string;
  confidence: number;
};

type RecommendationResponse = {
  has_taste_profile: boolean;
  recommendations: Recommendation[];
};

type AddRecommendationResponse = {
  id?: unknown;
  xp_event?: XpPopupEvent;
};

type Status = "loading" | "error" | "success";

const DISPLAY_COLORS = [
  "linear-gradient(135deg, #203f5f, #71b7a6)",
  "linear-gradient(135deg, #4f2c5f, #f08b66)",
  "linear-gradient(135deg, #2d344f, #d4a574)",
  "linear-gradient(135deg, #163c35, #8fcf9a)",
  "linear-gradient(135deg, #2a1838, #c45b7b)",
];

function RecommendationShelfSkeleton() {
  return (
    <section className="rec-shelf-board animate-pulse">
      <div className="rec-display-row">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rec-display-book rec-display-book--loading" />
        ))}
      </div>
      <div className="bookshelf-plank" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="h-28 rounded-[20px] bg-white/10" />
        <div className="h-28 rounded-[20px] bg-white/10" />
      </div>
    </section>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="h-1.5 w-24 rounded-full bg-white/15">
      <div
        className="h-full rounded-full bg-gold"
        style={{ width: `${Math.max(0, Math.min(100, confidence * 100))}%` }}
      />
    </div>
  );
}

export default function RecommendationsPage() {
  const [moodOverride, setMoodOverride] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [hasTasteProfile, setHasTasteProfile] = useState(true);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [xpEvent, setXpEvent] = useState<XpPopupEvent | null>(null);
  const [xpVisible, setXpVisible] = useState(false);
  const [activeMood, setActiveMood] = useState("");
  const activeRequestRef = useRef(0);
  const { toast, toastVisible, showToast } = useToast();

  async function loadRecommendations(override?: string) {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setStatus("loading");

    try {
      const params = new URLSearchParams({ user_id: USER_ID });

      if (override && override.trim()) {
        params.set("mood_override", override.trim());
      }

      const response = await fetch(`/api/recommendations?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load recommendations");
      }

      const data = (await response.json()) as RecommendationResponse;

      if (activeRequestRef.current !== requestId) {
        return;
      }

      setHasTasteProfile(data.has_taste_profile);
      setRecommendations(data.recommendations);
      setActiveMood(override?.trim() ?? "");
      setStatus("success");
    } catch {
      if (activeRequestRef.current !== requestId) {
        return;
      }

      setStatus("error");
    }
  }

  useEffect(() => {
    void loadRecommendations();
  }, []);

  async function addRecommendationToShelf(
    recommendation: Recommendation,
    bookStatus: BookStatus,
  ) {
    const key = `${recommendation.rank}-${bookStatus}`;
    setAddingKey(key);

    try {
      const response = await fetch("/api/books/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: recommendation.title,
          author: recommendation.author,
          status: bookStatus,
          user_id: USER_ID,
        }),
      });

      if (response.status === 409) {
        showToast("That one's already on your shelf.", "error");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to add recommendation");
      }

      const addedBook = (await response.json()) as AddRecommendationResponse;

      if (typeof addedBook.id === "string") {
        saveBookStatus(addedBook.id, bookStatus);
      }

      if (addedBook.xp_event) {
        setXpEvent(addedBook.xp_event);
        setXpVisible(true);
        window.setTimeout(() => setXpVisible(false), 2600);
      }

      showToast(
        bookStatus === "reading" ? "Added to your reading stack." : "Marked as read.",
        "default",
      );

      await loadRecommendations(activeMood);
    } catch {
      showToast("Something went wrong. Try again.", "error");
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <div className="screen-shell rec-night-shell">
      <ReaderHud />

      <header className="screen-header">
        <span className="screen-kicker">
          <Compass size={14} />
          Recommendation shelf
        </span>
        <h1 className="font-display text-[38px] leading-tight sm:text-[46px]">
          For you
        </h1>
        <p className="max-w-2xl text-base leading-7">
          Your next quests, pulled from the darker corner of the shelf.
        </p>
      </header>

      <section className="rec-control-panel">
        <div>
          <p className="hero-chip w-fit">
            <Sparkles size={14} />
            Mood placard
          </p>
          <p className="mt-3 text-sm leading-6">
            Set the mood. The shelf will pretend this is science.
          </p>
        </div>

        <form
          className="rec-control-row"
          onSubmit={(event) => {
            event.preventDefault();
            void loadRecommendations(moodOverride);
          }}
        >
          <input
            value={moodOverride}
            onChange={(event) => setMoodOverride(event.target.value)}
            placeholder="How are you feeling today? (optional)"
            className="min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-base text-page outline-none placeholder:text-page/45 focus:border-gold"
          />
          <button
            type="submit"
            title="Refresh recommendations"
            aria-label="Refresh recommendations"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/15 bg-white/10 text-page"
          >
            <RefreshCw
              size={18}
              className={status === "loading" ? "animate-spin" : undefined}
            />
          </button>
        </form>

        {activeMood ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Mood active: {activeMood}
          </p>
        ) : null}
      </section>

      {status === "loading" ? <RecommendationShelfSkeleton /> : null}

      {status === "error" ? (
        <section className="rec-empty-state">
          <p className="font-display text-xl italic text-muted">
            The display shelf jammed.
          </p>
          <p className="mt-2 text-sm text-muted">
            Try refreshing. It usually gets over itself.
          </p>
          <button
            type="button"
            onClick={() => void loadRecommendations(moodOverride)}
            className="ember-button mt-5 inline-flex rounded-button border-0 px-5 py-[10px] text-sm font-medium text-white"
          >
            Refresh
          </button>
        </section>
      ) : null}

      {status === "success" && !hasTasteProfile ? (
        <section className="rec-empty-state">
          <p className="font-display text-xl italic text-muted">
            We don&apos;t know your taste yet.
          </p>
          <p className="mt-2 text-sm text-muted">
            Add a few books and write your first review. We&apos;ll take it from there.
          </p>
          <Link
            href="/shelf"
            className="ember-button mt-5 inline-flex rounded-button px-5 py-[10px] text-sm font-medium text-white"
          >
            Go to your shelf
          </Link>
        </section>
      ) : null}

      {status === "success" && hasTasteProfile && recommendations.length === 0 ? (
        <section className="rec-empty-state">
          <p className="font-display text-xl italic text-muted">
            Nothing suitable turned up.
          </p>
          <p className="mt-2 text-sm text-muted">
            Try another mood override. Your taste is being difficult again.
          </p>
        </section>
      ) : null}

      {status === "success" && hasTasteProfile && recommendations.length > 0 ? (
        <section className="rec-shelf-board">
          <div className="rec-display-row">
            {recommendations.map((recommendation, index) => (
              <article
                key={`${recommendation.rank}-${recommendation.title}`}
                className="rec-pick"
              >
                <div
                  className="rec-display-book"
                  style={{ background: DISPLAY_COLORS[index % DISPLAY_COLORS.length] }}
                >
                  <div className="rec-book-rank">{recommendation.rank}</div>
                  <BookMarked size={22} />
                  <p>{recommendation.title}</p>
                </div>

                <div className="rec-pick-card">
                  <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-lg leading-6">
                      {recommendation.title}
                    </p>
                    <ConfidenceBar confidence={recommendation.confidence} />
                  </div>
                  <p className="mt-1 text-sm">{recommendation.author}</p>
                  <div className="mt-4 flex items-start gap-3">
                    <Sparkles size={16} className="mt-[4px] shrink-0 text-gold" />
                    <p className="text-[15px] leading-[1.6]">
                      {recommendation.reason}
                    </p>
                  </div>
                  <div className="rec-pick-actions">
                    <button
                      type="button"
                      disabled={addingKey !== null}
                      onClick={() => void addRecommendationToShelf(recommendation, "reading")}
                    >
                      {addingKey === `${recommendation.rank}-reading`
                        ? "Adding..."
                        : "Add as reading"}
                    </button>
                    <button
                      type="button"
                      disabled={addingKey !== null}
                      onClick={() => void addRecommendationToShelf(recommendation, "read")}
                    >
                      {addingKey === `${recommendation.rank}-read` ? "Saving..." : "Mark read"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="bookshelf-plank" />
        </section>
      ) : null}

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          visible={toastVisible}
        />
      ) : null}

      {xpEvent ? <XpPopup event={xpEvent} visible={xpVisible} /> : null}
    </div>
  );
}
