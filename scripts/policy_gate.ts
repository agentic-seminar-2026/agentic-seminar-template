/**
 * Deterministic policy gate.
 *
 * This module is the SINGLE source of truth for the governance gate.
 * - The n8n Code node copies this function body verbatim.
 * - test_policy_gate.ts asserts its behavior on the seeded risky/happy cases
 *   before every live demo.
 *
 * No imports — must be paste-able into an n8n Code node.
 */

export type PolicyStatus = 'approved' | 'blocked' | 'needs_human_review';

export interface PolicyCheck {
  status: PolicyStatus;
  reasons: string[];
  required_approver: string;
  safe_next_action: string;
}

export interface GateInputs {
  approval_policy: any;
  pricing_rules: any;
  offer_design_output: any;
  customer_draft_output: any;
  qualification_output: any;
  lead: any;
}

const PERSONAL_EMAIL_DOMAINS = [
  '@gmail.com',
  '@yahoo.com',
  '@yahoo.fr',
  '@hotmail.com',
  '@hotmail.fr',
  '@outlook.com',
  '@outlook.fr',
  '@icloud.com',
  '@me.com',
  '@live.com',
  '@aol.com',
  '@proton.me',
  '@protonmail.com',
];

const BLOCKED_ACTION_TRIGGERS: Record<string, string[]> = {
  auto_send_outbound_email: ['send the emails directly', 'envoi automatique', 'envoyer automatiquement'],
  auto_send_to_unverified_recipient: ['no human review', 'sans validation'],
  scrape_private_profiles: ['scraping', 'scrape ', 'scraper', 'profils privés'],
  bypass_optout: ['no casl', 'sans casl', 'no gdpr', 'sans rgpd', 'bypass opt-out', 'contourner'],
  purchase_opaque_data_lists: ['acheter une base', 'buy a database'],
  share_other_client_data: ['data from your client', 'données de votre client', 'comme vous avez fait pour'],
  promise_delivery_under_14_days: ['en moins de 14 jours', 'dans 10 jours', 'dans 12 jours'],
  monitor_more_than_5_competitors: ['suivre 6 concurrents', 'suivre 7 concurrents', 'suivre 8 concurrents', 'suivre 9 concurrents', 'suivre 10 concurrents'],
  include_personal_data_about_named_individuals: ['dossier nominatif', 'données personnelles sur'],
};

function maxOfferPrice(offer_id: string, pricing_rules: any): number {
  const entry = (pricing_rules?.offer_catalog || []).find((o: any) => o.id === offer_id);
  return entry ? Number(entry.price_max ?? 0) : 0;
}

function bodyContains(body: string, needle: string): boolean {
  if (!body || !needle) return false;
  return body.toLowerCase().includes(String(needle).toLowerCase());
}

export function evaluatePolicy(input: GateInputs): PolicyCheck {
  const reasons: string[] = [];
  let blocked = false;

  const approval = input.approval_policy || {};
  const draftBody: string = input.customer_draft_output?.body || '';
  const draftSubject: string = input.customer_draft_output?.subject || '';
  const fullDraft = `${draftSubject}\n${draftBody}`;
  const inboundMsg: string = (input.lead?.inbound_message || '').toLowerCase();

  // 1. Blocked claim patterns inside the DRAFT (subject + body).
  const patterns: string[] = approval.blocked_claim_patterns || [];
  for (const p of patterns) {
    if (bodyContains(fullDraft, p)) {
      reasons.push('blocked_claim_pattern_detected');
      blocked = true;
      break;
    }
  }

  // 2. Personal email BCC / personal email in the draft.
  if (approval.privacy_rules?.no_personal_email_bcc) {
    for (const dom of PERSONAL_EMAIL_DOMAINS) {
      if (bodyContains(fullDraft, dom)) {
        reasons.push('personal_email_bcc');
        blocked = true;
        break;
      }
    }
  }

  // 3. Inbound message asks for a blocked action.
  const blockedActions: string[] = approval.blocked_actions || [];
  for (const action of blockedActions) {
    const triggers = BLOCKED_ACTION_TRIGGERS[action] || [];
    if (triggers.some((t) => inboundMsg.includes(t.toLowerCase()))) {
      reasons.push('requested_blocked_action');
      blocked = true;
      break;
    }
  }

  // 4. Inbound message references "your client X" or "for your client".
  if (
    approval.privacy_rules?.no_other_client_names_in_draft &&
    (inboundMsg.includes('your client') ||
      inboundMsg.includes('votre client') ||
      inboundMsg.includes('the playbook you built for') ||
      inboundMsg.includes('reuse the playbook'))
  ) {
    reasons.push('other_client_referenced');
    blocked = true;
  }

  // 5. Price above threshold.
  const offer_id = input.offer_design_output?.recommended_offer || '';
  const offerMax = maxOfferPrice(offer_id, input.pricing_rules);
  const threshold = Number(approval.max_auto_approved_price ?? Number.POSITIVE_INFINITY);
  if (offerMax > threshold) {
    reasons.push('price_above_threshold');
  }

  // 6. Offer is marked approval_required.
  if (input.offer_design_output?.approval_required === true) {
    reasons.push('offer_marked_approval_required');
  }

  // 7. Qualification surfaced risk_flags.
  const riskFlags: string[] = input.qualification_output?.risk_flags || [];
  if (Array.isArray(riskFlags) && riskFlags.length > 0) {
    reasons.push('qualification_risk_flag');
  }

  let status: PolicyStatus;
  if (blocked) {
    status = 'blocked';
  } else if (reasons.length > 0) {
    status = 'needs_human_review';
  } else {
    status = 'approved';
  }

  const required_approver = status === 'approved' ? '' : 'founder';
  const safe_next_action =
    status === 'approved'
      ? 'Send the email and append the audit row.'
      : status === 'blocked'
      ? 'Do NOT send. Founder reviews the draft and the policy reasons before any further action.'
      : 'Founder reviews the draft and confirms approval before any send.';

  // De-duplicate while preserving order.
  const dedupReasons = Array.from(new Set(reasons));

  return { status, reasons: dedupReasons, required_approver, safe_next_action };
}
