"""
One-shot generator for workflow/founder_to_agentic_enterprise.json.
Run: python build_n8n_workflow.py
"""
import json
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROMPTS = ROOT / "prompts"
COMPANIES = ROOT / "companies"

def read(p):
    return pathlib.Path(p).read_text(encoding="utf-8")

# Load prompts.
research_prompt   = read(PROMPTS / "research.md")
qualification_prompt = read(PROMPTS / "qualification.md")
offer_prompt      = read(PROMPTS / "offer_design.md")
draft_prompt      = read(PROMPTS / "customer_draft.md")

# Load company packs and embed as a JS dictionary inside Load Company Pack.
packs = {}
for mode in ["executive-education", "market-intelligence", "growth-agency"]:
    base = COMPANIES / mode
    packs[mode] = {
        "company_brief": (base / "company_brief.md").read_text(encoding="utf-8"),
        "pricing_rules": json.loads((base / "pricing_rules.json").read_text(encoding="utf-8")),
        "approval_policy": json.loads((base / "approval_policy.json").read_text(encoding="utf-8")),
    }

load_pack_js = "const PACKS = " + json.dumps(packs, ensure_ascii=False) + ";\n" + r"""
const mode = $json.company_mode;
const pack = PACKS[mode];
if (!pack) {
  throw new Error('Unknown company_mode: ' + mode);
}
return [{
  json: {
    ...$json,
    company_brief: pack.company_brief,
    pricing_rules: pack.pricing_rules,
    approval_policy: pack.approval_policy,
  }
}];
"""

# Inline plain-JS version of evaluatePolicy from scripts/policy_gate.ts.
policy_js = r"""
const PERSONAL_EMAIL_DOMAINS = [
  '@gmail.com','@yahoo.com','@yahoo.fr','@hotmail.com','@hotmail.fr',
  '@outlook.com','@outlook.fr','@icloud.com','@me.com','@live.com',
  '@aol.com','@proton.me','@protonmail.com'
];

const BLOCKED_ACTION_TRIGGERS = {
  auto_send_outbound_email: ['send the emails directly','envoi automatique','envoyer automatiquement'],
  auto_send_to_unverified_recipient: ['no human review','sans validation'],
  scrape_private_profiles: ['scraping','scrape ','scraper','profils privés'],
  bypass_optout: ['no casl','sans casl','no gdpr','sans rgpd','bypass opt-out','contourner'],
  purchase_opaque_data_lists: ['acheter une base','buy a database'],
  share_other_client_data: ['data from your client','données de votre client','comme vous avez fait pour'],
  promise_delivery_under_14_days: ['en moins de 14 jours','dans 10 jours','dans 12 jours'],
  monitor_more_than_5_competitors: ['suivre 6 concurrents','suivre 7 concurrents','suivre 8 concurrents','suivre 9 concurrents','suivre 10 concurrents'],
  include_personal_data_about_named_individuals: ['dossier nominatif','données personnelles sur'],
};

function bodyContains(body, needle) {
  if (!body || !needle) return false;
  return String(body).toLowerCase().includes(String(needle).toLowerCase());
}
function maxOfferPrice(offer_id, pricing_rules) {
  const list = (pricing_rules && pricing_rules.offer_catalog) || [];
  const entry = list.find(o => o.id === offer_id);
  return entry ? Number(entry.price_max || 0) : 0;
}

const data = $json;
const approval = data.approval_policy || {};
const draftBody = (data.customer_draft_output && data.customer_draft_output.body) || '';
const draftSubject = (data.customer_draft_output && data.customer_draft_output.subject) || '';
const fullDraft = draftSubject + '\n' + draftBody;
const inboundMsg = ((data.lead && data.lead.inbound_message) || '').toLowerCase();

const reasons = [];
let blocked = false;

const patterns = approval.blocked_claim_patterns || [];
for (const p of patterns) {
  if (bodyContains(fullDraft, p)) { reasons.push('blocked_claim_pattern_detected'); blocked = true; break; }
}
if (approval.privacy_rules && approval.privacy_rules.no_personal_email_bcc) {
  for (const dom of PERSONAL_EMAIL_DOMAINS) {
    if (bodyContains(fullDraft, dom)) { reasons.push('personal_email_bcc'); blocked = true; break; }
  }
}
const blockedActions = approval.blocked_actions || [];
for (const action of blockedActions) {
  const triggers = BLOCKED_ACTION_TRIGGERS[action] || [];
  if (triggers.some(t => inboundMsg.includes(t.toLowerCase()))) {
    reasons.push('requested_blocked_action'); blocked = true; break;
  }
}
if (approval.privacy_rules && approval.privacy_rules.no_other_client_names_in_draft) {
  if (inboundMsg.includes('your client') || inboundMsg.includes('votre client') ||
      inboundMsg.includes('the playbook you built for') || inboundMsg.includes('reuse the playbook')) {
    reasons.push('other_client_referenced'); blocked = true;
  }
}
const offer_id = (data.offer_design_output && data.offer_design_output.recommended_offer) || '';
const offerMax = maxOfferPrice(offer_id, data.pricing_rules);
const threshold = Number(approval.max_auto_approved_price);
if (!isNaN(threshold) && offerMax > threshold) reasons.push('price_above_threshold');
if (data.offer_design_output && data.offer_design_output.approval_required === true) reasons.push('offer_marked_approval_required');
const riskFlags = (data.qualification_output && data.qualification_output.risk_flags) || [];
if (Array.isArray(riskFlags) && riskFlags.length > 0) reasons.push('qualification_risk_flag');

let status;
if (blocked) status = 'blocked';
else if (reasons.length > 0) status = 'needs_human_review';
else status = 'approved';

const required_approver = status === 'approved' ? '' : 'founder';
const safe_next_action = status === 'approved'
  ? 'Send the email and append the audit row.'
  : status === 'blocked'
    ? 'Do NOT send. Founder reviews the draft and the policy reasons before any further action.'
    : 'Founder reviews the draft and confirms approval before any send.';

return [{
  json: {
    ...data,
    policy_check: {
      status,
      reasons: Array.from(new Set(reasons)),
      required_approver,
      safe_next_action
    }
  }
}];
"""

# ---- Node builders ----
def pos(x, y): return [x, y]

X0, DX, Y = 100, 220, 300

def webhook_node():
    return {
        "parameters": {
            "httpMethod": "POST",
            "path": "founder-to-agentic-enterprise",
            "responseMode": "lastNode",
            "options": {}
        },
        "id": "node_webhook",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": pos(X0, Y),
        "webhookId": "founder-to-agentic-enterprise"
    }

def set_input_node():
    return {
        "parameters": {
            "mode": "manual",
            "duplicateItem": False,
            "assignments": {
                "assignments": [
                    {"id": "a1", "name": "company_mode", "value": "={{$json.body.company_mode}}", "type": "string"},
                    {"id": "a2", "name": "lead", "value": "={{$json.body.lead}}", "type": "object"},
                    {"id": "a3", "name": "run_id", "value": "={{$execution.id}}", "type": "string"},
                    {"id": "a4", "name": "started_at", "value": "={{$now.toISO()}}", "type": "string"}
                ]
            },
            "includeOtherFields": False,
            "options": {}
        },
        "id": "node_set_input",
        "name": "Set Input",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": pos(X0 + DX, Y)
    }

def code_node(name, ident, js, x):
    return {
        "parameters": {"language": "javaScript", "jsCode": js},
        "id": ident,
        "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos(x, Y)
    }

def openai_node(name, ident, system_prompt, user_prompt, x):
    return {
        "parameters": {
            "modelId": {"__rl": True, "value": "gpt-4o-mini", "mode": "list"},
            "messages": {
                "values": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            },
            "jsonOutput": True,
            "options": {"temperature": 0.2}
        },
        "id": ident,
        "name": name,
        "type": "@n8n/n8n-nodes-langchain.openAi",
        "typeVersion": 1.6,
        "position": pos(x, Y),
        "credentials": {"openAiApi": {"id": "REPLACE_OPENAI_CRED_ID", "name": "openai_main"}}
    }

def parse_node(name, ident, output_field, x):
    return {
        "parameters": {
            "mode": "manual",
            "duplicateItem": False,
            "assignments": {
                "assignments": [
                    {
                        "id": "p1",
                        "name": output_field,
                        "value": "={{ JSON.parse($json.message.content) }}",
                        "type": "object"
                    }
                ]
            },
            "includeOtherFields": True,
            "options": {}
        },
        "id": ident,
        "name": name,
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": pos(x, Y)
    }

def if_approved_node(x):
    return {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose"},
                "conditions": [
                    {
                        "id": "c1",
                        "leftValue": "={{ $json.policy_check.status }}",
                        "rightValue": "approved",
                        "operator": {"type": "string", "operation": "equals"}
                    }
                ],
                "combinator": "and"
            },
            "options": {}
        },
        "id": "node_if_approved",
        "name": "IF Approved",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": pos(x, Y)
    }

def gmail_node(x):
    return {
        "parameters": {
            "resource": "message",
            "operation": "send",
            "sendTo": "={{ $json.lead.recipient_email }}",
            "subject": "={{ $json.customer_draft_output.subject }}",
            "emailType": "text",
            "message": "={{ $json.customer_draft_output.body }}",
            "options": {
                "replyTo": "={{ $env.GMAIL_REPLY_TO }}"
            }
        },
        "id": "node_gmail_send",
        "name": "Gmail Send",
        "type": "n8n-nodes-base.gmail",
        "typeVersion": 2.1,
        "position": pos(x, Y - 120),
        "credentials": {"gmailOAuth2": {"id": "REPLACE_GMAIL_CRED_ID", "name": "gmail_main"}}
    }

def set_outcome_node(name, ident, x, y, final_action, hr):
    return {
        "parameters": {
            "mode": "manual",
            "duplicateItem": False,
            "assignments": {
                "assignments": [
                    {"id": "o1", "name": "final_action", "value": final_action, "type": "string"},
                    {"id": "o2", "name": "human_approval_required", "value": hr, "type": "boolean"}
                ]
            },
            "includeOtherFields": True,
            "options": {}
        },
        "id": ident,
        "name": name,
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": pos(x, y)
    }

def build_audit_row_node(x):
    return {
        "parameters": {
            "mode": "manual",
            "duplicateItem": False,
            "assignments": {
                "assignments": [
                    {"id": "ar1", "name": "audit_row", "value":
                        "={{ ({\n"
                        "  timestamp: $now.toISO(),\n"
                        "  run_id: $json.run_id,\n"
                        "  company_mode: $json.company_mode,\n"
                        "  input_id: $json.lead.id,\n"
                        "  fit_score: $json.qualification_output.fit_score,\n"
                        "  recommended_offer: $json.offer_design_output.recommended_offer,\n"
                        "  policy_status: $json.policy_check.status,\n"
                        "  reasons: $json.policy_check.reasons,\n"
                        "  human_approval_required: $json.human_approval_required,\n"
                        "  final_action: $json.final_action,\n"
                        "  notes: ($json.policy_check.safe_next_action || '').slice(0,200)\n"
                        "}) }}",
                     "type": "object"}
                ]
            },
            "includeOtherFields": False,
            "options": {}
        },
        "id": "node_build_audit_row",
        "name": "Build Audit Row",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": pos(x, Y)
    }

def append_audit_log_node(x):
    return {
        "parameters": {
            "method": "POST",
            "url": "={{ $env.AUDIT_WEBHOOK_URL }}",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ $json.audit_row }}",
            "options": {}
        },
        "id": "node_append_audit_log",
        "name": "Append Audit Log",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": pos(x, Y)
    }

# ---- Build node list ----
nodes = []
nodes.append(webhook_node())
nodes.append(set_input_node())
nodes.append(code_node("Load Company Pack", "node_load_pack", load_pack_js, X0 + 2*DX))

x = X0 + 3*DX
research_user = "Voici le brief de la société et le lead. Réponds en JSON valide selon le schéma du prompt système.\n\nBRIEF:\n{{ $json.company_brief }}\n\nLEAD:\n{{ JSON.stringify($json.lead) }}"
nodes.append(openai_node("AI Research", "node_ai_research", research_prompt, research_user, x))
x += DX
nodes.append(parse_node("Parse Research", "node_parse_research", "research_output", x))
x += DX

qual_user = "BRIEF:\n{{ $json.company_brief }}\n\nLEAD:\n{{ JSON.stringify($json.lead) }}\n\nRESEARCH:\n{{ JSON.stringify($json.research_output) }}"
nodes.append(openai_node("AI Qualification", "node_ai_qualification", qualification_prompt, qual_user, x))
x += DX
nodes.append(parse_node("Parse Qualification", "node_parse_qualification", "qualification_output", x))
x += DX

offer_user = "BRIEF:\n{{ $json.company_brief }}\n\nPRICING_RULES:\n{{ JSON.stringify($json.pricing_rules) }}\n\nRESEARCH:\n{{ JSON.stringify($json.research_output) }}\n\nQUALIFICATION:\n{{ JSON.stringify($json.qualification_output) }}"
nodes.append(openai_node("AI Offer Design", "node_ai_offer_design", offer_prompt, offer_user, x))
x += DX
nodes.append(parse_node("Parse Offer", "node_parse_offer", "offer_design_output", x))
x += DX

draft_user = "BRIEF:\n{{ $json.company_brief }}\n\nLEAD:\n{{ JSON.stringify($json.lead) }}\n\nOFFRE:\n{{ JSON.stringify($json.offer_design_output) }}"
nodes.append(openai_node("AI Customer Draft (FR)", "node_ai_customer_draft", draft_prompt, draft_user, x))
x += DX
nodes.append(parse_node("Parse Draft", "node_parse_draft", "customer_draft_output", x))
x += DX

nodes.append(code_node("Policy Code (Deterministic)", "node_policy_code", policy_js, x))
x += DX
nodes.append(if_approved_node(x))
x += DX
nodes.append(gmail_node(x))
nodes.append(set_outcome_node("Set Approved Outcome", "node_set_approved", x, Y - 120 + 0, "email_sent", False))
# rearrange: put gmail above and approved-outcome to the right of gmail; blocked-outcome below
# Actually clean layout:
# Replace last two:
nodes.pop(); nodes.pop()
nodes.append(gmail_node(x))                # y = Y-120
nodes.append(set_outcome_node("Set Approved Outcome", "node_set_approved", x + DX, Y - 120, "email_sent", False))
nodes.append(set_outcome_node("Set Blocked Outcome", "node_set_blocked", x + DX, Y + 120, "human_review_required", True))
x += 2*DX
nodes.append(build_audit_row_node(x))
x += DX
nodes.append(append_audit_log_node(x))

# ---- Connections ----
def link(src, dst, src_out=0, dst_in=0, branch="main"):
    return src, dst, branch, src_out, dst_in

connections = {}
def connect(src, dst, src_branch="main", src_out=0):
    connections.setdefault(src, {}).setdefault(src_branch, [])
    while len(connections[src][src_branch]) <= src_out:
        connections[src][src_branch].append([])
    connections[src][src_branch][src_out].append({"node": dst, "type": "main", "index": 0})

linear = [
    "Webhook", "Set Input", "Load Company Pack",
    "AI Research", "Parse Research",
    "AI Qualification", "Parse Qualification",
    "AI Offer Design", "Parse Offer",
    "AI Customer Draft (FR)", "Parse Draft",
    "Policy Code (Deterministic)", "IF Approved"
]
for a, b in zip(linear, linear[1:]):
    connect(a, b)

# IF branches
connect("IF Approved", "Gmail Send", src_out=0)        # true
connect("IF Approved", "Set Blocked Outcome", src_out=1)  # false
connect("Gmail Send", "Set Approved Outcome")
connect("Set Approved Outcome", "Build Audit Row")
connect("Set Blocked Outcome", "Build Audit Row")
connect("Build Audit Row", "Append Audit Log")

workflow = {
    "name": "Founder to Agentic Enterprise",
    "nodes": nodes,
    "connections": connections,
    "active": False,
    "settings": {"executionOrder": "v1"},
    "tags": [],
    "meta": {"templateCredsSetupCompleted": False}
}

out = ROOT / "workflow" / "founder_to_agentic_enterprise.json"
out.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {out}  ({len(nodes)} nodes)")
