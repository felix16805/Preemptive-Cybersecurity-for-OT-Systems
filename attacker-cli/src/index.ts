// ─── SafeCut Attacker CLI ──────────────────────────────────────────────────────
//
//  Terminal-based simulated adversary that sends controlled attack events to the
//  SafeCut Defender Console over the local network (same Wi-Fi or phone hotspot).
//  All actions are SIMULATED. No real scanning or exploitation takes place.
//
//  Run:   npm run dev            (asks for the defender IP if it is not saved)
//         npm run dev -- 192.168.43.12
//
//  Commands: help, connect [ip], doctor, status, target <node>, recon, scan,
//            exploit, lateral, impact, demo, events, clear, exit
//
//  Configuration (all optional, attacker-cli/.env):
//    ATTACKER_SERVER_URL     e.g. http://192.168.43.12:3000  (saved automatically)
//    ATTACKER_SESSION_ID     default SAFECUT-DEMO
//    ATTACKER_SESSION_TOKEN  default safecut-demo-token
// ───────────────────────────────────────────────────────────────────────────────

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ─── .env loading / saving ─────────────────────────────────────────────────────
const ENV_FILE = existsSync(join(process.cwd(), "src")) ? join(process.cwd(), ".env")
  : join(process.cwd(), "attacker-cli", ".env");

function loadDotEnv() {
  if (!existsSync(ENV_FILE)) return;
  try {
    for (const raw of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch { /* ignore */ }
}

function saveServerUrl(url: string) {
  try {
    let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
    if (/^ATTACKER_SERVER_URL=.*$/m.test(text)) {
      text = text.replace(/^ATTACKER_SERVER_URL=.*$/m, `ATTACKER_SERVER_URL=${url}`);
    } else {
      text = `ATTACKER_SERVER_URL=${url}\n` + text;
    }
    writeFileSync(ENV_FILE, text);
  } catch { /* not fatal */ }
}
loadDotEnv();

// ─── State ─────────────────────────────────────────────────────────────────────
const DEFAULT_PORT = 3000;
const state = {
  serverUrl: normaliseUrl(process.argv[2] || process.env.ATTACKER_SERVER_URL || ""),
  sessionId: (process.env.ATTACKER_SESSION_ID || "SAFECUT-DEMO").trim().toUpperCase(),
  sessionToken: (process.env.ATTACKER_SESSION_TOKEN || "safecut-demo-token").trim(),
  targetNode: "PLC_02",
  connected: false,
  lastError: "" as string,
};

const VALID_TARGETS = [
  "PLC_01", "PLC_02", "PLC_03", "PLC_04", "TEMP_SENSOR", "PRESSURE_SENSOR",
  "COOL_VALVE", "PRESSURE_VALVE", "HMI", "SCADA", "HISTORIAN", "SAFETY_CTRL",
];

const C = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/** Accepts "192.168.1.5", "192.168.1.5:3000" or a full http:// URL. */
function normaliseUrl(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "http://" + s;
  try {
    const u = new URL(s);
    if (!u.port && u.protocol === "http:") u.port = String(DEFAULT_PORT);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

// ─── HTTP with timeout and error classification ────────────────────────────────
type ApiResult = { ok: boolean; status: number; data: any; netError?: string };

async function api(method: "GET" | "POST", endpoint: string, body?: object, timeoutMs = 5000): Promise<ApiResult> {
  if (!state.serverUrl) return { ok: false, status: 0, data: {}, netError: "NO_URL" };
  try {
    const res = await fetch(state.serverUrl + endpoint, {
      method,
      headers: { "Content-Type": "application/json", "User-Agent": "SafeCut-Attacker-CLI/2.0" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    // A timeout is a DOMException (name "TimeoutError", numeric code 23), so
    // check the name first; network failures carry a string code on err.cause.
    const code = (err?.name === "TimeoutError" || err?.name === "AbortError") ? err.name
      : (err?.cause?.code || (typeof err?.code === "string" ? err.code : "") || err?.name || "UNKNOWN");
    return { ok: false, status: 0, data: {}, netError: String(code) };
  }
}

function explainNetError(code: string): string[] {
  const host = state.serverUrl.replace(/^https?:\/\//, "");
  switch (code) {
    case "ECONNREFUSED":
      return [
        `The defender laptop answered, but nothing is running on ${host}.`,
        "  - On the defender, start the server (START_DEFENDER.bat or `npm start`).",
        "  - Check the port. The defender console shows the exact address.",
      ];
    case "TimeoutError":
    case "AbortError":
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
    case "EHOSTUNREACH":
    case "ENETUNREACH":
      return [
        `Could not reach ${host} at all (no reply).`,
        "  1. Is the IP right? Use the address shown in the 'Attacker Connection' box",
        "     on the defender console, not a vEthernet/WSL/VirtualBox address.",
        "  2. Are BOTH laptops on the SAME hotspot? Check the Wi-Fi name on each.",
        "  3. Windows Firewall on the defender: run ALLOW_FIREWALL.bat (as admin) once.",
        "  4. Some phones block laptops from talking to each other on the hotspot.",
        "     If 1-3 are fine, use the Windows Mobile Hotspot option in DEMO_STEPS.txt.",
      ];
    case "ENOTFOUND":
      return [`The address "${host}" is not valid. Type just the IP, e.g. 192.168.43.12`];
    case "NO_URL":
      return ["No defender address set. Type: connect <defender-ip>"];
    default:
      return [`Network error (${code}) talking to ${host}.`];
  }
}

// ─── Connect / doctor ──────────────────────────────────────────────────────────
async function connect(verbose = true): Promise<boolean> {
  state.connected = false;
  if (verbose) console.log(C.dim(`\nConnecting to ${state.serverUrl} ...`));

  // Step 1: is the defender reachable?
  const health = await api("GET", "/api/health", undefined, 4000);
  if (health.status === 0) {
    state.lastError = `unreachable (${health.netError})`;
    console.log(C.red("✗ Defender not reachable."));
    for (const l of explainNetError(health.netError || "")) console.log("  " + l);
    console.log();
    return false;
  }
  if (!health.ok || health.data?.service !== "safecut-defender") {
    // Older server without /api/health: fall through to the session check.
    if (verbose) console.log(C.dim("  (defender has no health endpoint, checking session directly)"));
  } else if (verbose) {
    console.log(C.green("✓ Defender reachable") + C.dim(`  (demo mode: ${health.data.demoMode ? "ON" : "OFF"})`));
  }

  // Step 2: is the session valid?
  const check = await api("GET",
    `/api/attack-event?sessionId=${encodeURIComponent(state.sessionId)}&sessionToken=${encodeURIComponent(state.sessionToken)}&limit=1`);
  if (check.ok) {
    state.connected = true;
    state.lastError = "";
    saveServerUrl(state.serverUrl);
    console.log(C.green(`✓ Paired with defender session ${state.sessionId}`));
    console.log(C.dim("  Address saved, next time this connects automatically.\n"));
    return true;
  }
  if (check.status === 401) {
    state.lastError = "session rejected (401)";
    console.log(C.red(`✗ Defender reached, but it rejected session ${state.sessionId}.`));
    if (health.ok && health.data?.demoMode === false) {
      console.log("  The defender was started with SAFECUT_DEMO_MODE=0.");
      console.log("  Restart it with START_DEFENDER.bat (demo mode is on by default),");
      console.log("  or type 'join' and enter the session ID + token shown on its console.");
    } else {
      console.log("  The defender is running an old build. Re-run START_DEFENDER.bat on it");
      console.log("  so it rebuilds, or type 'join' and enter the ID + token from its console.");
    }
    console.log();
    return false;
  }
  state.lastError = `HTTP ${check.status}`;
  console.log(C.red(`✗ Unexpected response from defender: HTTP ${check.status}`));
  return false;
}

async function askForAddress(rl: readline.Interface): Promise<void> {
  console.log(C.bold("Enter the defender's address."));
  console.log(C.dim("It is shown on the defender console under 'Attacker Connection'."));
  while (true) {
    const ans = (await rl.question("Defender IP: ")).trim();
    if (!ans) continue;
    const url = normaliseUrl(ans);
    if (!url) { console.log(C.red("  That does not look like an IP address. Example: 192.168.43.12")); continue; }
    state.serverUrl = url;
    return;
  }
}

// ─── Events ────────────────────────────────────────────────────────────────────
async function sendEvent(eventType: string, quiet = false): Promise<boolean> {
  if (!state.connected) {
    console.log(C.yellow("Not paired yet, trying to connect first..."));
    if (!(await connect(false))) return false;
  }
  if (!quiet) console.log(`\n[${new Date().toLocaleTimeString()}] Sending ${C.bold(eventType)} against ${C.cyan(state.targetNode)} ...`);
  const r = await api("POST", "/api/attack-event", {
    sessionId: state.sessionId,
    sessionToken: state.sessionToken,
    eventType,
    targetNode: state.targetNode,
    description: `Simulated ${eventType} against ${state.targetNode} from attacker laptop`,
  });

  if (r.ok) {
    console.log(C.green(`✓ ${eventType} recorded on defender`));
    const s = r.data.safecutResult;
    if (s) {
      console.log("\n" + C.bold("── SafeCut response on defender ─────────────────────────────"));
      console.log(`  Compromised node : ${C.red(s.compromisedNode)}`);
      console.log(`  Links cut        : ${s.cutEdges.length}  ${C.dim(s.cutEdges.map((e: any) => `${e.source}-${e.target}`).join(", "))}`);
      console.log(`  Safety loops     : ${s.safetyLoopsPreserved}/${s.totalSafetyLoops} preserved`);
      console.log(`  Reactor          : ${s.reactorStable ? C.green("STABLE") : C.red("AT RISK")}`);
      console.log(`  Solve time       : ${Number(s.solveTimeMs).toFixed(3)} ms`);
      if (!s.feasible) console.log(C.yellow(`  ⚠ Infeasible     : ${s.infeasibilityReason}`));
      console.log(C.bold("─────────────────────────────────────────────────────────────") + "\n");
    }
    return true;
  }
  if (r.status === 409) {
    console.log(C.yellow("• Same event sent a moment ago, ignored. Wait 5 seconds and retry."));
    return false;
  }
  if (r.status === 0) {
    state.connected = false;
    console.log(C.red("✗ Lost connection to defender."));
    for (const l of explainNetError(r.netError || "")) console.log("  " + l);
    return false;
  }
  if (r.status === 401) {
    state.connected = false;
    console.log(C.red("✗ Session no longer valid (defender restarted?). Type 'connect'."));
    return false;
  }
  console.log(C.red(`✗ Failed: ${r.data?.error ?? `HTTP ${r.status}`}`));
  return false;
}

async function fetchEvents() {
  const r = await api("GET",
    `/api/attack-event?sessionId=${encodeURIComponent(state.sessionId)}&sessionToken=${encodeURIComponent(state.sessionToken)}&limit=20`);
  if (!r.ok) {
    console.log(C.red(`✗ Could not fetch events (${r.status === 0 ? r.netError : "HTTP " + r.status})`));
    return;
  }
  const events = r.data.events ?? [];
  if (!events.length) { console.log("\nNo events recorded yet.\n"); return; }
  console.log(`\n── Recent events for ${state.sessionId} (newest first) ──`);
  for (const ev of events) {
    const time = ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : "?";
    console.log(`  ${time}  ${String(ev.threat_node).padEnd(16)} ${ev.log_messages?.[0] ?? ""}${ev.safecut_triggered ? C.green(" [SAFECUT]") : ""}`);
  }
  console.log();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runDemo() {
  console.log(C.bold("\nRunning full kill chain against " + state.targetNode));
  const steps: [string, string][] = [
    ["recon", "Reconnaissance: mapping the OT network"],
    ["scan", "Scanning Modbus/TCP services"],
    ["lateral", "Lateral movement toward the process controller"],
    ["exploit", "Exploit: unauthorised write to protected register"],
  ];
  for (const [ev, label] of steps) {
    console.log(C.cyan(`\n» ${label}`));
    const ok = await sendEvent(ev, true);
    if (!ok) { console.log(C.red("Demo stopped.")); return; }
    await sleep(1500);
  }
  console.log(C.green("Kill chain complete. Watch the defender's Network Graph.\n"));
}

// ─── UI ────────────────────────────────────────────────────────────────────────
function printHeader() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║              SafeCut Adversary Emulation Shell v2.0               ║");
  console.log("║                    Simulated OT Attack Terminal                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");
}

function printStatus() {
  console.log("\n── Status ────────────────────────────────────────────────────────");
  console.log(`  Defender   : ${state.serverUrl || "(not set)"}`);
  console.log(`  Session    : ${state.sessionId}`);
  console.log(`  Target     : ${state.targetNode}`);
  console.log(`  Paired     : ${state.connected ? C.green("YES") : C.red("NO")}`);
  if (state.lastError) console.log(`  Last error : ${state.lastError}`);
  console.log("──────────────────────────────────────────────────────────────────\n");
}

function printHelp() {
  console.log(`
${C.bold("Attack commands")}
  exploit              Compromise the target (defender runs SafeCut)
  demo                 Run the full kill chain: recon, scan, lateral, exploit
  recon | scan | lateral | impact   Individual simulated stages
  target <node>        Change target (${VALID_TARGETS.join(", ")})

${C.bold("Connection")}
  connect [ip]         Connect / reconnect (optionally to a new defender IP)
  doctor               Diagnose connection problems
  join                 Use a custom session ID + token (only if demo mode is off)
  status | events | clear | help | exit
`);
}

async function joinSession(rl: readline.Interface) {
  const id = (await rl.question("Session ID (e.g. SAFECUT-A1B2): ")).trim().toUpperCase();
  const tok = (await rl.question("Session token: ")).trim();
  if (!id || !tok) { console.log(C.red("Both are required.")); return; }
  state.sessionId = id;
  state.sessionToken = tok;
  await connect();
}

async function doctor() {
  console.log(C.bold("\nConnection doctor"));
  console.log(`  Defender address : ${state.serverUrl || "(not set)"}`);
  if (!state.serverUrl) { console.log("  Type: connect <defender-ip>\n"); return; }
  const host = new URL(state.serverUrl).hostname;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.startsWith("169.254.")) {
    console.log(C.yellow(`  Note: ${host} can be a virtual adapter (WSL/Hyper-V) instead of the hotspot.`));
    console.log(C.yellow("  iPhone hotspots do use 172.20.10.x, which is fine. If it matches the"));
    console.log(C.yellow("  defender console's 'Attacker Connection' box, it is correct."));
  }
  await connect();
}

// ─── Main loop ─────────────────────────────────────────────────────────────────
async function main() {
  const rl = readline.createInterface({ input, output });
  let closed = false;
  rl.on("close", () => { closed = true; });

  printHeader();
  if (!state.serverUrl) {
    console.log();
    await askForAddress(rl);
  }
  let ok = await connect();
  while (!ok && !closed) {
    const ans = (await rl.question(
      C.yellow("Retry? [Enter] = retry, or type a different IP, or 's' to skip: "))).trim();
    if (ans.toLowerCase() === "s") break;
    if (ans) {
      const url = normaliseUrl(ans);
      if (url) state.serverUrl = url;
      else { console.log(C.red("Not a valid IP.")); continue; }
    }
    ok = await connect();
  }
  if (ok) console.log(C.dim("Type 'exploit' to attack PLC_02, 'demo' for the full kill chain, or 'help'.\n"));

  while (!closed) {
    try {
      const prompt = (state.connected ? C.green("safecut-attacker") : C.red("safecut-attacker"))
        + ":" + C.cyan(state.targetNode) + "$ ";
      const line = (await rl.question(prompt)).trim();
      if (!line) continue;
      const [cmdRaw, ...args] = line.split(/\s+/);
      const cmd = cmdRaw.toLowerCase();
      switch (cmd) {
        case "help": case "?": printHelp(); break;
        case "status": printStatus(); break;
        case "connect": case "pair": {
          if (args[0]) {
            const url = normaliseUrl(args[0]);
            if (!url) { console.log(C.red("Not a valid IP.")); break; }
            state.serverUrl = url;
          }
          if (!state.serverUrl) await askForAddress(rl);
          await connect();
          break;
        }
        case "doctor": await doctor(); break;
        case "join": await joinSession(rl); break;
        case "target":
          if (!args[0]) { console.log(`Current target: ${state.targetNode}\nValid: ${VALID_TARGETS.join(", ")}`); break; }
          if (VALID_TARGETS.includes(args[0].toUpperCase())) {
            state.targetNode = args[0].toUpperCase();
            console.log(`Target set to ${C.cyan(state.targetNode)}`);
          } else console.log(C.red(`Invalid target. Valid: ${VALID_TARGETS.join(", ")}`));
          break;
        case "recon": case "scan": case "exploit": case "lateral": case "impact":
          await sendEvent(cmd); break;
        case "demo": await runDemo(); break;
        case "events": await fetchEvents(); break;
        case "clear": console.clear(); printHeader(); break;
        case "exit": case "quit": rl.close(); process.exit(0);
        default: console.log(`Unknown command '${cmd}'. Type 'help'.`);
      }
    } catch (err: any) {
      if (err?.code === "ERR_USE_AFTER_CLOSE" || err?.message === "Aborted") break;
      console.error("Error:", err?.message ?? err);
    }
  }
  process.exit(0);
}

main().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
