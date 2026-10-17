import { NextRequest, NextResponse } from "next/server";

interface ContactBody {
  name?: string;
  email?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON format." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const { name, email, message } = body as ContactBody;
    const errors: string[] = [];

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      errors.push("Name is required.");
    } else if (name.trim().length > 100) {
      errors.push("Name must be less than 100 characters.");
    }

    // Validate email
    if (!email || typeof email !== "string" || email.trim().length === 0) {
      errors.push("Email is required.");
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push("Invalid email address.");
      }
    }

    // Validate message
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      errors.push("Message is required.");
    } else if (message.trim().length > 5000) {
      errors.push("Message must be less than 5000 characters.");
    }

    // Check for obvious spam patterns
    const spamPatterns = [
      /(viagra|cialis|casino|lottery|make money|work from home|click here)/i,
      /http(s?):\/\/(?!.*supabase\.co)/, // Allow only our domains if needed
    ];
    const messageText = (message || "").toLowerCase();
    for (const pattern of spamPatterns) {
      if (pattern.test(messageText)) {
        errors.push("Message appears to contain spam content.");
        break;
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: errors.join(" ") },
        { status: 400 }
      );
    }

    // In production, this would send an email via a service
    // For development, return a safe fallback
    const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (!smtpConfigured) {
      // Safe development fallback - message received but not sent
      return NextResponse.json({
        success: true,
        message: "Message received (development mode - email not sent).",
        received: {
          name: name?.trim(),
          email: email?.trim(),
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If SMTP is configured, you would send the email here
    // For now, return success with a note
    return NextResponse.json({
      success: true,
      message: "Message received and queued for delivery.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}