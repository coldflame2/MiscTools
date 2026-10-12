import type { AIFlaggedRecord } from '../types';

export interface ValidationRuleDef {
  id: string;
  name: string;
  shortDesc: string;
  fullDescription?: string;
  category: 'Structure' | 'Core Metadata' | 'Rights & Source' | 'Acknowledgements' | 'Pagination' | 'Financial & Costs' | 'Editorial Notes' | 'Consistency';
  severity: 'error' | 'warning';
  defaultEnabled: boolean;
}

export const VALIDATION_RULES: ValidationRuleDef[] = [
  {
    id: 'brag_status',
    name: 'Brag Status Empty',
    shortDesc: 'Col A (Brag Status) must always be blank across all rows.',
    fullDescription: 'Column A (Brag Status) is strictly reserved for system or publishing tracking and must remain blank on every row across the photolog. Any value entered here is flagged as an error.',
    category: 'Structure',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'usage_classification',
    name: 'Usage Classification',
    shortDesc: 'Required; must be New, New/License, New/No License, Pickup/License, or Pickup/No License.',
    fullDescription: 'Every image entry must have a valid Usage Classification matching standard values: "New", "New/License", "New/No License", "Pickup/License", or "Pickup/No License". Unrecognized values or blank cells are flagged.',
    category: 'Core Metadata',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'description_required',
    name: 'Description Required',
    shortDesc: 'Description column cannot be empty.',
    fullDescription: 'Editorial description of the image content is mandatory for every row to maintain catalog integrity and accessibility auditing.',
    category: 'Core Metadata',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'image_no_required',
    name: 'Library Image No Required',
    shortDesc: 'Library Image ID / asset code cannot be empty (can be N/A or NA for New images).',
    fullDescription: 'Library Image No is required for tracking. However, for images marked as "New" that are not sourced from a parent title, the value may legitimately be "N/A" or "NA".',
    category: 'Core Metadata',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'source_formatting',
    name: 'Source Agency Formatting',
    shortDesc: 'Standardizes agency names (Shutterstock, Getty Images, Alamy Stock Photo, OUP). N/A allowed for New.',
    fullDescription: 'Ensures agency names are formatted consistently: "Shutterstock", "Getty Images", "Alamy Stock Photo", or "OUP". For images marked as "New" that are not sourced from parent titles, "N/A" or "NA" is permitted.',
    category: 'Rights & Source',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'rights_type',
    name: 'Rights Type Validity',
    shortDesc: 'Rights Type must be RF, RM, RFe, or n/a (N/A allowed for New).',
    fullDescription: 'Rights Type specifies licensing model: RF (Royalty Free), RM (Rights Managed), RFe (Royalty Free Extended), or n/a. For images marked as "New" not sourced from parent titles, "N/A" or "NA" is permitted.',
    category: 'Rights & Source',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'ack_slash_format',
    name: 'Acknowledgement Slash Format',
    shortDesc: 'Acknowledgement must contain a "/" separating photographer credit from agency source (N/A allowed for New).',
    fullDescription: 'Acknowledgements are printed in the book credits and must strictly follow the "Photographer / Agency" format containing a forward slash ("/"). For images marked as "New" not sourced from parent titles, "N/A" or "NA" is permitted without requiring a slash.',
    category: 'Acknowledgements',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'ack_source_match',
    name: 'Acknowledgement Source Suffix Match',
    shortDesc: 'Agency suffix after "/" in Acknowledgement must match the Source column exactly.',
    fullDescription: 'The agency name appearing after the forward slash in Acknowledgement (e.g., "John Doe / Shutterstock") must match the Source column ("Shutterstock") identically.',
    category: 'Acknowledgements',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'ack_no_creator_warning',
    name: 'No Creator / Source-Only Credit',
    shortDesc: 'Warns when acknowledgement is identical to source without photographer/creator name (non-OUP).',
    fullDescription: 'Flagged when the Acknowledgement column is identical to the Source agency name without an individual photographer or creator name (e.g. "Shutterstock" or "Getty Images" alone without a slash or photographer). This rule applies to external commercial photo agencies. You can disable this rule independently if source-only agency credits are permitted.',
    category: 'Acknowledgements',
    severity: 'warning',
    defaultEnabled: true,
  },
  {
    id: 'ack_no_creator_oup_warning',
    name: 'No Creator / Source-Only Credit (OUP)',
    shortDesc: 'Warns when acknowledgement is OUP without creator name. Can be toggled separately from agency rule.',
    fullDescription: 'Flagged when the Source is "OUP" and the Acknowledgement is simply "OUP" without a specific creator, archivist, or illustrator credit. Many projects allow internal OUP assets without individual creator credits; toggle this rule off if your project permits OUP source-only credits without turning off warnings for commercial photo agencies.',
    category: 'Acknowledgements',
    severity: 'warning',
    defaultEnabled: true,
  },
  {
    id: 'page_number_format',
    name: 'Page Number Format Style',
    shortDesc: 'Page number is required and validates format (CVR, Front/Back Cover variants, p000 vs numeric digits).',
    fullDescription: 'Validates that Page Number is present and follows accepted publishing styles. Covers front cover variants (CVR, Cover, Front Cover, Frnt CVR, F CVR, F-CVR, etc.) and back cover variants (Back Cover, Bck CVR, Back CVR, etc.), as well as uniform "p000" vs numeric numbering.',
    category: 'Pagination',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'page_sequence_order',
    name: 'Page Number Sequence Order',
    shortDesc: 'Validates cover indices increment in order (e.g. CVR(1), CVR(2)) and pages do not appear out of order.',
    fullDescription: 'Checks logical sequence flow. When multiple cover images use indices like CVR(1), CVR(2), CVR(3), this rule ensures indices are positive and sequential without gaps. Also alerts if normal page numbers appear in reverse order.',
    category: 'Pagination',
    severity: 'warning',
    defaultEnabled: true,
  },
  {
    id: 'photolog_fee',
    name: 'Photolog Creation Fee (£0.50)',
    shortDesc: 'Photolog Creation (£) column must be exactly 0.50.',
    fullDescription: 'The Photolog Creation fee is standard contract administrative remuneration set at fixed £0.50 per validated record.',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'status_recleared_fee',
    name: 'Status Recleared Fee (£4.00 / £0)',
    shortDesc: 'Status recleared fee must be blank or 4 (or 0 for zero-fee notes).',
    fullDescription: 'Status recleared fee pays £4.00 for reclearing existing assets, or £0/blank for zero-fee editorial notes and parent pickups.',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'selections_made_fee',
    name: 'Selections Made Fee (£4.00 / £8.00)',
    shortDesc: 'Selections made fee must be blank, 4, or 8 (or 0 for zero-fee notes).',
    fullDescription: 'Selections made fee compensates photo researchers (£4.00 for single tier or £8.00 for extensive selections), or £0/blank for zero-fee reproduction form notes and parent pickups.',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'license_fee_vendor_rates',
    name: 'Contract License Fee Rates',
    shortDesc: 'License fee required for licensed usages; validates contract rates (Shutterstock, Getty, Alamy).',
    fullDescription: 'Validates contractually agreed vendor license pricing for commercial agencies (e.g. Shutterstock RF £10 / RM £40, Getty RF £17.50 / RM £40, Alamy £45 / £29). For "No License" usage or parent pickups, license fee must be £0 or blank.',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'zero_fee_notes',
    name: 'Reproduction Form Zero-Fee Notes',
    shortDesc: 'Validates notes (Royalty Free, OUP Owned, Commissioned) enforce Pickup/No License, Fee = 0, Source = OUP.',
    fullDescription: 'Enforces publishing contract relationships when notes state assets were marked Royalty Free, OUP Owned, or Commissioned in the reproduction form. These must be classified as Pickup/No License with £0 license cost and Source set to OUP.',
    category: 'Editorial Notes',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'pickup_title_notes',
    name: 'Pickup from Title Notes',
    shortDesc: 'Validates notes starting with Pick-up/Pickup from {title}: enforces No License (blank fee), and classifies as New/No License if replaced in parent or Pickup/No License if no action.',
    fullDescription: 'Audits images inherited from other book titles ("Pick-up from {title}"). In all cases, no license fee applies. If the image was replaced in the parent title, it requires replacement here as "New/No License"; otherwise if no action or already licensed in parent, it is "Pickup/No License".',
    category: 'Editorial Notes',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'two_part_notes_research',
    name: 'Two-Part Notes & Photo Research',
    shortDesc: 'Validates two-part notes (TinEye found, Reverse Research found, Photo Research recommended).',
    fullDescription: 'Validates reverse image search notes (TinEye, Google Lens, Reverse Research). Verifies outcome actions, fee columns, and metadata alignments when additional photo research is required.',
    category: 'Editorial Notes',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'frequency_and_pairs',
    name: 'Duplicate & Pair Frequency',
    shortDesc: 'Flags image IDs used too many times or ambiguous/inconsistent source pairs.',
    fullDescription: 'Scans for anomalous asset usage patterns across the entire photolog, including identical image IDs with divergent agencies or excessive duplicate reuse across disparate book spreads.',
    category: 'Consistency',
    severity: 'warning',
    defaultEnabled: true,
  },
];

export const ALL_RULE_IDS = VALIDATION_RULES.map(r => r.id);
export const DEFAULT_ENABLED_RULE_IDS = new Set(VALIDATION_RULES.filter(r => r.defaultEnabled).map(r => r.id));

export const getRuleById = (ruleId: string): ValidationRuleDef | undefined => {
  return VALIDATION_RULES.find(r => r.id === ruleId);
};

export const getRuleIdForReason = (reason: string): string => {
  const clean = reason.replace('[WARNING] ', '').replace('[WARNING]', '').trim();

  if (clean.includes('Pick-up from') || clean.includes('Pickup from') || clean.includes('parent title') || clean.includes('replaced in parent')) return 'pickup_title_notes';
  if (clean.includes('Brag Status')) return 'brag_status';
  if (clean.includes('Usage Classification')) return 'usage_classification';
  if (clean.includes('Description is required')) return 'description_required';
  if (clean.includes('Library Image No is required')) return 'image_no_required';
  if (clean.includes('Source is required') || clean.includes('Source must be formatted exactly')) return 'source_formatting';
  if (clean.includes('Rights Type')) return 'rights_type';
  if (clean.includes('No known photographer/creator specified')) {
    if (clean.includes('("OUP")') || clean.includes('Source is OUP') || clean.includes('matches Source ("OUP")')) {
      return 'ack_no_creator_oup_warning';
    }
    return 'ack_no_creator_warning';
  }
  if (clean.includes('Acknowledgement source mismatch')) return 'ack_source_match';
  if (clean.includes('should contain a slash') || clean.includes('Acknowledgement is required')) return 'ack_slash_format';
  if (clean.includes('is out of order') || clean.includes('sequence gap') || clean.includes('indices must increment in order')) return 'page_sequence_order';
  if (clean.includes('Page Number') || clean.includes('does not match the established') || clean.includes('is inconsistent with the numerical')) return 'page_number_format';
  if (clean.includes('Photolog Creation (£)')) return 'photolog_fee';
  if (clean.includes('Status recleared (£)')) return 'status_recleared_fee';
  if (clean.includes('Selections made (£)')) return 'selections_made_fee';
  if (clean.includes('License fee')) return 'license_fee_vendor_rates';
  if (clean.includes('Photo Research') || clean.includes('TinEye') || clean.includes('Reverse Research')) return 'two_part_notes_research';
  if (clean.includes('Note indicates') || clean.includes('Note discrepancy')) return 'zero_fee_notes';
  if (clean.includes('Image Used Too Many Times') || clean.includes('Ambiguous Pair') || clean.includes('Inconsistent Pair')) return 'frequency_and_pairs';

  return 'other_rules';
};

export const getRulesForReasons = (reasons: string[]): ValidationRuleDef[] => {
  const seenRuleIds = new Set<string>();
  const rules: ValidationRuleDef[] = [];
  
  reasons.forEach(r => {
    const ruleId = getRuleIdForReason(r);
    if (ruleId && ruleId !== 'other_rules' && !seenRuleIds.has(ruleId)) {
      seenRuleIds.add(ruleId);
      const rule = getRuleById(ruleId);
      if (rule) {
        rules.push(rule);
      }
    }
  });

  return rules;
};

/**
 * Filter raw validation flags by currently enabled rule IDs.
 */
export const filterFlagsByEnabledRules = (
  rawFlags: AIFlaggedRecord[],
  enabledRuleIds: Set<string>
): AIFlaggedRecord[] => {
  const filtered: AIFlaggedRecord[] = [];

  rawFlags.forEach(flag => {
    const reasons = flag.reason ? flag.reason.split('|||') : [];
    const activeReasons = reasons.filter(r => {
      const ruleId = getRuleIdForReason(r);
      // If rule is recognized, must be in enabledRuleIds; if unknown, keep by default
      return ruleId === 'other_rules' || enabledRuleIds.has(ruleId);
    });

    if (activeReasons.length > 0) {
      filtered.push({
        ...flag,
        reason: activeReasons.join('|||'),
      });
    }
  });

  return filtered;
};

/**
 * Count how many total reason occurrences exist for each rule in the raw flags.
 */
export const calculateRuleViolationCounts = (
  rawFlags: AIFlaggedRecord[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  VALIDATION_RULES.forEach(r => {
    counts[r.id] = 0;
  });

  rawFlags.forEach(flag => {
    const reasons = flag.reason ? flag.reason.split('|||') : [];
    reasons.forEach(r => {
      const ruleId = getRuleIdForReason(r);
      if (counts[ruleId] !== undefined) {
        counts[ruleId]++;
      } else {
        counts[ruleId] = (counts[ruleId] || 0) + 1;
      }
    });
  });

  return counts;
};
