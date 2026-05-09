import Link from "next/link";
import { BookOpen, Plus, Sparkles, SquareCheckBig } from "lucide-react";

type ShelfBook = {
  id: string;
  title: string;
  author: string | null;
  genre: string[] | null;
  status?: "reading" | "read";
};

type BookshelfDisplayProps = {
  books: ShelfBook[];
  isLoading?: boolean;
  onAddBookClick: () => void;
  onStatusChange?: (bookId: string, status: "reading" | "read") => void;
};

const SPINE_COLORS = [
  "linear-gradient(180deg, #7fb3a3, #5f8f81)",
  "linear-gradient(180deg, #f6d86b, #d6a23f)",
  "linear-gradient(180deg, #8e88d8, #645ead)",
  "linear-gradient(180deg, #eb9fb8, #d76b8f)",
  "linear-gradient(180deg, #90c7d8, #6596ab)",
  "linear-gradient(180deg, #f1dfc7, #c9a987)",
  "linear-gradient(180deg, #4a446f, #2f2a4a)",
  "linear-gradient(180deg, #f08b66, #cf5b39)",
];

function chunkBooks(books: ShelfBook[]) {
  const rowSize = 6;
  const rows: ShelfBook[][] = [];

  for (let index = 0; index < books.length; index += rowSize) {
    rows.push(books.slice(index, index + rowSize));
  }

  while (rows.length < 2) {
    rows.push([]);
  }

  return rows.slice(0, 2);
}

function LoadingSpines() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="h-[150px] w-[54px] animate-pulse rounded-t-[10px] rounded-b-[6px] bg-white/35 shadow-[0_8px_16px_rgba(26,26,46,0.08)] sm:h-[170px] sm:w-[64px]"
        />
      ))}
    </>
  );
}

function BookSpine({
  book,
  index,
  rowIndex,
  onStatusChange,
}: {
  book: ShelfBook;
  index: number;
  rowIndex: number;
  onStatusChange?: (bookId: string, status: "reading" | "read") => void;
}) {
  const status = book.status ?? "reading";

  return (
    <div className="book-spine-wrap">
      <Link
        href={`/review/${book.id}`}
        className={`book-spine book-spine--${status}`}
        title={`Review ${book.title}`}
        style={{
          background: SPINE_COLORS[(index + rowIndex * 3) % SPINE_COLORS.length],
          height: `${138 + ((book.title.length + rowIndex * 17) % 42)}px`,
        }}
      >
        <span className="book-spine-status">
          {status === "reading" ? (
            <BookOpen size={12} />
          ) : (
            <SquareCheckBig size={12} />
          )}
        </span>
        <span className="book-spine-title">{book.title}</span>
        <span className="book-spine-accent" />
      </Link>

      {onStatusChange ? (
        <div className="book-status-toggle" aria-label={`${book.title} status`}>
          <button
            type="button"
            aria-pressed={status === "reading"}
            onClick={() => onStatusChange(book.id, "reading")}
          >
            Reading
          </button>
          <button
            type="button"
            aria-pressed={status === "read"}
            onClick={() => onStatusChange(book.id, "read")}
          >
            Read
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ShelfBoard({
  title,
  description,
  emptyTitle,
  emptyCopy,
  books,
  isLoading,
  tone,
  showAddBook,
  onAddBookClick,
  onStatusChange,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyCopy: string;
  books: ShelfBook[];
  isLoading: boolean;
  tone: "reading" | "read";
  showAddBook?: boolean;
  onAddBookClick: () => void;
  onStatusChange?: (bookId: string, status: "reading" | "read") => void;
}) {
  const rows = chunkBooks(books);

  return (
    <div className={`bookshelf-board bookshelf-board--${tone}`}>
      <div className="bookshelf-board-label">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="bookshelf-tier">
          <div className="bookshelf-tier-books">
            {rowIndex === 0 && showAddBook ? (
              <button
                type="button"
                onClick={onAddBookClick}
                className="book-spine book-spine--add"
              >
                <Plus size={20} />
                <span className="book-spine-title">Add book</span>
              </button>
            ) : null}

            {isLoading ? (
              <LoadingSpines />
            ) : row.length > 0 ? (
              row.map((book, index) => (
                <BookSpine
                  key={book.id}
                  book={book}
                  index={index}
                  rowIndex={rowIndex}
                  onStatusChange={onStatusChange}
                />
              ))
            ) : rowIndex === 0 ? (
              <div className="bookshelf-note">
                <p className="font-display text-lg italic text-muted">
                  {emptyTitle}
                </p>
                <p className="mt-2 text-sm text-muted">{emptyCopy}</p>
              </div>
            ) : null}
          </div>
          <div className="bookshelf-plank" />
        </div>
      ))}
    </div>
  );
}

export default function BookshelfDisplay({
  books,
  isLoading = false,
  onAddBookClick,
  onStatusChange,
}: BookshelfDisplayProps) {
  const readingBooks = books.filter((book) => (book.status ?? "reading") === "reading");
  const readBooks = books.filter((book) => book.status === "read");

  return (
    <section className="bookshelf-scene">
      <div className="bookshelf-header">
        <div>
          <p className="screen-kicker">
            <Sparkles size={14} />
            Your actual shelf
          </p>
          <h2 className="mt-4 font-display text-3xl text-ink">
            The books live here now.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Add one, pull one down, write what it did to you. The interface
            should feel like rearranging a shelf, not filing a report.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddBookClick}
          className="add-book-spine"
        >
          <Plus size={18} />
          <span>Add a book</span>
        </button>
      </div>

      <div className="bookshelf-stack">
        <ShelfBoard
          title="Reading now"
          description="Books currently loitering on your conscience."
          emptyTitle="No active reads."
          emptyCopy="Add one before the shelf gets too smug."
          books={readingBooks}
          isLoading={isLoading}
          tone="reading"
          showAddBook
          onAddBookClick={onAddBookClick}
          onStatusChange={onStatusChange}
        />

        <ShelfBoard
          title="Read"
          description="Finished books. Evidence, basically."
          emptyTitle="Nothing finished yet."
          emptyCopy="Move a book here when you are done with it."
          books={readBooks}
          isLoading={isLoading}
          tone="read"
          onAddBookClick={onAddBookClick}
          onStatusChange={onStatusChange}
        />
      </div>
    </section>
  );
}
