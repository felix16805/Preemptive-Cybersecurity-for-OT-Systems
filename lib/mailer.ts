import nodemailer from "nodemailer";
import type { SafeCutResult } from "@/types";

// ─── Nodemailer transporter ───────────────────────────────────────────────────
//  Uses environment variables. Falls back to console.log if unconfigured.
// ─────────────────────────────────────────────────────────────────────────────

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ─── Alert email templates ────────────────────────────────────────────────────

function buildDetectionAlertHtml(nodeId: string, ip: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,'Segoe UI',sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:40px auto;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#dc2626,#7f1d1d);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <span style="font-size:28px;">⚠️</span>
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#fff;">
          CYBERSECURITY ALERT — OT INTRUSION DETECTED
        </span>
      </div>
      <p style="margin:0;font-size:13px;color:#fca5a5;">SafeCut Incident Response System · ${new Date().toLocaleString()}</p>
    </div>
    <div style="padding:32px;background:#0f172a;">
      <div style="background:#1e293b;border-radius:8px;padding:20px;margin-bottom:24px;border-left:4px solid #dc2626;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Compromised Node</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#f87171;font-family:monospace;">${nodeId}</p>
        <p style="margin:8px 0 0;font-size:14px;color:#cbd5e1;">Target IP: <strong>${ip}</strong></p>
      </div>
      <div style="background:#1e293b;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#e2e8f0;">Event Details</p>
        <ul style="margin:0;padding:0;list-style:none;font-size:13px;color:#94a3b8;line-height:1.6;">
          <li><strong>Tactic:</strong> Initial Access / Execution</li>
          <li><strong>Technique:</strong> T0889 - Modify Parameter</li>
          <li><strong>Description:</strong> Unauthorized Modbus register write detected on port 502.</li>
          <li><strong>Status:</strong> Awaiting automated containment response...</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildResponseAlertHtml(result: SafeCutResult): string {
  const loopRows = result.certificate.sifResults
    .map(
      (sif) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1e293b;">${sif.loopName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e293b;text-align:center;">
            <span style="
              display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;
              background:${sif.preserved ? "#052e16" : "#450a0a"};
              color:${sif.preserved ? "#4ade80" : "#f87171"};
              border:1px solid ${sif.preserved ? "#16a34a" : "#dc2626"};
            ">
              ${sif.preserved ? "✓ VERIFIED" : "✗ SEVERED"}
            </span>
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,'Segoe UI',sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:40px auto;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#075985,#0c4a6e);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <span style="font-size:28px;">🛡️</span>
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#fff;">
          INCIDENT RESPONSE COMPLETE
        </span>
      </div>
      <p style="margin:0;font-size:13px;color:#bae6fd;">SafeCut Incident Response System · ${new Date().toLocaleString()}</p>
    </div>
    <div style="padding:32px;background:#0f172a;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
        <div style="background:#1e293b;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;">Response Mode</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:${result.mode === "safecut" ? "#22d3ee" : "#f87171"};">
            ${result.mode === "safecut" ? "SafeCut™" : "BLIND QUARANTINE"}
          </p>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;">Links Severed</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#f59e0b;">${result.cutEdges.length}</p>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;">Solve Time</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#22d3ee;">${result.solveTimeMs.toFixed(3)} ms</p>
        </div>
      </div>
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#e2e8f0;">Safety Loop Certificate</p>
      <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <thead>
          <tr style="background:#0f172a;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Safety Loop</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Status</th>
          </tr>
        </thead>
        <tbody>${loopRows}</tbody>
      </table>
      <div style="margin-top:20px;padding:16px;border-radius:8px;background:${result.reactorStable ? "#052e16" : "#450a0a"};border:1px solid ${result.reactorStable ? "#16a34a" : "#dc2626"};">
        <p style="margin:0;font-size:14px;font-weight:700;color:${result.reactorStable ? "#4ade80" : "#f87171"};">
          ${result.reactorStable ? "✓ Reactor operating within safe parameters (~355 K)" : "⚠ REACTOR RUNAWAY — Temperature exceeding 400 K threshold"}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AlertResult {
  sent: boolean;
  messageId?: string;
  error?: string;
  fallback?: boolean;
}

export async function sendDetectionAlert(nodeId: string, ip: string): Promise<AlertResult> {
  const transporter = createTransporter();
  const recipient = process.env.ALERT_TO;

  if (!transporter || !recipient) {
    console.log(`[SAFECUT ALERT] DETECTION: No SMTP. Incident at ${nodeId} (${ip})`);
    return { sent: false, fallback: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"SafeCut OT Security" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject: `🚨 [SAFECUT ALERT] OT Intrusion Detected — ${nodeId} compromised`,
      text: `CYBERSECURITY ALERT\n\nCompromised node: ${nodeId}\nTarget IP: ${ip}\nStatus: Awaiting automated containment response...`,
      html: buildDetectionAlertHtml(nodeId, ip),
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[SAFECUT MAILER ERROR]", error);
    return { sent: false, error };
  }
}

export async function sendAttackAlert(result: SafeCutResult): Promise<AlertResult> {
  const transporter = createTransporter();
  const recipient = process.env.ALERT_TO;

  if (!transporter || !recipient) {
    console.log(`[SAFECUT ALERT] RESPONSE COMPLETE: No SMTP. Mode: ${result.mode}, Safe loops: ${result.safetyLoopsPreserved}/${result.totalSafetyLoops}`);
    return { sent: false, fallback: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"SafeCut OT Security" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject: `🛡️ [SAFECUT ALERT] Response Complete — ${result.mode === 'safecut' ? 'SAFE' : 'DISASTER'}`,
      text: `RESPONSE COMPLETE\n\nMode: ${result.mode}\nLinks severed: ${result.cutEdges.length}\nSafety loops preserved: ${result.safetyLoopsPreserved}/${result.totalSafetyLoops}\nReactor stable: ${result.reactorStable}\nSolve time: ${result.solveTimeMs.toFixed(3)} ms`,
      html: buildResponseAlertHtml(result),
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[SAFECUT MAILER ERROR]", error);
    return { sent: false, error };
  }
}
