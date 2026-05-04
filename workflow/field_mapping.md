# Field mapping

How JSON keys flow between nodes. Read top to bottom.

## Webhook → Set Input

| Webhook body | Set Input field |
| --- | --- |
| `body.company_mode` | `company_mode` |
| `body.lead` | `lead` |
| (generated) | `run_id = $execution.id` |
| (generated) | `started_at = new Date().toISOString()` |

## Set Input → Load Company Pack

| In | Out |
| --- | --- |
| `company_mode` | `company_brief` (markdown), `pricing_rules` (JSON), `approval_policy` (JSON) |

## Load Company Pack → AI Research

| Prompt input | Source |
| --- | --- |
| `{{company_brief}}` | from Load Company Pack |
| `{{lead}}` | from Set Input |

Output: raw `message.content` string (JSON).

## AI Research → Parse Research → AI Qualification

| Field | Source |
| --- | --- |
| `research_output.lead_name` | LLM |
| `research_output.company_name` | LLM |
| `research_output.summary` | LLM |
| `research_output.likely_needs[]` | LLM |
| `research_output.opportunity_hypothesis` | LLM |
| `research_output.caveats[]` | LLM |
| `research_output.confidence` | LLM |

AI Qualification consumes `company_brief`, `lead`, `research_output`.

## AI Qualification → Parse Qualification → AI Offer Design

| Field | Source |
| --- | --- |
| `qualification_output.fit_score` | LLM |
| `qualification_output.urgency` | LLM |
| `qualification_output.budget_signal` | LLM |
| `qualification_output.risk_flags[]` | LLM |
| `qualification_output.recommended_next_step` | LLM |
| `qualification_output.reasoning_summary` | LLM |

AI Offer Design consumes `company_brief`, `pricing_rules`,
`research_output`, `qualification_output`.

## AI Offer Design → Parse Offer → AI Customer Draft

| Field | Source |
| --- | --- |
| `offer_design_output.recommended_offer` | LLM (must match `pricing_rules.offer_catalog[].id`) |
| `offer_design_output.price_range` | LLM |
| `offer_design_output.why_this_offer` | LLM |
| `offer_design_output.included_deliverables[]` | LLM |
| `offer_design_output.approval_required` | LLM |

AI Customer Draft consumes `company_brief`, `lead`, `offer_design_output`.

## AI Customer Draft → Parse Draft → Policy Code

| Field | Source |
| --- | --- |
| `customer_draft_output.subject` | LLM (FRENCH) |
| `customer_draft_output.body` | LLM (FRENCH) |
| `customer_draft_output.tone_check` | LLM |
| `customer_draft_output.claims_to_verify[]` | LLM |
| `customer_draft_output.send_status` | always `"draft_only"` |

Policy Code consumes:
`approval_policy`, `pricing_rules`, `offer_design_output`,
`customer_draft_output`, `qualification_output`, `lead`.

## Policy Code → IF

| Out | Used by IF |
| --- | --- |
| `policy_check.status` | route on `== "approved"` |

## Approved branch

| Source | Gmail field |
| --- | --- |
| `lead.recipient_email` | To |
| `customer_draft_output.subject` | Subject |
| `customer_draft_output.body` | Text body |
| env `GMAIL_FROM` | From |
| env `GMAIL_REPLY_TO` | Reply-To |

Then Set Approved Outcome:

| Out |
| --- |
| `final_action = "email_sent"` |
| `human_approval_required = false` |

## Blocked branch

Set Blocked Outcome:

| Out |
| --- |
| `final_action = "human_review_required"` |
| `human_approval_required = true` |

## Both branches → Build Audit Row → Append Audit Log

Final `audit_row` JSON:

| Field | Source |
| --- | --- |
| `timestamp` | `new Date().toISOString()` |
| `run_id` | `$execution.id` |
| `company_mode` | `company_mode` |
| `input_id` | `lead.id` |
| `fit_score` | `qualification_output.fit_score` |
| `recommended_offer` | `offer_design_output.recommended_offer` |
| `policy_status` | `policy_check.status` |
| `reasons` | `policy_check.reasons` |
| `human_approval_required` | from Set Approved/Blocked Outcome |
| `final_action` | from Set Approved/Blocked Outcome |
| `notes` | short string built in Build Audit Row |

The HTTP Request node POSTs `audit_row` to the audit sink (webhook.site,
Google Sheets, Slack — your choice).
