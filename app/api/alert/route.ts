import { NextResponse } from "next/server";
import { sendDetectionAlert } from "@/lib/mailer";
import { isSmtpConfigured } from "@/lib/config";
import { OT_TOPOLOGY } from "@/lib/ot-topology";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format in request body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const { nodeId, ip } = body as { nodeId?: string; ip?: string };

    if (!nodeId || typeof nodeId !== "string" || nodeId.trim().length === 0) {
      return NextResponse.json(
        { error: "Field 'nodeId' is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    const validNodes = OT_TOPOLOGY.nodes.map((n) => n.id);
    if (!validNodes.includes(nodeId.trim())) {
      return NextResponse.json(
        {
          error: `Field 'nodeId' ('${nodeId}') is invalid. Valid nodes are: ${validNodes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!ip || typeof ip !== "string" || ip.trim().length === 0) {
      return NextResponse.json(
        { error: "Field 'ip' is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          error: "SMTP service unconfigured: SMTP environment variables are missing.",
          sent: false,
        },
        { status: 503 }
      );
    }

    const result = await sendDetectionAlert(nodeId.trim(), ip.trim());

    if (!result.sent) {
      return NextResponse.json(
        {
          error: "Failed to dispatch email alert.",
          details: result.error || "Unknown SMTP transport error",
          sent: false,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: true,
      messageId: result.messageId,
      nodeId: nodeId.trim(),
      ip: ip.trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
