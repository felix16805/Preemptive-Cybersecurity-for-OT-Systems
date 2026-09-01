import { NextResponse } from "next/server";
import { sendDetectionAlert } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nodeId: string = body.nodeId ?? "PLC_02";
    const ip: string = body.ip ?? "192.168.10.102";

    const result = await sendDetectionAlert(nodeId, ip);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
