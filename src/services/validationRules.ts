import type { AIFlaggedRecord } from '../types';

export interface ValidationRuleDef {
  id: string;
  name: string;
  shortDesc: string;
  category: 'Structure' | 'Core Metadata' | 'Rights & Source' | 'Acknowledgements' | 'Pagination' | 'Financial & Costs' | 'Editorial Notes' | 'Consistency';
  severity: 'error' | 'warning';
  defaultEnabled: boolean;
}

export const VALIDATION_RULES: ValidationRuleDef[] = [
  {
    id: 'brag_status',
    name: 'Brag Status Empty',
    shortDesc: 'Col A (Brag Status) must always be blank across all rows.',
    category: 'Structure',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'usage_classification',
    name: 'Usage Classification',
    shortDesc: 'Required; must be New, New/License, New/No License, Pickup/License, or Pickup/No License.',
    category: 'Core Metadata',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'description_required',
    name: 'Description Required',
    shortDesc: 'Description column cannot be empty.',
    category: 'Core Metadata',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'image_no_required',
    name: 'Library Image No Required',
    shortDesc: 'Library Image ID / asset code cannot be empty.',
    category: 'Core Metadata',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'source_formatting',
    name: 'Source Agency Formatting',
    shortDesc: 'Standardizes agency names (Shutterstock, Getty Images, Alamy Stock Photo, OUP).',
    category: 'Rights & Source',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'rights_type',
    name: 'Rights Type Validity',
    shortDesc: 'Rights Type must be RF, RM, RFe, or n/a.',
    category: 'Rights & Source',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'ack_slash_format',
    name: 'Acknowledgement Slash Format',
    shortDesc: 'Acknowledgement must contain a "/" separating photographer credit from agency source.',
    category: 'Acknowledgements',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'ack_source_match',
    name: 'Acknowledgement Source Suffix Match',
    shortDesc: 'Agency suffix after "/" in Acknowledgement must match the Source column exactly.',
    category: 'Acknowledgements',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'ack_no_creator_warning',
    name: 'No Creator / Source-Only Credit',
    shortDesc: 'Warns when acknowledgement is identical to source without photographer/creator name.',
    category: 'Acknowledgements',
    severity: 'warning',
    defaultEnabled: true,
  },
  {
    id: 'page_number_format',
    name: 'Page Number Format Style',
    shortDesc: 'Page number is required and must match established log format (e.g. p000 vs numeric digits).',
    category: 'Pagination',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'page_sequence_order',
    name: 'Page Number Sequence Order',
    shortDesc: 'Warns when sequential page numbers in the log appear out of numerical order.',
    category: 'Pagination',
    severity: 'warning',
    defaultEnabled: true,
  },
  {
    id: 'photolog_fee',
    name: 'Photolog Creation Fee (£0.50)',
    shortDesc: 'Photolog Creation (£) column must be exactly 0.50.',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'status_recleared_fee',
    name: 'Status Recleared Fee (£4.00 / £0)',
    shortDesc: 'Status recleared fee must be blank or 4 (or 0 for zero-fee notes).',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'selections_made_fee',
    name: 'Selections Made Fee (£4.00 / £8.00)',
    shortDesc: 'Selections made fee must be blank, 4, or 8 (or 0 for zero-fee notes).',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'license_fee_vendor_rates',
    name: 'Contract License Fee Rates',
    shortDesc: 'License fee required for licensed usages; validates contract rates (Shutterstock, Getty, Alamy).',
    category: 'Financial & Costs',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'zero_fee_notes',
    name: 'Reproduction Form Zero-Fee Notes',
    shortDesc: 'Validates notes (Royalty Free, OUP Owned, Commissioned) enforce Pickup/No License, Fee = 0, Source = OUP.',
    category: 'Editorial Notes',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'two_part_notes_research',
    name: 'Two-Part Notes & Photo Research',
    shortDesc: 'Validates two-part notes (TinEye found, Reverse Research found, Photo Research recommended).',
    category: 'Editorial Notes',
    severity: 'error',
    defaultEnabled: true,
  },
  {
    id: 'frequency_and_pairs',
    name: 'Duplicate & Pair Frequency',
    shortDesc: 'Flags image IDs used too many times or ambiguous/inconsistent source pairs.',
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

  if (clean.includes('Brag Status')) return 'brag_status';
  if (clean.includes('Usage Classification')) return 'usage_classification';
  if (clean.includes('Description is required')) return 'description_required';
  if (clean.includes('Library Image No is required')) return 'image_no_required';
  if (clean.includes('Source is required') || clean.includes('Source must be formatted exactly')) return 'source_formatting';
  if (clean.includes('Rights Type')) return 'rights_type';
  if (clean.includes('No known photographer/creator specified')) return 'ack_no_creator_warning';
  if (clean.includes('Acknowledgement source mismatch')) return 'ack_source_match';
  if (clean.includes('should contain a slash') || clean.includes('Acknowledgement is required')) return 'ack_slash_format';
  if (clean.includes('is out of order')) return 'page_sequence_order';
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
