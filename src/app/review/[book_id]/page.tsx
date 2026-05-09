import { notFound } from "next/navigation";

import { getSupabaseServiceClient } from "../../../../lib/supabase";
import ReviewPageClient from "./ReviewPageClient";

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  genre: string[] | null;
};

export default async function ReviewPage({
  params,
}: {
  params: { book_id: string };
}) {
  const supabase = getSupabaseServiceClient();
  const { data: book, error } = await supabase
    .from("books")
    .select("id, title, author, genre")
    .eq("id", params.book_id)
    .maybeSingle<BookRow>();

  if (error) {
    throw error;
  }

  if (!book) {
    notFound();
  }

  return <ReviewPageClient book={book} />;
}
