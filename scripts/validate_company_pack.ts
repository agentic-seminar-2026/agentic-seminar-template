/**
 * Validate one company pack:
 *   companies/<pack>/{company_brief.md, pricing_rules.json, approval_policy.json, seed_inputs.json}
 *
 * Usage:
 *   npx tsx scripts/validate_company_pack.ts <pack-name>
 *   npx tsx scripts/validate_company_pack.ts --all
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const COMPANIES_DIR = join(ROOT, 'companies');

const OfferSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  price_min: z.number().nonnegative(),
  price_max: z.number().nonnegative(),
  price_period: z.enum(['monthly', 'yearly', 'one_time']).optional(),
  requires_approval: z.boolean(),
});

const PricingSchema = z.object({
  currency: z.string().length(3),
  offer_catalog: z.array(OfferSchema).min(2),
  discount_rules: z.object({
    max_discount_pct_auto: z.number().min(0).max(100),
    max_discount_pct_with_approval: z.number().min(0).max(100),
    no_discount_offers: z.array(z.string()),
  }),
});

const PolicySchema = z.object({
  max_auto_approved_price: z.number().nonnegative(),
  currency: z.string().length(3),
  blocked_claim_types: z.array(z.string()).min(1),
  blocked_claim_patterns: z.array(z.string()).min(1),
  blocked_actions: z.array(z.string()).min(1),
  approval_required_for: z.array(z.string()).min(1),
  privacy_rules: z.record(z.string(), z.union([z.boolean(), z.string()])),
  escalation_reasons: z.array(z.string()).min(1),
});

const LeadSchema = z.object({
  id: z.string().min(1),
  case_kind: z.enum(['good_fit', 'borderline', 'risky']),
  name: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  company_size: z.number().int().positive(),
  country: z.string().length(2),
  source: z.string().min(1),
  timestamp: z.string().min(10),
  recipient_email: z.string().email(),
  inbound_message: z.string().min(20),
});

const SeedSchema = z.object({
  leads: z.array(LeadSchema).length(3),
});

function loadJson<T>(path: string, schema: z.ZodType<T>): T {
  if (!existsSync(path)) throw new Error(`Missing file: ${path}`);
  const raw = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${path}: ${(err as Error).message}`);
  }
  return schema.parse(parsed);
}

function validatePack(pack: string): { ok: true; pack: string } | { ok: false; pack: string; error: string } {
  const dir = join(COMPANIES_DIR, pack);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { ok: false, pack, error: `not a directory: ${dir}` };
  }

  try {
    const briefPath = join(dir, 'company_brief.md');
    if (!existsSync(briefPath)) throw new Error(`Missing ${briefPath}`);
    const brief = readFileSync(briefPath, 'utf8');
    if (brief.trim().length < 200) throw new Error('company_brief.md is too short');

    const pricing = loadJson(join(dir, 'pricing_rules.json'), PricingSchema);
    const policy = loadJson(join(dir, 'approval_policy.json'), PolicySchema);
    const seeds = loadJson(join(dir, 'seed_inputs.json'), SeedSchema);

    const kinds = new Set(seeds.leads.map((l) => l.case_kind));
    for (const k of ['good_fit', 'borderline', 'risky'] as const) {
      if (!kinds.has(k)) throw new Error(`seed_inputs.json must include a ${k} case`);
    }

    if (policy.currency !== pricing.currency) {
      throw new Error(`currency mismatch: pricing=${pricing.currency} policy=${policy.currency}`);
    }

    return { ok: true, pack };
  } catch (err) {
    return { ok: false, pack, error: (err as Error).message };
  }
}

function main() {
  const args = process.argv.slice(2);
  let packs: string[];
  if (args.length === 0 || args[0] === '--all') {
    packs = ['executive-education', 'market-intelligence', 'growth-agency'];
  } else {
    packs = args;
  }

  let failed = 0;
  for (const pack of packs) {
    const result = validatePack(pack);
    if (result.ok) {
      console.log(`OK    ${pack}`);
    } else {
      failed += 1;
      console.error(`FAIL  ${pack}  ${result.error}`);
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

main();
