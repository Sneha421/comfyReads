"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import BookshelfDisplay from "../../../components/BookshelfDisplay";
import ReaderHud from "../../../components/ReaderHud";
import Toast from "../../../components/Toast";
import XpPopup, { type XpPopupEvent } from "../../../components/XpPopup";
import { getBookStatusMap, saveBookStatus, type BookStatus } from "../../../lib/book-status";
import { useToast } from "../../../lib/use-toast";
import { USER_ID } from "../../../lib/user";

type Book = {
  id: string;
  title: string;
  author: string | null;
  genre: string[] | null;
  status?: BookStatus;
  created_at: string;
};

type AddBookResponse = Book & {
  xp_event?: XpPopupEvent;
};

const TOAST_COPY = {
  duplicate: "That one's already on your shelf.",
  error: "Something went wrong. Try again.",
  success: "Added to your shelf. We're looking it up now.",
  localStatus: "Status saved here. Database can catch up later.",
  status: "Shelf status updated.",
} as const;

export default function ShelfPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [xpEvent, setXpEvent] = useState<XpPopupEvent | null>(null);
  const [xpVisible, setXpVisible] = useState(false);
  const { toast, toastVisible, showToast } = useToast();

  async function loadBooks() {
    const response = await fetch(
      `/api/books?user_id=${encodeURIComponent(USER_ID)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("Failed to load books");
    }

    const data = (await response.json()) as Book[];
    const savedStatuses = getBookStatusMap();

    setBooks(data.map((book) => ({
      ...book,
      status: book.status ?? savedStatuses[book.id] ?? "reading",
    })));
  }

  useEffect(() => {
    void loadBooks().catch(() => {
      showToast(TOAST_COPY.error, "error");
    }).finally(() => {
      setIsLoading(false);
    });
  }, [showToast]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/books/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          status: "reading",
          user_id: USER_ID,
        }),
      });

      if (response.status === 409) {
        showToast(TOAST_COPY.duplicate, "error");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to add book");
      }

      setTitle("");
      setAuthor("");
      setIsFormOpen(false);
      showToast(TOAST_COPY.success, "default");
      const addedBook = (await response.json()) as AddBookResponse;

      if (addedBook.xp_event) {
        setXpEvent(addedBook.xp_event);
        setXpVisible(true);
        window.setTimeout(() => setXpVisible(false), 2600);
      }

      await loadBooks();
    } catch {
      showToast(TOAST_COPY.error, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(bookId: string, status: BookStatus) {
    setBooks((currentBooks) =>
      currentBooks.map((book) => (
        book.id === bookId ? { ...book, status } : book
      )),
    );
    saveBookStatus(bookId, status);

    try {
      const response = await fetch("/api/books/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          book_id: bookId,
          status,
          user_id: USER_ID,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      showToast(TOAST_COPY.status, "default");
    } catch {
      showToast(TOAST_COPY.localStatus, "default");
    }
  }

  return (
    <div className="screen-shell">
      <ReaderHud />

      <header className="screen-header">
        <span className="screen-kicker">
          <ShieldCheck size={14} />
          Shelf Quest
        </span>
        <h1 className="font-display text-[38px] leading-tight text-ink sm:text-[46px]">
          Your shelf
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted">
          A small room of your own, except it&apos;s books, ratings, and
          suspiciously revealing taste data.
        </p>
      </header>

      <BookshelfDisplay
        books={books}
        isLoading={isLoading}
        onAddBookClick={() => setIsFormOpen(true)}
        onStatusChange={handleStatusChange}
      />

      <section className={`accent-panel p-card ${isFormOpen ? "" : "hidden"}`}>
        <div>
          <p className="hero-chip w-fit">Add something to the shelf</p>
          <h2 className="mt-4 font-display text-2xl text-ink">
            Log the book. Judge it later.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Start with title and author. The app will do the digging.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            <span>Book title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Tomorrow, and Tomorrow, and Tomorrow"
              className="rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-gold"
              disabled={isSubmitting}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            <span>Author (optional)</span>
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="e.g. Gabrielle Zevin"
              className="rounded-[14px] border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-gold"
              disabled={isSubmitting}
            />
          </label>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="ember-button inline-flex min-h-11 min-w-[132px] items-center justify-center rounded-button border-0 px-5 py-[10px] text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Add to shelf"
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setTitle("");
                setAuthor("");
              }}
              className="text-sm text-muted hover:underline"
              disabled={isSubmitting}
            >
              never mind
            </button>
          </div>
        </form>
      </section>

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
