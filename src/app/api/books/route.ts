import { NextResponse } from "next/server";

import { getSupabaseServiceClient } from "../../../../lib/supabase";
import { normalizeUserId } from "../../../../lib/user-id";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get("user_id")?.trim() ?? "";

    if (!rawUserId) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const userId = normalizeUserId(rawUserId);
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, genre, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (error) {
    console.error("Failed to fetch books", error);

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
