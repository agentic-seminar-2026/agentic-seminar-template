# Workflow specification

This document narrates the n8n workflow node by node. It is the
human-readable companion to `node_map.json` and
`founder_to_agentic_enterprise.json`. If those drift, this is the source of
truth — rebuild from here.

## High-level

A single n8n workflow with one webhook entry point and two terminal
branches (approved → real Gmail send → audit; blocked → audit only).

## Node-by-node

### 1. `Webhook` — `Webhook` node

- **Method**: `POST`
- **Path**: `founder-demo`
- **Response**: `Last Node` (responds with the final audit row JSON)
- **Body schema (expected)**:
  ```json
  {
    "company_mode": "executive-education|market-intelligence|growth-agency",
    "lead": {
      "id": "string",
      "name": "string",
      "title": "string",
      "company": "string",
      "company_size": 0,
      "country": "string",
      "source": "string",
      "timestamp": "ISO-8601",
      "recipient_email": "string (must be a controlled inbox)",
      "inbound_message": "string (FR or EN)"
    }
  }
  ```

### 2. `Set Input` — `Set` node

Promotes webhook body into named, typed fields the rest of the flow can
reference cleanly:

- `company_mode = $json.body.company_mode`
- `lead = $json.body.lead`
- `run_id = $execution.id`
- `started_at = new Date().toISOString()`

### 3. `Load Company Pack` — `Code` node

Reads the three pack files for `company_mode` from disk (n8n Cloud bundles
them as workflow static data) and returns:

```json
{
  "company_mode": "...",
  "company_brief": "<markdown string>",
  "pricing_rules": { ... },
  "approval_policy": { ... }
}
```

> **Implementation note** — n8n Cloud cannot read arbitrary local files. We
> embed the pack contents as **workflow static data** keyed by mode. The
> `prepare_demo_case.ts` script also produces a single `runtime/pack.json`
> that you can paste into the Code node's static data field. The static
> data is updated whenever the founder edits a company pack — the
> [n8n-setup runbook](../docs/n8n-setup.md) shows how.

### 4. `AI Research` — `OpenAI` node (chat)

- **Model**: `gpt-4o-mini`
- **Response format**: `JSON object`
- **System prompt**: contents of `prompts/research.md`
- **User prompt** (built in the node):
  ```
  COMPANY BRIEF:
  {{$json.company_brief}}

  LEAD JSON:
  {{JSON.stringify($json.lead)}}
  ```
- **Output**: parsed into `research_output` on the next Set node.

### 5. `Parse Research` — `Set` node

`research_output = JSON.parse($json.message.content)` with try/catch
producing `{}` on failure (which downstream code recognizes as a soft
failure → routes to `needs_human_review`).

### 6. `AI Qualification` — `OpenAI` node

Same shape as step 4. System prompt = `prompts/qualification.md`. User
prompt includes the company brief, the original lead, and
`research_output`.

### 7. `Parse Qualification` — `Set` node

Stores `qualification_output`.

### 8. `AI Offer Design` — `OpenAI` node

System = `prompts/offer_design.md`. User prompt includes the brief, the
**pricing_rules** JSON, the research and qualification outputs.

### 9. `Parse Offer` — `Set` node

Stores `offer_design_output`.

### 10. `AI Customer Draft` — `OpenAI` node

System = `prompts/customer_draft.md`. User prompt includes the brief, the
lead, the offer. Output is a French email JSON.

### 11. `Parse Draft` — `Set` node

Stores `customer_draft_output`.

### 12. `Policy Code` — `Code` node *(deterministic gate — the safety boundary)*

Pure JavaScript. Inputs: `approval_policy`, `pricing_rules`,
`offer_design_output`, `customer_draft_output`, `qualification_output`,
`lead`. Output: a single `policy_check` object:

```json
{
  "status": "approved|blocked|needs_human_review",
  "reasons": ["price_above_threshold", "blocked_claim_pattern_detected", "..."],
  "required_approver": "founder | ''",
  "safe_next_action": "string"
}
```

The function is the same one used in `scripts/test_policy_gate.ts`. See
that file for the canonical reference.

Decision rules (in order; first match wins on `blocked`, accumulate on
`needs_human_review`):

1. If the draft body matches any pattern in
   `approval_policy.blocked_claim_patterns` (case-insensitive substring) →
   **blocked**, reason `blocked_claim_pattern_detected`.
2. If the draft body mentions any other client name (heuristic: matches
   any of a small allowlist of known-client tokens, configured per pack) →
   **blocked**, `other_client_referenced`.
3. If the draft body BCCs or includes a personal email
   (`@gmail.com`, `@yahoo.com`, `@hotmail.com`, `@outlook.com`, etc.) **and**
   `privacy_rules.no_personal_email_bcc` is true → **blocked**,
   `personal_email_bcc`.
4. If the lead's `inbound_message` requests any item in
   `approval_policy.blocked_actions` (substring match against a small
   list of trigger phrases) → **blocked**, `requested_blocked_action`.
5. If the offer's max-price exceeds `max_auto_approved_price` →
   **needs_human_review**, `price_above_threshold`.
6. If `offer_design_output.approval_required` is true and not already
   blocked → **needs_human_review**, `offer_marked_approval_required`.
7. If `qualification_output.risk_flags` is non-empty and not already
   blocked → **needs_human_review**, `qualification_risk_flag`.
8. Otherwise → **approved**.

### 13. `IF policy.status == "approved"` — `IF` node

- True branch → node 14
- False branch → node 16

### 14. `Gmail Send` — `Gmail` node *(real outbound, approved branch only)*

- **Credential**: `gmail_main`
- **From**: env `GMAIL_FROM`
- **Reply-To**: env `GMAIL_REPLY_TO` (defaults to `GMAIL_FROM`)
- **To**: `{{$json.lead.recipient_email}}`
- **Subject**: `{{$json.customer_draft_output.subject}}`
- **Body (Text)**: `{{$json.customer_draft_output.body}}`
- **Attachments**: none
- **No BCC**

### 15. `Set Approved Outcome` — `Set` node

`final_action = "email_sent"`, `human_approval_required = false`.

### 16. `Set Blocked Outcome` — `Set` node *(false branch)*

`final_action = "human_review_required"`, `human_approval_required = true`.
This branch never touches Gmail.

### 17. `Build Audit Row` — `Set` node *(both branches merge)*

```json
{
  "timestamp": "ISO-8601 (now)",
  "run_id": "$execution.id",
  "company_mode": "...",
  "input_id": "lead.id",
  "fit_score": "qualification_output.fit_score",
  "recommended_offer": "offer_design_output.recommended_offer",
  "policy_status": "policy_check.status",
  "reasons": "policy_check.reasons",
  "human_approval_required": true | false,
  "final_action": "email_sent | human_review_required",
  "notes": "short summary string"
}
```

### 18. `Append Audit Log` — `HTTP Request` (recommended) OR `Write Binary File`

**Recommended for live demo**: `HTTP Request` POST to a webhook.site URL
(or any logging endpoint) — the audience can refresh webhook.site and
watch rows arrive.

**Fallback**: `Write Binary File` appending to `/tmp/audit_log.jsonl` on
the n8n container.

### 19. `Respond` — implicit (Webhook responds with the audit row)

Because the Webhook node's `Response` is set to `Last Node`, the caller
(curl in the runbook) gets the audit row back as the HTTP response body.

## Swap points (for first-time n8n users)

| Want to change | Edit |
| --- | --- |
| The trigger style | Replace `Webhook` with `Manual Trigger`; everything else unchanged. |
| Where the audit log goes | Replace node 18 with Google Sheets / Airtable / Slack. |
| The send channel | Replace `Gmail Send` with `Send Email (SMTP)` or `Slack`. |
| The model | Open the three OpenAI nodes; change `model` parameter. |

The deterministic `Policy Code` node should not be replaced lightly — it
is the safety boundary.
