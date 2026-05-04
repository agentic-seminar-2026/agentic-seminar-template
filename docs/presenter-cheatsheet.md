# Presenter cheat sheet — Governing the Agentic Enterprise

One page. Keep this open on your phone or second screen during the 3-hour seminar.

---

## 0. T-90 minutes

```powershell
cd content\seminars\agentic\assets\founder-to-agentic-enterprise
npm run preflight
```

Expect: `PREFLIGHT OK — ready to project.` If not, fix before doors open.

Then on the projector laptop, open these tabs left-to-right:

1. **n8n Cloud** — Executions list of the imported workflow.
2. **Gmail** — controlled inbox `demo+exec-good@your-domain.example`.
3. **webhook.site** — the audit log URL from `.env`.
4. **Slides** — the relevant `agentic-0X_slides.pdf` for the current block, full-screen.

Backstage (your laptop only): editor open at `data/canned_responses/`, terminal in the project folder, this cheat sheet.

---

## Block 1 (60 min) — From tools to agents

Project: `output/seminars/agentic/agentic-01-tools-to-agents_slides.pdf`

Speaker notes: `output/seminars/agentic/agentic_instructor_prep.pdf`

No live system. Pure narrative + Wooclap if used.

---

## Block 2 (60 min) — Live demos

### Demo run 1 — Happy path (~4 min)

```powershell
npm run prepare:demo -- --company executive-education --case good_fit
curl.exe -X POST $env:N8N_WEBHOOK_URL `
  -H "Content-Type: application/json" `
  --data "@runtime/demo_input.json"
```

- n8n Executions → walk left-to-right through 6 nodes.
- Gmail tab → email arrives in French.
- webhook.site → row says `policy_status: "approved"`, `final_action: "email_sent"`.

### Demo run 2 — Risky case (~5 min)

```powershell
npm run prepare:demo -- --company growth-agency --case risky
curl.exe -X POST $env:N8N_WEBHOOK_URL `
  -H "Content-Type: application/json" `
  --data "@runtime/demo_input.json"
```

- n8n Executions → stop at `policy_code`, read `reasons[]` aloud in French.
- IF node → FALSE branch. Gmail node did NOT execute.
- Refresh Gmail → no message arrived.
- webhook.site → `policy_status: "blocked"`, `final_action: "human_review_required"`.

### Demo 3 — Read the gate (~3 min)

Open `scripts/policy_gate.ts` in the editor on the projector. Read the rules aloud. Punchline: « le code, pas le prompt ».

### Fallback decision tree

| Symptom | Action | Reference |
|---|---|---|
| OpenAI node red | Disable it, paste `data/canned_responses/<stage>.json` into next Set node, execute from there. | runbook §A |
| Gmail OAuth lapsed | Don't send. Open `parse_draft` node, read French body aloud. Audit row still appears. | runbook §B |
| n8n Cloud unreachable | Run `npm run test:policy` live in terminal. Walk through `workflow/workflow_spec.md`. Show any pre-recorded fallback video. | runbook §C |

Full procedure: `docs/live-demo-runbook.md`.

---

## Block 3 (60 min) — Governance

Project: `output/seminars/agentic/agentic-03-governance_slides.pdf`

Speaker reference: `docs/governance-model.md` for definitions, `governance/` YAMLs for the source of truth.

---

## Things to NOT say on stage

- "It's safe because the AI knows not to do that." (False. The Code node knows.)
- "We trust the model." (We don't. We trust the gate.)
- Any revenue / ROI number that isn't in the offer catalog of the active company pack.

---

## After the session

- Send participants the dashboard URL so they can browse blocks, demos, and governance artifacts.
- Save the n8n executions; the audit log on webhook.site is ephemeral.
