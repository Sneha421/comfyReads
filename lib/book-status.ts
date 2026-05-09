export type BookStatus = "reading" | "read";

const STORAGE_KEY = "comfyreads:book-status";

function isBookStatus(value: unknown): value is BookStatus {
  return value === "reading" || value === "read";
}

export function getBookStatusMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, BookStatus>;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, BookStatus] => isBookStatus(entry[1])),
    );
  } catch {
    return {} as Record<string, BookStatus>;
  }
}

export function saveBookStatus(bookId: string, status: BookStatus) {
  if (typeof window === "undefined") {
    return;
  }

  const statuses = getBookStatusMap();
  statuses[bookId] = status;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
}
