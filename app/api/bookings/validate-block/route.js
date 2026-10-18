import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const block = String(searchParams.get("block") || "").trim().toUpperCase();
    const mode = String(searchParams.get("mode") || "online").toLowerCase();

    if (!block) {
      return NextResponse.json({ success: false, error: "Missing block parameter" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("block_categories")
      .select("id, name, online, counter, enabled")
      .eq("id", block)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: `Block "${block}" not found.` }, { status: 404 });
    }

    if (mode === "counter") {
      if (data.online === true || data.counter === false) {
        return NextResponse.json(
          {
            success: false,
            mode: "counter",
            online: true,
            error: `Block "${block}" is active for Online selling only. Seats in this block cannot be sold at the counter.`,
          },
          { status: 400 }
        );
      }
    } else {
      // online mode (default)
      if (data.online === false) {
        return NextResponse.json(
          {
            success: false,
            mode: "online",
            online: false,
            error: "This block is available for counter booking only. Please select another block.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true, mode, online: data.online, counter: data.counter, block: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const block = String(body.block || "").trim().toUpperCase();
    const mode = String(body.mode || "online").toLowerCase();

    if (!block) {
      return NextResponse.json({ success: false, error: "Missing block in request body" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("block_categories")
      .select("id, name, online, counter, enabled")
      .eq("id", block)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: `Block "${block}" not found.` }, { status: 404 });
    }

    if (mode === "counter") {
      if (data.online === true || data.counter === false) {
        return NextResponse.json(
          {
            success: false,
            mode: "counter",
            online: true,
            error: `Block "${block}" is active for Online selling only. Seats in this block cannot be sold at the counter.`,
          },
          { status: 400 }
        );
      }
    } else {
      if (data.online === false) {
        return NextResponse.json(
          {
            success: false,
            mode: "online",
            online: false,
            error: "This block is available for counter booking only. Please select another block.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true, mode, online: data.online, counter: data.counter, block: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
