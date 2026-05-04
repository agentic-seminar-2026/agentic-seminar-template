# Architecture

## Business narrative

A founder bootstrapping an AI-native company faces three repeated decisions
on every inbound opportunity:

1. **Is this lead worth my time?** (qualification)
2. **What should I sell them, at what price?** (offer design)
3. **What should I send them, and is it safe to send?** (drafting + governance)

Without leverage, the founder does all three by hand. With agents, they can
delegate the *work* but must keep the *decision rights*. This demo shows the
minimum viable structure: agents draft, code enforces policy, humans approve
exceptions, every action is logged.

## Shared workflow (one workflow, three companies)

```
                       ┌───────────────────────────────────────┐
                       │                                       │
   Inbound lead ─►  Webhook ─► Set Input ─► Load Company Pack ─┤
                                                               │
                                              ┌────────────────┘
                                              ▼
                                        AI Research
                                              │
                                              ▼
                                       AI Qualification
                                              │
                                              ▼
                                       AI Offer Design
                                              │
                                              ▼
                                  AI Customer Draft (FR)
                                              │
                                              ▼
                                 ┌──── Policy Code Node ────┐
                                 │   (deterministic gate)   │
                                 └────────────┬─────────────┘
                                              │
                              status == "approved"?
                                              │
                              ┌───────────────┴────────────────┐
                              ▼                                ▼
                       Gmail Send (real)            Human Review Placeholder
                              │                                │
                              └────────────┬───────────────────┘
                                           ▼
                                Append to audit_log.jsonl
```

The same node graph runs for all three companies. Only the *Load Company
Pack* output differs.

## What changes per company

A "company pack" is four files under `companies/<mode>/`:

| File | Purpose | Read by |
| --- | --- | --- |
| `company_brief.md` | Founder context fed into prompts as system context | All AI nodes |
| `pricing_rules.json` | Offer catalog & price ranges | Offer Design + Policy Code |
| `approval_policy.json` | Auto-approval threshold, blocked claims/actions | Policy Code |
| `seed_inputs.json` | The 3 demo leads (good fit / borderline / risky) | Trigger payload |

Nothing else changes. No new nodes, no rewiring.

## Human vs agent responsibility

| Concern | Owner |
| --- | --- |
| Define company brief, services, pricing | **Founder (human, design time)** |
| Set policy thresholds and blocked actions | **Founder (human, design time)** |
| Approve seed leads to enter the system | **Founder (human, demo time)** |
| Research the lead, summarize, qualify | **Agent (LLM)** |
| Recommend an offer within catalog | **Agent (LLM, constrained)** |
| Draft the French customer email | **Agent (LLM)** |
| Decide if the email is safe to send | **Code (deterministic)** |
| Approve exceptions | **Founder (human, runtime)** |
| Audit every decision | **Code** |

The single most important boundary is the line between **AI Customer Draft**
and **Policy Code Node**. Above that line, the LLM is free to be wrong.
Below that line, the rules are deterministic and auditable.

## Where governance is enforced

1. **Pricing gate** — `pricing_rules.json` constrains the offer catalog the
   AI may propose. The Policy Code re-validates the proposed price against
   `approval_policy.max_auto_approved_price`.
2. **Claim gate** — `approval_policy.blocked_claim_types` lists patterns the
   draft must not contain (guarantees of outcomes, ROI promises, regulated
   advice). The Policy Code substring-checks the draft body.
3. **Privacy gate** — `approval_policy.privacy_rules` blocks BCCing personal
   addresses or referencing sensitive data categories.
4. **Action gate** — `approval_policy.blocked_actions` (e.g.
   `auto_send_to_unverified_recipient`) is enforced by the workflow topology
   itself: the Gmail node sits *after* the IF on `status == approved`.
5. **Audit gate** — every run, regardless of outcome, appends a JSONL row.
   Audit is non-skippable.

## Failure modes and how the system degrades

| Failure | Behavior |
| --- | --- |
| OpenAI rate-limit or 5xx | n8n node retries 2× then fails the run. Audit row written with `final_action: "error"`. The runbook shows how to switch to canned responses in `data/canned_responses/` for offline demo. |
| Model returns invalid JSON | Set node parses with try/catch, emits `policy_status: "needs_human_review"` and routes to the Human Review branch. |
| Policy file missing or malformed | `validate_company_pack.ts` is run as a pre-flight (CI + before each demo). Workflow refuses to send when the policy file fails to parse — defaults to `"blocked"`. |
| Gmail OAuth expired | Approved branch fails; audit row notes `final_action: "send_failed"`. No risky sends. |
