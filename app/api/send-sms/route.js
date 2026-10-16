import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { message, numbers, route = "q", variables_values, flash = 0 } = body;

    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "FAST2SMS_API_KEY is not configured in environment variables.",
        },
        { status: 500 }
      );
    }

    if (!numbers) {
      return NextResponse.json(
        { success: false, error: "Phone number(s) required." },
        { status: 400 }
      );
    }

    // Clean comma-separated 10-digit Indian phone numbers
    const cleanNumbers = String(numbers)
      .split(",")
      .map((n) => n.replace(/\D/g, "").slice(-10))
      .filter((n) => n.length === 10)
      .join(",");

    if (!cleanNumbers) {
      return NextResponse.json(
        { success: false, error: "No valid 10-digit mobile number found." },
        { status: 400 }
      );
    }

    const payload = {
      route,
      language: "english",
      flash: Number(flash) || 0,
      numbers: cleanNumbers,
    };

    if (route === "otp" && variables_values) {
      payload.variables_values = String(variables_values);
    } else {
      if (!message) {
        return NextResponse.json(
          { success: false, error: "SMS message content is required." },
          { status: 400 }
        );
      }
      payload.message = String(message);
    }

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.return) {
      return NextResponse.json({ success: true, data });
    } else {
      console.error("Fast2SMS gateway returned error:", data);
      return NextResponse.json(
        { success: false, error: data.message || data },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Fast2SMS API route exception:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
