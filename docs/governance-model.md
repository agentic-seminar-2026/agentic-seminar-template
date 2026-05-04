# Governance model — From Founder to Agentic Enterprise

This is the model the demo enacts. It is also the model we teach.

## 1. Decision rights

| Decision | Agent (auto) | Founder (review) | Founder (sole) |
| --- | :---: | :---: | :---: |
| Read inbound message and infer intent | X | | |
| Score qualification (fit, urgency, budget) | X | | |
| Pick an offer **inside the catalog** | X | | |
| Draft customer-facing email **in French** | X | | |
| Send email to a **catalog-priced** offer at a **business address** | X | | |
| Send email when the offer **exceeds the price threshold** | | X | |
| Send email when the draft contains a **blocked claim pattern** | | | X (rewrite first) |
| Discount above auto-approved % | | X | |
| Reuse another client's name or playbook | | | X (always blocked) |
| Send to a personal email or BCC a personal email | | | X (always blocked) |
| Auto-send outbound campaigns | | | X (growth-agency only — always blocked) |

## 2. Approval thresholds (per company mode)

| Mode | Auto-approve up to | Above threshold |
| --- | --- | --- |
| executive-education | 45 000 CAD | Founder review |
| market-intelligence | 28 000 CAD | Founder review |
| growth-agency | 35 000 CAD | Founder review |

Thresholds live in each pack's `approval_policy.json` under
`max_auto_approved_price`. Changing the number is a one-line edit;
shipping that change is a deliberate governance act.

## 3. Hard-blocked actions (never auto-approved, never bypassable)

These are evaluated by the deterministic Code node, not the LLM:

- Claim patterns that promise guaranteed outcomes (`garantit`, `ROI de`, `X rendez-vous garantis`, …).
- Reuse of another client's name or playbook in the draft.
- BCC or send to a personal-email domain (`@gmail.com`, `@hotmail.com`, …).
- Inbound asks to scrape private profiles, bypass CASL/RGPD, or buy opaque lists.
- Inbound asks to monitor more than 5 competitors (market-intelligence).
- Inbound asks to include personal data about a named individual.

A single hit on any of these flips `policy_check.status` to `blocked`.
The IF node routes to the human-review branch and **no email is sent**.

## 4. Escalation logic

```
if claim-pattern hit OR personal-email hit OR blocked-action hit
    → status = "blocked"               # founder must intervene
elif price > threshold OR offer.requires_approval OR risk_flags.length > 0
    → status = "needs_human_review"    # founder must approve
else
    → status = "approved"              # agent sends
```

Order matters. Block always wins over needs-review. Needs-review always wins over approved.

## 5. Auditability

Every run — approved, blocked, or escalated — appends one row to the
audit log with:

- `timestamp`, `run_id`, `company_mode`, `input_id`
- `fit_score`, `recommended_offer`
- `policy_status`, `reasons[]`
- `human_approval_required`, `final_action`
- `notes`

The audit row is the unit of evidence. If you cannot point to the row,
the action did not happen.

## 6. What the LLM is allowed to decide

- Tone, structure, and wording of the French draft.
- Mapping inbound message → likely needs → catalog offer.
- Confidence and risk-flag annotations (advisory).

## 7. What the LLM is NOT allowed to decide

- Whether to send.
- Whether the price is acceptable.
- Whether the recipient is allowed to receive the message.
- Whether a claim is allowed.

Those four decisions belong to the deterministic Code node and the
catalog/policy files. The LLM's `policy_check.md` output is **advisory
only** and is never read by the gate.

## 8. How the founder changes the model

1. Edit the relevant file in `companies/<mode>/`.
2. Re-run `npm run validate` and `npm run test:policy`.
3. If both pass, the change is shippable.

There is no other path. Anything else is shadow governance.
