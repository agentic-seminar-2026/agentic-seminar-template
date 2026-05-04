# n8n Cloud setup

A 10-minute click-by-click guide. Aimed at first-time n8n users.

## 1. Create the n8n Cloud workspace

1. Sign up at <https://app.n8n.cloud/>.
2. Pick the smallest tier (Starter is fine for a 3-hour seminar).
3. Note your workspace URL — it looks like
   `https://<workspace>.app.n8n.cloud`.

## 2. Create credentials

In n8n: **Credentials → New**.

### `openai_main`

- Type: **OpenAI**
- API key: paste the value of `OPENAI_API_KEY` from your `.env`
- Save as **`openai_main`** — the workflow JSON references this exact name.

### `gmail_main`

- Type: **Gmail OAuth2 API**
- Click **Sign in with Google**, complete OAuth, grant *Send mail* scope.
- Save as **`gmail_main`**.

> If you do not want to use Gmail, you can swap the **Gmail Send** node for
> **SMTP** with no other workflow change. Use credential name `smtp_main`
> and update the node type in the JSON before importing.

## 3. Import the workflow

1. n8n: **Workflows → Import from File**.
2. Pick `workflow/founder_to_agentic_enterprise.json`.
3. Open each AI node and confirm the credential dropdown shows `openai_main`
   (n8n usually auto-resolves by name; reselect if not).
4. Open the **Gmail Send** node and confirm `gmail_main` is selected.
5. Open the **Webhook** node, copy its **Production URL**, and paste it into
   your `.env` as `N8N_WEBHOOK_URL`.

## 4. Activate the workflow

Toggle **Active** in the top-right. The webhook becomes live immediately.

Verify with:

```bash
curl -X POST "$N8N_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"company_mode":"executive-education","lead":{"id":"smoke","name":"Test","company":"Test","inbound_message":"hello","source":"manual","timestamp":"2026-04-30T12:00:00Z","recipient_email":"YOUR-OWN-EMAIL"}}'
```

Replace `YOUR-OWN-EMAIL` with your own inbox. Within ~30s you should receive
a French email and see a new row in the Executions tab.

## 5. (Optional) Persist the audit log to a real file

n8n Cloud's filesystem is ephemeral. The default audit step writes to
`/tmp/audit_log.jsonl` *inside* the n8n container, which you can download
from the Execution view. For a more durable demo:

- Replace the **Append Audit Log** node with an **HTTP Request** node POSTing
  to a webhook.site URL — the audience watches rows arrive in real time.
- Or replace with a **Google Sheets Append Row** node.

Both swaps are documented inline in `workflow/workflow_spec.md`.

## 6. Pre-flight checklist before going live

```bash
# Local
npm install
npx tsx scripts/validate_company_pack.ts executive-education
npx tsx scripts/validate_company_pack.ts market-intelligence
npx tsx scripts/validate_company_pack.ts growth-agency
npx tsx scripts/test_policy_gate.ts

# n8n Cloud
# - Workflow toggle: Active
# - One smoke run with the curl above succeeds
# - One smoke run with the risky payload returns blocked and sends NO email
```

If any step fails, follow the fallback in [live-demo-runbook.md](live-demo-runbook.md).
