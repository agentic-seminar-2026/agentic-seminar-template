/**
 * Offline proof that the deterministic policy gate blocks risky cases
 * for all 3 company packs and approves the happy path.
 *
 * Usage:
 *   npx tsx scripts/test_policy_gate.ts
 *
 * Exits 0 on full pass, 1 on any assertion failure.
 */

import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePolicy } from './policy_gate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

function loadPack(pack: string) {
  const dir = join(ROOT, 'companies', pack);
  return {
    pricing_rules: JSON.parse(readFileSync(join(dir, 'pricing_rules.json'), 'utf8')),
    approval_policy: JSON.parse(readFileSync(join(dir, 'approval_policy.json'), 'utf8')),
    seeds: JSON.parse(readFileSync(join(dir, 'seed_inputs.json'), 'utf8')),
  };
}

interface Case {
  name: string;
  pack: string;
  case_kind: 'good_fit' | 'borderline' | 'risky';
  expectedStatus: 'approved' | 'blocked' | 'needs_human_review';
  // Synthetic outputs simulating what the LLM nodes would have produced.
  syntheticOffer: any;
  syntheticDraft: any;
  syntheticQual: any;
}

const CASES: Case[] = [
  // Happy path: pick a cheap in-catalog offer + clean French draft.
  {
    name: 'executive-education / good_fit -> approved',
    pack: 'executive-education',
    case_kind: 'good_fit',
    expectedStatus: 'approved',
    syntheticOffer: { recommended_offer: 'atelier-exec-1j', approval_required: false },
    syntheticDraft: {
      subject: 'Atelier exécutif d\'une journée',
      body: 'Bonjour Sophie, voici une proposition pour une journée de cadrage.',
    },
    syntheticQual: { risk_flags: [] },
  },
  // Risky cases: each must be BLOCKED, not merely flagged for review.
  {
    name: 'executive-education / risky -> blocked',
    pack: 'executive-education',
    case_kind: 'risky',
    expectedStatus: 'blocked',
    // Doesn't matter — risk comes from the inbound message + draft content.
    syntheticOffer: { recommended_offer: 'programme-cohorte-6s', approval_required: true },
    syntheticDraft: {
      subject: 'Proposition',
      body: 'Bonjour, nous garantissons un ROI de 5x. Référence: client Banque Nationale.',
    },
    syntheticQual: { risk_flags: ['guarantee_requested'] },
  },
  {
    name: 'market-intelligence / risky -> blocked',
    pack: 'market-intelligence',
    case_kind: 'risky',
    expectedStatus: 'blocked',
    syntheticOffer: { recommended_offer: 'veille-personnalisee', approval_required: true },
    syntheticDraft: {
      subject: 'Veille concurrentielle',
      body: 'Bonjour, nous incluons un dossier nominatif sur Sarah Kim. Copie à patricia.perso@gmail.com.',
    },
    syntheticQual: { risk_flags: ['internal_data_request'] },
  },
  {
    name: 'growth-agency / risky -> blocked',
    pack: 'growth-agency',
    case_kind: 'risky',
    expectedStatus: 'blocked',
    syntheticOffer: { recommended_offer: 'engagement-personnalise', approval_required: true },
    syntheticDraft: {
      subject: 'Outbound 90 jours',
      body: 'Bonjour Daniel, nous garantissons 50 rendez-vous par mois. Copie à daniel.perso@gmail.com.',
    },
    syntheticQual: { risk_flags: ['guarantee_requested', 'scraping_requested'] },
  },
];

function main() {
  let failed = 0;

  for (const c of CASES) {
    const { pricing_rules, approval_policy, seeds } = loadPack(c.pack);
    const lead = (seeds.leads || []).find((l: any) => l.case_kind === c.case_kind);
    if (!lead) {
      console.error(`FAIL  ${c.name}  (no lead found)`);
      failed += 1;
      continue;
    }

    const result = evaluatePolicy({
      approval_policy,
      pricing_rules,
      offer_design_output: c.syntheticOffer,
      customer_draft_output: c.syntheticDraft,
      qualification_output: c.syntheticQual,
      lead,
    });

    const ok = result.status === c.expectedStatus;
    if (ok) {
      console.log(`OK    ${c.name}  status=${result.status}  reasons=[${result.reasons.join(', ')}]`);
    } else {
      failed += 1;
      console.error(
        `FAIL  ${c.name}  expected=${c.expectedStatus}  got=${result.status}  reasons=[${result.reasons.join(', ')}]`,
      );
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll policy-gate assertions passed.');
}

main();
