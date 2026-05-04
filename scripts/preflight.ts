/**
 * Pre-seminar preflight check.
 * Runs every gate that can be verified offline, in order.
 * One green line at the end = ready to project.
 *
 * Usage:  npm run preflight
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

let failed = 0;

function step(name: string, fn: () => void) {
  process.stdout.write(`  ... ${name}\n`);
  try {
    fn();
    process.stdout.write(`  OK  ${name}\n`);
  } catch (e) {
    failed += 1;
    process.stdout.write(`  FAIL ${name}: ${(e as Error).message}\n`);
  }
}

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}`);
}

// --- 1. validate every company pack
step("validate all 3 company packs", () => run("npm", ["run", "validate", "--", "--all"]));

// --- 2. policy gate assertions (happy + 3 risky)
step("policy gate test suite", () => run("npm", ["run", "test:policy"]));

// --- 3. .env sanity (no secret values printed)
step(".env has N8N_WEBHOOK_URL and OPENAI_API_KEY", () => {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) {
    throw new Error(".env not found at project root. Copy .env.example to .env and fill it in.");
  }
  const txt = readFileSync(envPath, "utf8");
  const required = ["N8N_WEBHOOK_URL", "OPENAI_API_KEY"];
  const missing: string[] = [];
  for (const k of required) {
    const re = new RegExp(`^\\s*${k}\\s*=\\s*\\S+`, "m");
    if (!re.test(txt)) missing.push(k);
  }
  if (missing.length) throw new Error(`missing/empty in .env: ${missing.join(", ")}`);
});

// --- 4. workflow JSON exists and parses
step("n8n workflow JSON parses", () => {
  const wf = join(ROOT, "workflow", "founder_to_agentic_enterprise.json");
  if (!existsSync(wf)) throw new Error("workflow JSON missing; run scripts/build_n8n_workflow.py");
  const data = JSON.parse(readFileSync(wf, "utf8"));
  if (!Array.isArray(data.nodes) || data.nodes.length < 10) {
    throw new Error(`workflow looks empty (nodes=${data.nodes?.length ?? 0})`);
  }
});

// --- 5. canned responses are present (offline fallback A)
step("canned fallback responses present", () => {
  const dir = join(ROOT, "data", "canned_responses");
  const expected = ["research.json", "qualification.json", "offer_design.json", "customer_draft.json", "policy_check.json"];
  const missing = expected.filter((f) => !existsSync(join(dir, f)));
  if (missing.length) throw new Error(`missing canned files: ${missing.join(", ")}`);
});

// --- 6. (soft) n8n REST reachable if N8N_BASE_URL + N8N_API_KEY set.
//     Doesn't fail preflight; just logs status so you know whether
//     `npm run push:workflow` will work right now.
async function softCheckN8n() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const env: Record<string, string> = {};
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  const base = (env.N8N_BASE_URL || "").replace(/\/+$/, "");
  const key = env.N8N_API_KEY || "";
  if (!base || !key) {
    process.stdout.write("  ..  n8n REST: skipped (N8N_BASE_URL or N8N_API_KEY not set)\n");
    return;
  }
  try {
    const r = await fetch(`${base}/workflows`, { headers: { "X-N8N-API-KEY": key } });
    if (r.ok) {
      process.stdout.write(`  OK  n8n REST reachable at ${base}\n`);
    } else {
      process.stdout.write(`  WARN n8n REST returned ${r.status} at ${base} (push:workflow may fail)\n`);
    }
  } catch (e) {
    process.stdout.write(`  WARN n8n REST unreachable at ${base}: ${(e as Error).message}\n`);
  }
}

await softCheckN8n();

console.log("");
if (failed === 0) {
  console.log("PREFLIGHT OK \u2014 ready to project.");
  process.exit(0);
} else {
  console.log(`PREFLIGHT FAILED \u2014 ${failed} check(s) above need attention.`);
  process.exit(1);
}
