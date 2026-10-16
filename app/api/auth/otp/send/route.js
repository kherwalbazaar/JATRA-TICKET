import { NextResponse } from "next/server";
import { generateAndSendOtp } from "@/lib/server/otp";

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

    const result = await generateAndSendOtp(mobile);
    return NextResponse.json(result);
  } catch (err) {
    console.error("API /api/auth/otp/send error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to send verification code.",
      },
      { status: 400 }
    );
  }
}
