"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import Toast from "../../../../components/Toast";
import XpPopup, { type XpPopupEvent } from "../../../../components/XpPopup";
import { useToast } from "../../../../lib/use-toast";
import { USER_ID } from "../../../../lib/user";

type Book = {
  id: string;
  title: string;
  author: string | null;
  genre: string[] | null;
};

type ReviewResult = {
  id: string;
  vibe_tags: string[] | null;
  quote_for_vibe_card: string | null;
  xp_event?: XpPopupEvent;
};

type VibeCardResult = {
  html: string;
};

function RatingCircle({
  active,
  onClick,
  onMouseEnter,
}: {
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      aria-label={active ? "Filled rating circle" : "Empty rating circle"}
      style={{
        alignItems: "center",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "inline-flex",
        height: 28,
        justifyContent: "center",
        padding: 0,
        width: 28,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          background: active ? "var(--ember)" : "transparent",
          border: active ? "2px solid var(--ember)" : "2px solid var(--muted)",
          borderRadius: "999px",
          display: "block",
          height: 28,
          transition: "all 140ms ease",
          width: 28,
        }}
      />
    </button>
  );
}

export default function ReviewPageClient({ book }: { book: Book }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [vibeCard, setVibeCard] = useState<VibeCardResult | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [xpEvent, setXpEvent] = useState<XpPopupEvent | null>(null);
  const [xpVisible, setXpVisible] = useState(false);
  const { toast, toastVisible, showToast } = useToast();
  const displayRating = hoveredRating ?? rating;
  const reviewLength = reviewText.length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rating) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/reviews/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          book_id: book.id,
          user_id: USER_ID,
          rating,
          review_text: reviewText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save review");
      }

      const data = (await response.json()) as ReviewResult;
      setReviewResult(data);
      setVibeCard(null);

      if (data.xp_event) {
        setXpEvent(data.xp_event);
        setXpVisible(true);
        window.setTimeout(() => setXpVisible(false), 2600);
      }
    } catch {
      showToast("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateVibeCard() {
    if (!reviewResult?.id) {
      return;
    }

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
      showToast("Something went wrong. Try again.");
    } finally {
      setIsGeneratingCard(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Share link copied.", "default");
    } catch {
      showToast("Something went wrong. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[28px] leading-tight text-ink">
          {book.title}
        </h1>
        <p className="text-base text-muted">{book.author ?? "Author unknown"}</p>
        <div className="flex flex-wrap gap-2">
          {(book.genre ?? []).map((genre) => (
            <span
              key={genre}
              className="rounded-chip border border-gold bg-page px-3 py-1 text-xs text-ink"
            >
              {genre}
            </span>
          ))}
        </div>
      </header>

      {reviewResult ? (
        <section className="flex flex-col gap-6 rounded-card bg-white p-card shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h2 className="font-display text-[20px] text-ink">Review saved.</h2>

          <div className="flex flex-wrap gap-2">
            {(reviewResult.vibe_tags ?? []).map((tag) => (
              <span
                key={tag}
                className="rounded-chip border border-gold bg-page px-3 py-1 text-xs text-ink"
              >
                {tag}
              </span>
            ))}
          </div>

          <blockquote
            className="border-l-[3px] border-gold pl-4 font-display text-[18px] italic text-ink"
          >
            {reviewResult.quote_for_vibe_card || "The signal is in. The wording can catch up."}
          </blockquote>

          <div className="flex flex-wrap gap-4 text-sm text-ember">
            <button
              type="button"
              onClick={handleGenerateVibeCard}
              className="inline-flex items-center gap-2 text-sm text-ember"
              disabled={isGeneratingCard}
            >
              {isGeneratingCard ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Generating reader card</span>
                </>
              ) : (
                "Generate reader vibe card"
              )}
            </button>

            <Link href="/shelf" className="text-sm text-ember">
              Back to shelf
            </Link>
          </div>

          {vibeCard ? (
            <div className="flex flex-col gap-4">
              <iframe
                srcDoc={vibeCard.html}
                sandbox=""
                title="Generated vibe card"
                className="w-full rounded-card border-0"
                style={{ aspectRatio: "1200 / 630" }}
              />

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-fit rounded-button border-0 bg-ember px-5 py-[10px] text-sm font-medium text-white"
              >
                Copy share link
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
              Star rating
            </p>
            <div
              className="flex items-center gap-3"
              onMouseLeave={() => setHoveredRating(null)}
            >
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;

                return (
                  <RatingCircle
                    key={value}
                    active={value <= displayRating}
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoveredRating(value)}
                  />
                );
              })}
            </div>
            <p className="text-sm text-muted">{displayRating} out of 5</p>
          </section>

          <section className="flex flex-col gap-3">
            <label
              htmlFor="review-text"
              className="text-sm font-medium uppercase tracking-[0.18em] text-muted"
            >
              Review text
            </label>
            <textarea
              id="review-text"
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="What did this one feel like? You don't have to be kind."
              className="min-h-[120px] rounded-button border border-[#d9d3c8] bg-white px-4 py-4 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-gold"
            />
            <div className="flex items-start justify-between gap-4">
              <p
                className={`text-sm italic text-muted ${
                  reviewLength < 10 ? "opacity-100" : "opacity-0"
                }`}
              >
                A few more words would help us read your taste.
              </p>
              <p className="text-xs text-muted">{reviewLength} characters</p>
            </div>
          </section>

          <button
            type="submit"
            disabled={!rating || isSubmitting}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-button border-0 bg-ember px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#c0c0c0]"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Save review"}
          </button>
        </form>
      )}

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
