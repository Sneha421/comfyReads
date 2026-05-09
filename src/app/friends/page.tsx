"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, MessageCircle, Plus, Send, Sparkles, Trophy, Users } from "lucide-react";

import ReaderHud from "../../../components/ReaderHud";
import Toast from "../../../components/Toast";
import { useToast } from "../../../lib/use-toast";
import { USER_ID } from "../../../lib/user";

type Book = {
  id: string;
  title: string;
  author: string | null;
  genre: string[] | null;
};

type FriendBook = {
  title: string;
  author: string;
  status: "reading" | "read";
};

type FriendProfile = {
  id: string;
  name: string;
  handle: string;
  level: number;
  levelName: string;
  xp: number;
  shelf: FriendBook[];
};

type Comment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

const FRIENDS_STORAGE_KEY = "comfyreads:friends";
const COMMENTS_STORAGE_KEY = "comfyreads:friend-comments";

const FRIEND_DIRECTORY: FriendProfile[] = [
  {
    id: "mira",
    name: "Mira",
    handle: "@mira_reads",
    level: 4,
    levelName: "The Annotator",
    xp: 620,
    shelf: [
      { title: "Piranesi", author: "Susanna Clarke", status: "read" },
      { title: "The Golden Compass", author: "Philip Pullman", status: "reading" },
      { title: "A Psalm for the Wild-Built", author: "Becky Chambers", status: "read" },
    ],
  },
  {
    id: "jo",
    name: "Jo",
    handle: "@jo_chapters",
    level: 3,
    levelName: "The One-More-Chapter",
    xp: 310,
    shelf: [
      { title: "1984", author: "George Orwell", status: "read" },
      { title: "Piranesi", author: "Susanna Clarke", status: "reading" },
      { title: "Good Omens", author: "Terry Pratchett and Neil Gaiman", status: "read" },
    ],
  },
  {
    id: "sam",
    name: "Sam",
    handle: "@sam_shelves",
    level: 6,
    levelName: "The Completionist",
    xp: 2140,
    shelf: [
      { title: "The Golden Compass", author: "Philip Pullman", status: "read" },
      { title: "Percy Jackson and the Lightning Thief", author: "Rick Riordan", status: "read" },
      { title: "Legends & Lattes", author: "Travis Baldree", status: "reading" },
    ],
  },
];

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function readStoredArray(key: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredRecord(key: string) {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as unknown;

    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, Comment[]>
      : {};
  } catch {
    return {};
  }
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function FriendsPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedBookTitle, setSelectedBookTitle] = useState("");
  const [commentsByBook, setCommentsByBook] = useState<Record<string, Comment[]>>({});
  const [draftComment, setDraftComment] = useState("");
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const { toast, toastVisible, showToast } = useToast();

  useEffect(() => {
    const storedFriendIds = readStoredArray(FRIENDS_STORAGE_KEY)
      .filter((item): item is string => typeof item === "string");
    const initialFriendIds = storedFriendIds.length > 0 ? storedFriendIds : ["mira", "jo"];

    setFriendIds(initialFriendIds);
    setSelectedFriendId(initialFriendIds[0] ?? null);
    setCommentsByBook(readStoredRecord(COMMENTS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    async function loadBooks() {
      try {
        const response = await fetch(`/api/books?user_id=${encodeURIComponent(USER_ID)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load shelf");
        }

        const data = (await response.json()) as Book[];
        setBooks(data);
      } catch {
        showToast("Could not load your shelf. Social life remains difficult.", "error");
      } finally {
        setIsLoadingBooks(false);
      }
    }

    void loadBooks();
  }, [showToast]);

  const friends = useMemo(() => (
    friendIds
      .map((friendId) => FRIEND_DIRECTORY.find((friend) => friend.id === friendId))
      .filter((friend): friend is FriendProfile => Boolean(friend))
  ), [friendIds]);
  const availableFriends = FRIEND_DIRECTORY.filter((friend) => !friendIds.includes(friend.id));
  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) ?? friends[0] ?? null;
  const commonBooks = useMemo(() => {
    if (friends.length === 0 || books.length === 0) {
      return [];
    }

    const currentByTitle = new Map(books.map((book) => [normalizeTitle(book.title), book]));

    return books.filter((book) => (
      friends.some((friend) => (
        friend.shelf.some((friendBook) => normalizeTitle(friendBook.title) === normalizeTitle(book.title))
      ))
    )).map((book) => {
      const normalizedTitle = normalizeTitle(book.title);
      const matchingFriends = friends.filter((friend) => (
        friend.shelf.some((friendBook) => normalizeTitle(friendBook.title) === normalizedTitle)
      ));

      return {
        book: currentByTitle.get(normalizedTitle) ?? book,
        friends: matchingFriends,
      };
    });
  }, [books, friends]);
  const activeBookTitle = selectedBookTitle || commonBooks[0]?.book.title || "";
  const activeBookComments = commentsByBook[normalizeTitle(activeBookTitle)] ?? [];

  function persistFriends(nextFriendIds: string[]) {
    setFriendIds(nextFriendIds);
    window.localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(nextFriendIds));
  }

  function handleAddFriend(friendId: string) {
    const nextFriendIds = Array.from(new Set([...friendIds, friendId]));
    persistFriends(nextFriendIds);
    setSelectedFriendId(friendId);
    showToast("Friend added. Shelves may now be judged together.", "default");
  }

  function handlePostComment() {
    if (!draftComment.trim() || !activeBookTitle) {
      return;
    }

    const key = normalizeTitle(activeBookTitle);
    const nextComments = {
      ...commentsByBook,
      [key]: [
        ...(commentsByBook[key] ?? []),
        {
          id: crypto.randomUUID(),
          author: "You",
          text: draftComment.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    };

    setCommentsByBook(nextComments);
    window.localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(nextComments));
    setDraftComment("");
  }

  return (
    <div className="screen-shell social-shell">
      <ReaderHud />

      <header className="screen-header">
        <span className="screen-kicker">
          <Users size={14} />
          Friend shelf prototype
        </span>
        <h1 className="font-display text-[38px] leading-tight text-ink sm:text-[46px]">
          Read socially. Quietly, if needed.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted">
          Add friends, compare levels and shelves, then argue politely over books you all own.
        </p>
      </header>

      <section className="social-panel social-add-panel">
        <div>
          <p className="hero-chip w-fit">
            <Plus size={14} />
            Add friends
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Prototype directory for now. Real friend search can replace this later.
          </p>
        </div>

        <div className="friend-directory">
          {availableFriends.length > 0 ? availableFriends.map((friend) => (
            <button
              key={friend.id}
              type="button"
              onClick={() => handleAddFriend(friend.id)}
              className="friend-add-card"
            >
              <span>{friend.name}</span>
              <small>{friend.handle}</small>
            </button>
          )) : (
            <p className="text-sm text-muted">You added everyone in the prototype. Dangerous power.</p>
          )}
        </div>
      </section>

      <section className="friend-grid">
        {friends.map((friend) => (
          <article
            key={friend.id}
            className={`friend-card ${selectedFriend?.id === friend.id ? "friend-card--active" : ""}`}
          >
            <button
              type="button"
              onClick={() => setSelectedFriendId(friend.id)}
              className="friend-card-button"
            >
              <div>
                <p className="font-display text-2xl text-ink">{friend.name}</p>
                <p className="mt-1 text-sm text-muted">{friend.handle}</p>
              </div>
              <div className="friend-level">
                <Trophy size={16} />
                L{friend.level}
              </div>
            </button>

            <p className="mt-4 text-sm font-medium text-ink">{friend.levelName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{friend.xp} XP</p>

            <div className="friend-shelf-preview">
              {friend.shelf.map((book) => (
                <span
                  key={`${friend.id}-${book.title}`}
                  className={`friend-mini-book friend-mini-book--${book.status}`}
                  title={`${book.title} by ${book.author}`}
                >
                  {book.title}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="social-panel">
        <div className="social-section-header">
          <div>
            <p className="screen-kicker">
              <BookOpen size={14} />
              Shared books
            </p>
            <h2 className="mt-3 font-display text-3xl text-ink">Group comments</h2>
          </div>
          <p className="text-sm text-muted">
            Comments unlock when a book appears on your shelf and at least one friend shelf.
          </p>
        </div>

        {isLoadingBooks ? (
          <div className="mt-6 h-32 animate-pulse rounded-[24px] bg-white/55" />
        ) : commonBooks.length > 0 ? (
          <div className="shared-book-layout">
            <div className="shared-book-list">
              {commonBooks.map(({ book, friends: matchingFriends }) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBookTitle(book.title)}
                  className={`shared-book-button ${normalizeTitle(activeBookTitle) === normalizeTitle(book.title) ? "shared-book-button--active" : ""}`}
                >
                  <span>{book.title}</span>
                  <small>
                    With {matchingFriends.map((friend) => friend.name).join(", ")}
                  </small>
                </button>
              ))}
            </div>

            <div className="group-comment-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-2xl text-ink">{activeBookTitle}</p>
                  <p className="mt-1 text-sm text-muted">
                    Present in {activeBookComments.length === 1 ? "one comment" : `${activeBookComments.length} comments`}.
                  </p>
                </div>
                <MessageCircle className="text-ember" size={22} />
              </div>

              <div className="comment-thread">
                {activeBookComments.length > 0 ? activeBookComments.map((comment) => (
                  <div key={comment.id} className="comment-bubble">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{comment.author}</strong>
                      <span>{formatTime(comment.createdAt)}</span>
                    </div>
                    <p>{comment.text}</p>
                  </div>
                )) : (
                  <div className="comment-empty">
                    <Sparkles size={18} />
                    <p>No comments yet. Start the tiny book club fight.</p>
                  </div>
                )}
              </div>

              <div className="comment-compose">
                <input
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handlePostComment();
                    }
                  }}
                  placeholder="Add a group comment"
                />
                <button
                  type="button"
                  onClick={handlePostComment}
                  disabled={!draftComment.trim()}
                  aria-label="Post group comment"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="social-empty-state">
            <p className="font-display text-xl italic text-muted">No shared books yet.</p>
            <p className="mt-2 text-sm text-muted">
              Add a friend with overlapping taste or read something suspiciously popular.
            </p>
          </div>
        )}
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
