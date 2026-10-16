import { NextResponse } from "next/server";
import { verifyCustomerOtpServer } from "@/lib/server/otp";

export async function POST(request) {
  try {
    const body = await request.json();
    const { mobile, otp } = body;

    if (!mobile || !otp) {
      return NextResponse.json(
        { success: false, error: "Mobile number and OTP code are required." },
        { status: 400 }
      );
    }

    const result = await verifyCustomerOtpServer(mobile, otp);
    return NextResponse.json(result);
  } catch (err) {
    console.error("API /api/auth/otp/verify error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "OTP verification failed.",
      },
      { status: 400 }
    );
  }
}
