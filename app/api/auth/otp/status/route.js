import { NextResponse } from "next/server";
import { checkDailySmsLimit } from "@/lib/server/otp";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mobile = searchParams.get("mobile");

    if (!mobile) {
      return NextResponse.json(
        { success: false, error: "Mobile number is required." },
        { status: 400 }
      );
    }

    const status = await checkDailySmsLimit(mobile);
    return NextResponse.json({ success: true, ...status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
