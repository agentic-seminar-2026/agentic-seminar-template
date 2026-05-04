# Demo narrative — where this fits in the seminar

The 3-hour seminar **Governing the Agentic Enterprise** has three blocks:

| Block | Focus | This demo's role |
| --- | --- | --- |
| 1. Frame | Why founder-led firms break first under agentic automation. | Setup. We point at the demo as the tangible artifact for block 2. |
| 2. Live demos | One workflow, three company modes, one governance gate. | **This demo runs here.** |
| 3. Translate | Participants draft their own governance pack. | We hand them the company pack template and the policy gate as a starting point. |

## Story in one sentence

> One founder, one webhook, three different businesses — and the
> same deterministic governance gate decides what ships and what
> waits for a human.

## Three modes, one workflow

The same n8n workflow is reused across three founder archetypes the
participants recognize:

1. **executive-education** — Atelier Stratégie IA. Sells executive workshops.
2. **market-intelligence** — Studio Veille Stratégique. Sells competitive intel.
3. **growth-agency** — Croissance B2B. Sells outbound campaigns.

Each mode has its own `companies/<mode>/` pack: brief, pricing,
approval policy, seed inputs. The mode is selected by the
`company_mode` field in the inbound webhook payload.

## Why this story works on stage

- It's concrete: a real email lands in the controlled inbox at the end of
  the happy path.
- It's safe: the risky case is engineered to trip ≥2 independent policy
  rules, and the deterministic gate is unit-tested before showtime.
- It's portable: participants change one JSON file and the same workflow
  serves a different business, which is the punch line of block 3.

## What the audience should leave with

- The mental model: **agent decides drafts, deterministic gate decides actions**.
- The artifact: a concrete governance pack they can edit during block 3.
- The receipt: an audit row for every decision, theirs or the agent's.
