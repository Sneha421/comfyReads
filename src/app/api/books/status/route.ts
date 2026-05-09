import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "../../../../../lib/supabase";
import { normalizeUserId } from "../../../../../lib/user-id";

type UpdateBookStatusRequest = {
  book_id?: unknown;
  user_id?: unknown;
  status?: unknown;
};

const VALID_STATUSES = new Set(["reading", "read"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateBookStatusRequest;
    const bookId = typeof body.book_id === "string" ? body.book_id.trim() : "";
    const rawUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";

    if (!bookId || !rawUserId || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("books")
      .update({ status })
      .eq("id", bookId)
      .eq("user_id", normalizeUserId(rawUserId))
      .select("id, status")
      .maybeSingle();

    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") {
        return NextResponse.json({
          id: bookId,
          status,
          persisted: false,
        }, { status: 200 });
      }

      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "book_not_found" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Failed to update book status", error);

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
