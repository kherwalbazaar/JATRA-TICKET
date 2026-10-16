import { NextResponse } from "next/server";
import { resetDailySmsLimit } from "@/lib/server/otp";

export async function POST(request) {
  try {
    const body = await request.json();
    const { mobile } = body;

    if (!mobile) {
      return NextResponse.json(
        { success: false, error: "Mobile number is required." },
        { status: 400 }
      );
    }

    const result = await resetDailySmsLimit(mobile);
    return NextResponse.json(result);
  } catch (err) {
    console.error("API /api/auth/otp/reset error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to reset daily SMS quota.",
      },
      { status: 500 }
    );
  }
}
