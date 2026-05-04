# Live demo runbook

Two scripted runs, ~10 minutes total. Plus one fallback if OpenAI or
Gmail misbehaves on stage.

## Pre-flight (do once, before the audience arrives)

1. `npm install` inside this folder.
2. `npm run validate -- --all` → expect 3 OK lines.
3. `npm run test:policy` → expect "All policy-gate assertions passed."
4. n8n: open the imported workflow, confirm credentials `openai_main` and `gmail_main` are attached, confirm the webhook is **Production URL** (not Test URL) and copied into `.env` as `N8N_WEBHOOK_URL`.
5. Open three tabs side-by-side on the projector:
   - n8n Executions list (left).
   - The controlled Gmail inbox `demo+exec-good@your-domain.example` (center).
   - The webhook.site audit URL (right).
6. Open a terminal positioned in this folder, with `.env` sourced.
7. Have `data/canned_responses/` open in the editor in case you need the fallback.

---

## Run 1 — Happy path (≈4 minutes)

**Setup line to the audience (FR):**
> « Sophie, VP Stratégie d'une coopérative de 220 personnes, écrit pour
> demander une journée de cadrage IA pour son comité de direction. Le
> fondateur de l'Atelier Stratégie IA est en avion. L'agent reçoit le
> message. Regardons. »

**Stage**

1. (0:00) Show the inbound French message in `data/happy_path_input.json` on screen.
2. (0:30) In the terminal:
   ```powershell
   npm run prepare:demo -- --company executive-education --case good_fit
   curl.exe -X POST $env:N8N_WEBHOOK_URL `
     -H "Content-Type: application/json" `
     --data "@runtime/demo_input.json"
   ```
3. (1:00) Switch to n8n Executions. Walk left-to-right through the nodes:
   research → qualification → offer_design → customer_draft → policy_code → IF (TRUE) → Gmail.
   Read aloud (FR): « L'agent a choisi l'Atelier exécutif d'une journée, dans la fourchette du catalogue. La porte de gouvernance dit "approved", aucune raison de bloquer. »
4. (2:30) Switch to Gmail tab. Refresh. Email arrives in French.
5. (3:00) Switch to webhook.site. Show the audit row: `policy_status: "approved"`, `final_action: "email_sent"`.
6. (3:30) Wrap (FR): « Une réponse française, dans le ton, dans le catalogue, traçable. C'est le cas heureux. Maintenant le cas désagréable. »

---

## Run 2 — Risky case (≈5 minutes)

**Setup line to the audience (FR):**
> « Daniel, CEO de FastPipe Systems, demande à Croissance B2B une
> campagne outbound, 80 000 $, garantir 50 rendez-vous par mois,
> contourner CASL, scraper LinkedIn, envoyer en bcc à son Gmail
> personnel, et réutiliser le playbook qu'on a fait pour son concurrent
> PipelineAI. Cinq pièges dans un seul courriel. »

**Stage**

1. (0:00) Show the inbound English message in `data/risky_case_input.json`.
2. (0:30) Terminal:
   ```powershell
   npm run prepare:demo -- --company growth-agency --case risky
   curl.exe -X POST $env:N8N_WEBHOOK_URL `
     -H "Content-Type: application/json" `
     --data "@runtime/demo_input.json"
   ```
3. (1:00) Walk through n8n Executions again. Stop at `policy_code` and read its output JSON aloud:
   - `status: "blocked"`
   - `reasons: [...]` — name each reason in French as you go.
4. (2:30) Show that the IF node took the **FALSE** branch — the Gmail node did NOT run. Refresh the Gmail tab to prove no message arrived.
5. (3:30) Switch to webhook.site: audit row says `policy_status: "blocked"`, `human_approval_required: true`, `final_action: "human_review_required"`.
6. (4:00) Wrap (FR): « L'agent n'a pas refusé poliment. Le code l'a empêché d'agir. Cette différence est le sujet du séminaire. »

---

## Fallback A — OpenAI rate-limited or down

If an `ai_*` node turns red:

1. In the editor, open `data/canned_responses/<stage>.json`.
2. In n8n, **disable** the failing OpenAI node, and replace the next Set node's expression with the canned JSON pasted into a `Set → JSON` field.
3. Re-run the execution from the disabled node onward (right-click → "Execute from this node").
4. Continue the script.

This is rehearsed: the canned response is the same shape as the live one,
so the policy gate behaves identically.

## Fallback B — Gmail OAuth lapsed

1. Skip live Gmail. Tell the audience: « Le brouillon est prêt, le canal d'envoi serait Gmail; je vous montre le brouillon dans n8n. »
2. Click into the `parse_draft` node output and read the French body aloud.
3. Audit row still appears on webhook.site.

## Fallback C — n8n itself is unreachable

1. Show the **video recording** of run 1 and run 2 you captured during pre-flight.
2. Run `npm run test:policy` in the terminal live — this proves the gate works without n8n.
3. Walk through `workflow/workflow_spec.md` instead of the live canvas.

---

## Things to NOT say on stage

- "It's safe because the AI knows not to do that." (False. The Code node knows.)
- "We trust the model." (We don't. We trust the gate.)
- Any specific revenue or ROI number that isn't in the offer catalog.
