import type { HeaderIndices, AcknowledgementRecord } from '../types';
import { parsePickupTitleNote, standardizeAgency, cleanRightsType } from './dataValidator';

export interface ParentTitleLog {
  id: string;
  fileName: string;
  title: string | null;
  isbn: string | null;
  uploadedAt: string;
  rawData: (string | number)[][];
  headerRowIndex: number;
  columnIndices: HeaderIndices;
  records: AcknowledgementRecord[];
}

export interface ParentMatchComparison {
  field: string;
  label: string;
  childValue: string;
  parentValue: string;
  isMatch: boolean;
  status: 'match' | 'mismatch' | 'child_empty' | 'parent_empty';
}

export interface ParentCrossMatchResult {
  childRowIndex: number;
  childExcelRow: number;
  childPageNumber: string;
  childImageNo: string;
  childDescription: string;
  childUsage: string;
  childSource: string;
  childRights: string;
  childAck: string;
  childFee: string;
  childNotes: string;
  
  parentLogId?: string;
  parentLogFileName?: string;
  parentTitle?: string;
  parentRowIndex?: number;
  parentExcelRow?: number;
  parentRecord?: AcknowledgementRecord;
  parentPageNumber?: string;
  parentImageNo?: string;
  parentDescription?: string;
  parentUsage?: string;
  parentSource?: string;
  parentRights?: string;
  parentAck?: string;
  parentFee?: string;
  parentNotes?: string;

  matchConfidence: 'id_and_desc' | 'exact_id' | 'page_and_id' | 'page_and_desc' | 'page_only' | 'id_fuzzy' | 'unmatched';
  isVerified: boolean;
  discrepancies: string[];
  comparisons: ParentMatchComparison[];
}

export interface ParentCrossAuditSummary {
  totalChildRows: number;
  pickupRowsCount: number;
  matchedCount: number;
  unmatchedCount: number;
  discrepanciesCount: number;
  perfectMatchesCount: number;
  results: ParentCrossMatchResult[];
}

/**
 * Normalizes title string for lenient comparisons (e.g., ignoring editions, punctuation, casing)
 */
export const normalizeTitleString = (str: string): string => {
  return (str || '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

/**
 * Normalizes asset / image IDs for matching (ignoring prefixes like ID:, #, spaces)
 */
export const normalizeAssetId = (id: string): string => {
  if (!id) return '';
  return id
    .toLowerCase()
    .replace(/^(?:id|img|image|no|#|ref)[:.\s-]*/i, '')
    .replace(/[\s._-]+/g, '')
    .trim();
};

/**
 * Normalizes page representation (e.g. "p. 24", "p024", "page 24" -> "24")
 */
export const normalizePageCode = (page: string): string => {
  if (!page) return '';
  const clean = page.trim().toLowerCase();
  // Strip leading p, pg, page
  const stripped = clean.replace(/^(?:page|pg|p)[.\s-]*/i, '');
  // Extract number if digits
  const numMatch = stripped.match(/^0*(\d+)/);
  if (numMatch) {
    return numMatch[1];
  }
  return clean.replace(/[\s()]/g, '');
};

/**
 * Checks if an asset ID is generic/placeholder (e.g. N/A, NA, None, unknown, -, empty)
 * Multiple assets often share N/A (especially OUP owned assets), so these must NEVER be matched on ID alone.
 */
export const isGenericAssetId = (id: string): boolean => {
  if (!id) return true;
  const clean = id.trim().toLowerCase();
  return (
    clean === 'n/a' ||
    clean === 'na' ||
    clean === 'none' ||
    clean === 'null' ||
    clean === 'nil' ||
    clean === '-' ||
    clean === '--' ||
    clean === 'unknown' ||
    clean === 'tbc' ||
    clean === 'tbd'
  );
};

/**
 * Normalizes description text for comparison (strips punctuation, common stop words, collapses whitespace)
 */
export const normalizeDescriptionText = (desc: string): string => {
  if (!desc) return '';
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculates token overlap similarity between child and parent descriptions (0.0 to 1.0)
 */
export const calculateDescriptionSimilarity = (descA: string, descB: string): number => {
  const normA = normalizeDescriptionText(descA);
  const normB = normalizeDescriptionText(descB);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  // If one is substantial substring of the other
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    if (minLen >= 10 && minLen / maxLen > 0.4) {
      return 0.9;
    }
  }

  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0.0;

  let common = 0;
  wordsA.forEach(w => {
    if (wordsB.has(w)) common++;
  });

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? common / union : 0.0;
};

/**
 * Compares two field values with publishing-lenient rules
 */
export const evaluateFieldMatch = (
  field: string,
  label: string,
  childValRaw: string | undefined,
  parentValRaw: string | undefined
): ParentMatchComparison => {
  const childValue = (childValRaw ?? '').toString().trim();
  const parentValue = (parentValRaw ?? '').toString().trim();

  if (!childValue && !parentValue) {
    return { field, label, childValue: '', parentValue: '', isMatch: true, status: 'match' };
  }
  if (!childValue && parentValue) {
    return { field, label, childValue: '', parentValue, isMatch: false, status: 'child_empty' };
  }
  if (childValue && !parentValue) {
    return { field, label, childValue, parentValue: '', isMatch: false, status: 'parent_empty' };
  }

  let isMatch = false;

  if (field === 'source') {
    isMatch = standardizeAgency(childValue).toLowerCase() === standardizeAgency(parentValue).toLowerCase();
  } else if (field === 'rightsType') {
    isMatch = cleanRightsType(childValue).toUpperCase() === cleanRightsType(parentValue).toUpperCase();
  } else if (field === 'libraryImageNo') {
    isMatch = normalizeAssetId(childValue) === normalizeAssetId(parentValue);
  } else if (field === 'pageNumber') {
    isMatch = normalizePageCode(childValue) === normalizePageCode(parentValue);
  } else if (field === 'licenseFee') {
    // For pickups, child fee is expected to be 0 or blank, but parent might have had fee
    const childFeeNum = parseFloat(childValue.replace(/[^0-9.-]/g, '')) || 0;
    const parentFeeNum = parseFloat(parentValue.replace(/[^0-9.-]/g, '')) || 0;
    isMatch = childFeeNum === 0 || childFeeNum === parentFeeNum;
  } else {
    isMatch = childValue.toLowerCase() === parentValue.toLowerCase();
  }

  return {
    field,
    label,
    childValue,
    parentValue,
    isMatch,
    status: isMatch ? 'match' : 'mismatch'
  };
};

/**
 * Cross-audits child log rows against one or more uploaded parent title logs
 */
export const crossAuditWithParentLogs = (
  childRawData: (string | number)[][],
  childHeaderRowIndex: number,
  childColIndices: HeaderIndices,
  parentLogs: ParentTitleLog[]
): ParentCrossAuditSummary => {
  const results: ParentCrossMatchResult[] = [];
  let pickupRowsCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;
  let discrepanciesCount = 0;
  let perfectMatchesCount = 0;

  if (!childRawData || childRawData.length <= childHeaderRowIndex + 1) {
    return {
      totalChildRows: 0,
      pickupRowsCount: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      discrepanciesCount: 0,
      perfectMatchesCount: 0,
      results: []
    };
  }

  // Pre-index parent records for high-speed retrieval
  // Map parent logs with indexes by:
  // 1. Parent log ID
  // 2. Normalized Title
  // 3. Asset ID -> records list (multiple records can share the same ID like N/A)
  // 4. Page code -> records list
  // 5. Direct access to all records in log
  interface IndexedParentLogEntry {
    record: AcknowledgementRecord;
    rowIndex: number;
    excelRow: number;
    normId: string;
    normDesc: string;
    normPage: string;
  }

  interface IndexedParentLog {
    log: ParentTitleLog;
    entries: IndexedParentLogEntry[];
    byAssetId: Map<string, IndexedParentLogEntry[]>;
    byPageCode: Map<string, IndexedParentLogEntry[]>;
  }

  const indexedParents: IndexedParentLog[] = parentLogs.map(pLog => {
    const entries: IndexedParentLogEntry[] = [];
    const byAssetId = new Map<string, IndexedParentLogEntry[]>();
    const byPageCode = new Map<string, IndexedParentLogEntry[]>();

    pLog.records.forEach((rec, idx) => {
      const excelRow = pLog.headerRowIndex + 2 + idx;
      const normId = normalizeAssetId(rec.libraryImageNo || '');
      const normDesc = normalizeDescriptionText(rec.description || '');
      const normPage = normalizePageCode(rec.pageNumber || '');

      const entry: IndexedParentLogEntry = {
        record: rec,
        rowIndex: rec.originalRowIndex ?? idx,
        excelRow,
        normId,
        normDesc,
        normPage
      };

      entries.push(entry);

      if (normId) {
        const idList = byAssetId.get(normId) || [];
        idList.push(entry);
        byAssetId.set(normId, idList);
      }

      if (normPage) {
        const pgList = byPageCode.get(normPage) || [];
        pgList.push(entry);
        byPageCode.set(normPage, pgList);
      }
    });

    return { log: pLog, entries, byAssetId, byPageCode };
  });

  // Iterate child rows
  for (let i = childHeaderRowIndex + 1; i < childRawData.length; i++) {
    const row = childRawData[i];
    if (!Array.isArray(row)) continue;
    const isRowEmpty = row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
    if (isRowEmpty) continue;

    const excelRow = i + 1;
    const pageVal = String(row[childColIndices.pageColIndex] ?? '').trim();
    const descVal = String(row[childColIndices.descColIndex] ?? '').trim();
    const imgNoVal = String(row[childColIndices.imgNoColIndex] ?? '').trim();
    const sourceVal = String(row[childColIndices.sourceColIndex] ?? '').trim();
    const rightsVal = String(row[childColIndices.rightsColIndex] ?? '').trim();
    const ackVal = String(row[childColIndices.ackColIndex] ?? '').trim();
    const usageVal = String(row[childColIndices.usageColIndex] ?? '').trim();
    const feeVal = childColIndices.feeColIndex !== undefined ? String(row[childColIndices.feeColIndex] ?? '').trim() : '';
    const notesVal = childColIndices.notesColIndex !== undefined ? String(row[childColIndices.notesColIndex] ?? '').trim() : '';
    const jcCommentsVal = childColIndices.jcCommentsColIndex !== undefined ? String(row[childColIndices.jcCommentsColIndex] ?? '').trim() : '';
    const aptaraCommentsVal = childColIndices.aptaraCommentsColIndex !== undefined ? String(row[childColIndices.aptaraCommentsColIndex] ?? '').trim() : '';
    
    const combinedNotes = [notesVal, jcCommentsVal, aptaraCommentsVal].filter(Boolean).join(' | ');
    const pickupNote = parsePickupTitleNote(combinedNotes);
    
    // Check if this row is marked as a Pickup or notes specify pickup from parent
    const isPickupUsage = /^pick-?up(?:\/.*)?$/i.test(usageVal);
    const isPickupRow = isPickupUsage || !!pickupNote;

    if (!isPickupRow) {
      continue;
    }

    pickupRowsCount++;

    // Attempt to locate candidate parent log
    let targetParentIndex: IndexedParentLog | undefined;
    if (pickupNote?.parentTitle) {
      const normNoteTitle = normalizeTitleString(pickupNote.parentTitle);
      targetParentIndex = indexedParents.find(p => {
        const pTitle = normalizeTitleString(p.log.title || p.log.fileName);
        return pTitle.includes(normNoteTitle) || normNoteTitle.includes(pTitle);
      });
    }

    // If specific parent title not found or only 1 parent log uploaded, default to checking all parents
    const candidateParents = targetParentIndex ? [targetParentIndex] : indexedParents;

    let matchedParentEntry: {
      parentLog: ParentTitleLog;
      record: AcknowledgementRecord;
      excelRow: number;
      rowIndex: number;
      confidence: 'id_and_desc' | 'exact_id' | 'page_and_id' | 'page_and_desc' | 'page_only' | 'id_fuzzy' | 'unmatched';
    } | null = null;

    const childNormAssetId = normalizeAssetId(imgNoVal);
    const childNormPage = normalizePageCode(pickupNote?.parentPage || pageVal);
    const childNormDesc = normalizeDescriptionText(descVal);
    const isChildGenericId = isGenericAssetId(imgNoVal);

    for (const pIdx of candidateParents) {
      // -----------------------------------------------------------------------
      // Strategy 1: ID + Description Match
      // Assets are matched using ID + Description (never ID alone), preventing incorrect
      // matches when generic IDs like N/A, NA, etc. are shared by multiple OUP-owned or other assets.
      // -----------------------------------------------------------------------
      if (childNormAssetId && !isChildGenericId && pIdx.byAssetId.has(childNormAssetId)) {
        const idMatches = pIdx.byAssetId.get(childNormAssetId)!;

        // If child has description, find candidate with description agreement (similarity >= 0.20 or substring)
        if (childNormDesc) {
          let bestEntry: typeof idMatches[0] | null = null;
          let bestSim = -1;

          for (const cand of idMatches) {
            const sim = calculateDescriptionSimilarity(descVal, cand.record.description || '');
            if (sim > bestSim) {
              bestSim = sim;
              bestEntry = cand;
            }
          }

          // Must have description compatibility or candidate description also empty/matches
          if (bestEntry && (bestSim >= 0.18 || !bestEntry.normDesc)) {
            matchedParentEntry = {
              parentLog: pIdx.log,
              record: bestEntry.record,
              excelRow: bestEntry.excelRow,
              rowIndex: bestEntry.rowIndex,
              confidence: 'id_and_desc'
            };
            break;
          }
        } else if (idMatches.length === 1 && !idMatches[0].normDesc) {
          // Both have no description but unique non-generic ID
          matchedParentEntry = {
            parentLog: pIdx.log,
            record: idMatches[0].record,
            excelRow: idMatches[0].excelRow,
            rowIndex: idMatches[0].rowIndex,
            confidence: 'id_and_desc'
          };
          break;
        }
      }

      // -----------------------------------------------------------------------
      // Strategy 2: For Generic ID assets (N/A, NA, OUP owned) or missing IDs, or ID without desc match:
      // Match with Description + Page or Description similarity. NEVER match with ID alone!
      // -----------------------------------------------------------------------
      if (!matchedParentEntry) {
        // (A) Check candidate page in parent + description match
        if (childNormPage && pIdx.byPageCode.has(childNormPage)) {
          const pageCandidates = pIdx.byPageCode.get(childNormPage)!;
          let bestPageMatch: typeof pageCandidates[0] | null = null;
          let maxSim = -1;

          for (const cand of pageCandidates) {
            const sim = calculateDescriptionSimilarity(descVal, cand.record.description || '');
            if (sim > maxSim) {
              maxSim = sim;
              bestPageMatch = cand;
            }
          }

          if (bestPageMatch && (maxSim >= 0.20 || (!childNormDesc && !bestPageMatch.normDesc))) {
            matchedParentEntry = {
              parentLog: pIdx.log,
              record: bestPageMatch.record,
              excelRow: bestPageMatch.excelRow,
              rowIndex: bestPageMatch.rowIndex,
              confidence: 'page_and_desc'
            };
            break;
          }
        }

        // (B) Global Description Match within parent title (if description is distinctive >= 8 chars)
        if (childNormDesc && childNormDesc.length >= 6) {
          let bestGlobalEntry: typeof pIdx.entries[0] | null = null;
          let highestSim = 0.35; // Must have good word overlap

          for (const cand of pIdx.entries) {
            const sim = calculateDescriptionSimilarity(descVal, cand.record.description || '');
            if (sim > highestSim) {
              highestSim = sim;
              bestGlobalEntry = cand;
            }
          }

          if (bestGlobalEntry) {
            matchedParentEntry = {
              parentLog: pIdx.log,
              record: bestGlobalEntry.record,
              excelRow: bestGlobalEntry.excelRow,
              rowIndex: bestGlobalEntry.rowIndex,
              confidence: 'id_and_desc'
            };
            break;
          }
        }
      }
    }

    if (matchedParentEntry) {
      matchedCount++;
      const pRec = matchedParentEntry.record;
      const discrepancies: string[] = [];

      // Run comparisons
      const comparisons: ParentMatchComparison[] = [
        evaluateFieldMatch('libraryImageNo', 'Library Image No', imgNoVal, pRec.libraryImageNo),
        evaluateFieldMatch('source', 'Source Agency', sourceVal, pRec.source),
        evaluateFieldMatch('rightsType', 'Rights Type', rightsVal, pRec.rightsType),
        evaluateFieldMatch('acknowledgement', 'Acknowledgement', ackVal, pRec.acknowledgement),
        evaluateFieldMatch('description', 'Description', descVal, pRec.description),
      ];

      // Discrepancy checks:
      comparisons.forEach(c => {
        if (!c.isMatch) {
          if (c.status === 'mismatch') {
            discrepancies.push(`${c.label} mismatch: Child has "${c.childValue}", Parent has "${c.parentValue}"`);
          } else if (c.status === 'child_empty') {
            discrepancies.push(`${c.label} missing in child log (Parent has "${c.parentValue}")`);
          }
        }
      });

      // Special check: Parent status / replacement check
      if (pickupNote?.isReplacedInParent) {
        if (usageVal.toLowerCase() !== 'new/no license' && usageVal.toLowerCase() !== 'new/nolicense') {
          discrepancies.push(`Parent Replacement Warning: Note specifies replaced in parent title, so Usage must be "New/No License" (currently "${usageVal}").`);
        }
      }

      // Check fee consistency
      if (feeVal && feeVal !== '0') {
        discrepancies.push(`License Fee discrepancy: Child row has fee of "${feeVal}", but inherited pickups must be 0/blank.`);
      }

      const isVerified = discrepancies.length === 0;
      if (isVerified) {
        perfectMatchesCount++;
      } else {
        discrepanciesCount++;
      }

      results.push({
        childRowIndex: i,
        childExcelRow: excelRow,
        childPageNumber: pageVal,
        childImageNo: imgNoVal,
        childDescription: descVal,
        childUsage: usageVal,
        childSource: sourceVal,
        childRights: rightsVal,
        childAck: ackVal,
        childFee: feeVal,
        childNotes: combinedNotes,

        parentLogId: matchedParentEntry.parentLog.id,
        parentLogFileName: matchedParentEntry.parentLog.fileName,
        parentTitle: matchedParentEntry.parentLog.title || matchedParentEntry.parentLog.fileName,
        parentRowIndex: matchedParentEntry.rowIndex,
        parentExcelRow: matchedParentEntry.excelRow,
        parentRecord: pRec,
        parentPageNumber: pRec.pageNumber,
        parentImageNo: pRec.libraryImageNo,
        parentDescription: pRec.description,
        parentUsage: pRec.usageClassification,
        parentSource: pRec.source,
        parentRights: pRec.rightsType,
        parentAck: pRec.acknowledgement,
        parentFee: pRec.licenseFee,
        parentNotes: pRec.notes,

        matchConfidence: matchedParentEntry.confidence,
        isVerified,
        discrepancies,
        comparisons,
      });
    } else {
      unmatchedCount++;
      const discrepancies = [
        pickupNote?.parentTitle 
          ? `Could not find matching image in uploaded parent log for "${pickupNote.parentTitle}" (Asset: "${imgNoVal || 'None'}", Page: "${pickupNote.parentPage || pageVal || 'None'}").`
          : `No matching parent record found in uploaded parent title logs for Asset "${imgNoVal || 'None'}".`
      ];

      results.push({
        childRowIndex: i,
        childExcelRow: excelRow,
        childPageNumber: pageVal,
        childImageNo: imgNoVal,
        childDescription: descVal,
        childUsage: usageVal,
        childSource: sourceVal,
        childRights: rightsVal,
        childAck: ackVal,
        childFee: feeVal,
        childNotes: combinedNotes,

        matchConfidence: 'unmatched',
        isVerified: false,
        discrepancies,
        comparisons: [],
      });
    }
  }

  return {
    totalChildRows: childRawData.length - childHeaderRowIndex - 1,
    pickupRowsCount,
    matchedCount,
    unmatchedCount,
    discrepanciesCount,
    perfectMatchesCount,
    results,
  };
};
