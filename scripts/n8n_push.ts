/**
 * Push the workflow JSON to n8n via REST API.
 *
 * Works against:
 *   - n8n Cloud:  N8N_BASE_URL=https://<workspace>.app.n8n.cloud/api/v1
 *   - Self-hosted local fallback (docker-compose.local.yml):
 *                 N8N_BASE_URL=http://localhost:5678/api/v1
 *
 * Reads N8N_BASE_URL and N8N_API_KEY from .env.
 * Creates the workflow if it does not exist, otherwise updates it
 * (matched by name).
 *
 * IMPORTANT: credentials are NOT pushed. After upload, open the workflow
 * in the n8n UI and re-attach `openai_main` and `gmail_main`.
 *
 * Usage:  npm run push:workflow
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WORKFLOW_PATH = join(ROOT, "workflow", "founder_to_agentic_enterprise.json");

function loadEnv(): Record<string, string> {
  const envPath = join(ROOT, ".env");
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const base = (env.N8N_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = env.N8N_API_KEY || "";
  if (!base) die("N8N_BASE_URL is not set in .env");
  if (!apiKey) die("N8N_API_KEY is not set in .env");
  if (!existsSync(WORKFLOW_PATH)) {
    die(`workflow JSON not found at ${WORKFLOW_PATH} — run scripts/build_n8n_workflow.py first`);
  }

  const wf = JSON.parse(readFileSync(WORKFLOW_PATH, "utf8")) as {
    name?: string;
    nodes?: unknown[];
    connections?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };
  const wfName = wf.name || "founder_to_agentic_enterprise";

  // n8n REST API expects: { name, nodes, connections, settings? }
  const payload = {
    name: wfName,
    nodes: wf.nodes ?? [],
    connections: wf.connections ?? {},
    settings: wf.settings ?? {},
  };

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-N8N-API-KEY": apiKey,
  };

  console.log(`Target  : ${base}`);
  console.log(`Workflow: ${wfName}  (${(wf.nodes ?? []).length} nodes)`);

  // 1. Look up by name to decide POST vs PUT.
  const listRes = await fetch(`${base}/workflows`, { headers });
  if (!listRes.ok) {
    die(`GET /workflows failed: ${listRes.status} ${await listRes.text()}`);
  }
  const listJson = (await listRes.json()) as { data?: Array<{ id: string; name: string }> };
  const existing = (listJson.data || []).find((w) => w.name === wfName);

  let res: Response;
  if (existing) {
    console.log(`Updating existing workflow id=${existing.id} ...`);
    res = await fetch(`${base}/workflows/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
  } else {
    console.log("Creating new workflow ...");
    res = await fetch(`${base}/workflows`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  if (!res.ok) {
    die(`Push failed: ${res.status} ${await res.text()}`);
  }
  const out = (await res.json()) as { id?: string; name?: string };
  console.log(`OK  pushed  id=${out.id}  name=${out.name}`);
  console.log("");
  console.log("Next steps in the n8n UI:");
  console.log("  1. Open the workflow.");
  console.log("  2. Re-attach credentials `openai_main` and `gmail_main` on the AI and Gmail nodes.");
  console.log("  3. Activate the workflow and copy the Production webhook URL into .env as N8N_WEBHOOK_URL.");
}

main().catch((e) => die(String(e)));
