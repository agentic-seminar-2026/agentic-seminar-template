/**
 * Stage one company pack as the active demo input.
 *
 * Usage:
 *   npx tsx scripts/prepare_demo_case.ts --company <pack-name> --case <good_fit|borderline|risky>
 *
 * Effect:
 *   - Copies the pack files into runtime/active_company/
 *   - Writes runtime/demo_input.json with shape {company_mode, lead}
 *   - That JSON is what you POST to the n8n webhook.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

type CaseKind = 'good_fit' | 'borderline' | 'risky';

function parseArgs(): { company: string; caseKind: CaseKind } {
  const argv = process.argv.slice(2);
  let company = '';
  let caseKind: CaseKind = 'good_fit';
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--company') company = argv[++i] ?? '';
    else if (a === '--case') caseKind = (argv[++i] as CaseKind) ?? 'good_fit';
  }
  if (!company) {
    console.error('Usage: prepare_demo_case.ts --company <pack> --case <good_fit|borderline|risky>');
    process.exit(2);
  }
  if (!['good_fit', 'borderline', 'risky'].includes(caseKind)) {
    console.error(`Invalid --case: ${caseKind}`);
    process.exit(2);
  }
  return { company, caseKind };
}

function main() {
  const { company, caseKind } = parseArgs();

  const packDir = join(ROOT, 'companies', company);
  if (!existsSync(packDir)) {
    console.error(`Pack not found: ${packDir}`);
    process.exit(1);
  }

  const seedsPath = join(packDir, 'seed_inputs.json');
  const seeds = JSON.parse(readFileSync(seedsPath, 'utf8'));
  const lead = (seeds.leads || []).find((l: any) => l.case_kind === caseKind);
  if (!lead) {
    console.error(`No lead with case_kind=${caseKind} in ${seedsPath}`);
    process.exit(1);
  }

  const runtimeDir = join(ROOT, 'runtime');
  const activeDir = join(runtimeDir, 'active_company');
  mkdirSync(activeDir, { recursive: true });

  for (const f of ['company_brief.md', 'pricing_rules.json', 'approval_policy.json', 'seed_inputs.json']) {
    copyFileSync(join(packDir, f), join(activeDir, f));
  }

  const demoInput = {
    company_mode: company,
    lead,
  };
  const outPath = join(runtimeDir, 'demo_input.json');
  writeFileSync(outPath, JSON.stringify(demoInput, null, 2), 'utf8');

  console.log(`Staged pack: ${company}`);
  console.log(`Case: ${caseKind} (${lead.id})`);
  console.log(`Wrote: ${outPath}`);
  console.log(`Recipient: ${lead.recipient_email}`);
  console.log('');
  console.log('Next: POST runtime/demo_input.json to $N8N_WEBHOOK_URL');
}

main();
