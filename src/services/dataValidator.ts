import type { AIFlaggedRecord, HeaderIndices } from '../types';

export const isIgnoredLastRow = (row: (string | number)[]): boolean => {
  if (!Array.isArray(row)) return false;
  const counts: Record<string, number> = {};
  for (const cell of row) {
    if (cell !== null && cell !== undefined) {
      const val = String(cell).trim().toLowerCase();
      if (val !== '') {
        counts[val] = (counts[val] || 0) + 1;
        if (counts[val] >= 10) {
          return true;
        }
      }
    }
  }
  return false;
};

export const standardizeAgency = (agency: string): string => {
  const clean = agency.trim().replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '');
  const lower = clean.toLowerCase();
  if (lower.includes('shutterstock')) return 'Shutterstock';
  if (lower.includes('getty')) return 'Getty Images';
  if (lower.includes('alamy')) return 'Alamy Stock Photo';
  if (lower === 'oup' || lower.includes('oxford university press')) return 'OUP';
  if (lower.includes('istock')) return 'iStock';
  if (lower.includes('adobe')) return 'Adobe Stock';
  if (lower.includes('corbis')) return 'Corbis';
  return clean;
};

export const cleanRightsType = (rights: string): string => {
  const clean = rights.trim().replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '');
  const lower = clean.toLowerCase();
  if (lower === 'royalty free' || lower === 'royalty-free' || lower === 'rf') {
    return 'RF';
  }
  if (lower === 'rights managed' || lower === 'rights-managed' || lower === 'rights manages' || lower === 'rights-manages' || lower === 'rm') {
    return 'RM';
  }
  if (lower === 'royalty free extended' || lower === 'royalty-free extended' || lower === 'rfe') {
    return 'RFe';
  }
  const upper = clean.toUpperCase();
  if (upper === 'RFE') return 'RFe';
  return upper;
};

export interface TwoPartNoteData {
  isTwoPartNote: boolean;
  previousSource: string;
  previousRightsType: string;
  outcome?: 'tineye_found' | 'reverse_research_found' | 'not_found_research_recommended';
  newSource?: string;
  newRightsType?: string;
}

export const parseTwoPartNote = (noteText: string): TwoPartNoteData | null => {
  if (!noteText) return null;
  const clean = noteText.replace(/\s+/g, ' ').trim();
  const lower = clean.toLowerCase();

  // Must have indication of two parts: starts with (1) or contains "earlier" and "licensed"
  const hasPart1Marker = /\(?1[\).]\s*/.test(clean) || (lower.includes('earlier') && lower.includes('licensed'));
  if (!hasPart1Marker) return null;

  // Split into Part 1 and Part 2
  let part1 = clean;
  let part2 = '';
  const match2 = clean.search(/(?:\(?2[\).:]\s*)|(?:in tineye)/i);
  if (match2 !== -1 && match2 > 0) {
    part1 = clean.substring(0, match2).trim();
    part2 = clean.substring(match2).trim();
  } else {
    const tineyeIdx = lower.indexOf('tineye');
    if (tineyeIdx !== -1) {
      part1 = clean.substring(0, tineyeIdx).trim();
      part2 = clean.substring(tineyeIdx).trim();
    }
  }

  // Parse Part 1: Previous source and rights type
  // Pattern: "Earlier the image was licensed from {source} as {rights type}"
  // Supports RF, RM, RFe as well as "Royalty Free", "Rights Managed", "Rights Manages", etc.
  let previousSource = '';
  let previousRightsType = '';

  const part1Match = part1.match(/from\s+([A-Za-z0-9\s._'-]+?)\s+as\s+([A-Za-z0-9\s/_-]+?)(?:[.,;:]|\s*\(2\)|$)/i);
  if (part1Match) {
    previousSource = standardizeAgency(part1Match[1]);
    previousRightsType = cleanRightsType(part1Match[2]);
  } else {
    const vendors = ['Shutterstock', 'Getty Images', 'Alamy Stock Photo', 'Alamy', 'OUP', 'Corbis', 'iStock', 'Adobe Stock'];
    for (const v of vendors) {
      if (part1.toLowerCase().includes(v.toLowerCase())) {
        previousSource = standardizeAgency(v);
        break;
      }
    }
    const rightsMatch = part1.match(/\b(Royalty\s+Free(?:\s+Extended)?|Rights\s+Manage[ds]|RF|RM|RFe)\b/i);
    if (rightsMatch) {
      previousRightsType = cleanRightsType(rightsMatch[1]);
    }
  }

  // Parse Part 2: Outcome & new source / rights
  const lowerPart2 = part2.toLowerCase();
  let outcome: 'tineye_found' | 'reverse_research_found' | 'not_found_research_recommended' | undefined;
  let newSource = '';
  let newRightsType = '';

  const hasReverseResearch = lowerPart2.includes('reverse research') || lowerPart2.includes('reverse search');
  const reverseFoundMatch = part2.match(/(?:reverse\s+research|reverse\s+search)[^.]*?found\s+(?:on|at|in)\s+([A-Za-z0-9\s._'-]+?)\s+as\s+([A-Za-z0-9\s/_-]+?)(?:[.,;:]|\s*please|\s*\(|$)/i);

  if (hasReverseResearch && reverseFoundMatch) {
    outcome = 'reverse_research_found';
    newSource = standardizeAgency(reverseFoundMatch[1]);
    newRightsType = cleanRightsType(reverseFoundMatch[2]);
  } else {
    const tineyeFoundMatch = part2.match(/tineye[^.]*?found\s+(?:on|at|in)\s+([A-Za-z0-9\s._'-]+?)\s+as\s+([A-Za-z0-9\s/_-]+?)(?:[.,;:]|\s*please|\s*\(|$)/i);
    const tineyeNotFound = lowerPart2.includes('tineye') && (lowerPart2.includes('not found') || lowerPart2.includes('is not found'));

    if (tineyeFoundMatch && !tineyeNotFound) {
      outcome = 'tineye_found';
      newSource = standardizeAgency(tineyeFoundMatch[1]);
      newRightsType = cleanRightsType(tineyeFoundMatch[2]);
    } else if (tineyeNotFound || lowerPart2.includes('photo research') || lowerPart2.includes('do research')) {
      outcome = 'not_found_research_recommended';
    } else {
      const generalFoundMatch = part2.match(/found\s+(?:on|at|in)\s+([A-Za-z0-9\s._'-]+?)\s+as\s+([A-Za-z0-9\s/_-]+?)(?:[.,;:]|\s*please|\s*\(|$)/i);
      if (generalFoundMatch) {
        outcome = hasReverseResearch ? 'reverse_research_found' : 'tineye_found';
        newSource = standardizeAgency(generalFoundMatch[1]);
        newRightsType = cleanRightsType(generalFoundMatch[2]);
      } else if (lowerPart2.includes('not found')) {
        outcome = 'not_found_research_recommended';
      }
    }
  }

  return {
    isTwoPartNote: true,
    previousSource,
    previousRightsType,
    outcome,
    newSource,
    newRightsType
  };
};

export interface PageSequenceInfo {
  raw: string;
  isCover: boolean;
  coverIndex: number; // e.g. 1 for CVR or CVR(1), 2 for CVR(2), etc.
  isNormalPage: boolean;
  normalPageNumber: number; // e.g. 1, 2, 3...
  isValidFormat: boolean;
  formatErrorMessage?: string;
}

export const parsePageSequenceInfo = (pageStr: string): PageSequenceInfo => {
  const clean = pageStr.trim();
  if (!clean) {
    return {
      raw: clean,
      isCover: false,
      coverIndex: 0,
      isNormalPage: false,
      normalPageNumber: 0,
      isValidFormat: false,
      formatErrorMessage: 'Page Number is required.'
    };
  }

  const lower = clean.toLowerCase();

  // 1. Check for invalid CVR(0) or negative/non-positive indices
  const cvrZeroOrInvalid = clean.match(/^cvr\s*\(\s*([-\d]+)\s*\)$/i);
  if (cvrZeroOrInvalid) {
    const num = parseInt(cvrZeroOrInvalid[1], 10);
    if (isNaN(num) || num < 1) {
      return {
        raw: clean,
        isCover: true,
        coverIndex: 0,
        isNormalPage: false,
        normalPageNumber: 0,
        isValidFormat: false,
        formatErrorMessage: `Page Number "${clean}" is invalid. CVR(n) page index must be a positive integer starting with 1 (e.g. CVR(1), CVR(2)).`
      };
    }
  }

  // 2. Check for valid CVR or CVR(n) or CVR n (case-insensitive, n >= 1)
  const cvrMatch = clean.match(/^cvr(?:\s*\(\s*([1-9]\d*)\s*\)|\s*([1-9]\d*))?$/i);
  if (cvrMatch) {
    const n = cvrMatch[1] || cvrMatch[2];
    const coverIndex = n ? parseInt(n, 10) : 1;
    return {
      raw: clean,
      isCover: true,
      coverIndex,
      isNormalPage: false,
      normalPageNumber: 0,
      isValidFormat: true
    };
  }

  // 3. Check for other standard cover formats (cover, cov, c, fc, ifc, ibc, bc)
  if (lower === 'c' || lower === 'cover' || lower === 'cov' || lower === 'front cover' || lower === 'fc') {
    return {
      raw: clean,
      isCover: true,
      coverIndex: 1,
      isNormalPage: false,
      normalPageNumber: 0,
      isValidFormat: true
    };
  }
  if (lower === 'ifc' || lower === 'inside front cover') {
    return {
      raw: clean,
      isCover: true,
      coverIndex: 2,
      isNormalPage: false,
      normalPageNumber: 0,
      isValidFormat: true
    };
  }
  if (lower === 'ibc' || lower === 'inside back cover') {
    return {
      raw: clean,
      isCover: true,
      coverIndex: 3,
      isNormalPage: false,
      normalPageNumber: 0,
      isValidFormat: true
    };
  }
  if (lower === 'bc' || lower === 'back cover') {
    return {
      raw: clean,
      isCover: true,
      coverIndex: 4,
      isNormalPage: false,
      normalPageNumber: 0,
      isValidFormat: true
    };
  }

  // 4. Check for normal page formats (p01, p1, 1, 12, 12a, 12-13, etc.)
  const pageDigitsMatch = clean.match(/^(?:p\s*)?(\d+)(?:([a-z])|[-–/]\d+)?$/i);
  if (pageDigitsMatch) {
    const mainNum = parseInt(pageDigitsMatch[1], 10);
    let subFraction = 0;
    if (pageDigitsMatch[2]) {
      subFraction = (pageDigitsMatch[2].toLowerCase().charCodeAt(0) - 96) * 0.001;
    }
    return {
      raw: clean,
      isCover: false,
      coverIndex: 0,
      isNormalPage: true,
      normalPageNumber: mainNum + subFraction,
      isValidFormat: true
    };
  }

  // 5. Roman numeral prelims (e.g. i, ii, iii, iv, v, vi, vii, viii, ix, x, xi, xii)
  const romanMatch = clean.match(/^(?:p\s*)?(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)$/i);
  if (romanMatch) {
    const romanMap: Record<string, number> = {
      i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
      xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20
    };
    const rVal = romanMap[romanMatch[1].toLowerCase()] || 1;
    return {
      raw: clean,
      isCover: false,
      coverIndex: 0,
      isNormalPage: true,
      normalPageNumber: 0.0001 * rVal,
      isValidFormat: true
    };
  }

  // Generic fallback if any digits exist in the string
  const genericNumberMatch = clean.match(/\d+/);
  if (genericNumberMatch) {
    return {
      raw: clean,
      isCover: false,
      coverIndex: 0,
      isNormalPage: true,
      normalPageNumber: parseInt(genericNumberMatch[0], 10),
      isValidFormat: true
    };
  }

  return {
    raw: clean,
    isCover: false,
    coverIndex: 0,
    isNormalPage: false,
    normalPageNumber: 0,
    isValidFormat: true
  };
};

export const comparePageValues = (a: any, b: any): number => {
  const strA = String(a ?? '').trim();
  const strB = String(b ?? '').trim();

  if (!strA && !strB) return 0;
  if (!strA) return 1;
  if (!strB) return -1;

  const infoA = parsePageSequenceInfo(strA);
  const infoB = parsePageSequenceInfo(strB);

  // If both are covers, sort by cover index (e.g. CVR(1) < CVR(2) < CVR(3))
  if (infoA.isCover && infoB.isCover) {
    return infoA.coverIndex - infoB.coverIndex;
  }
  // Cover entries always come before normal pages
  if (infoA.isCover && !infoB.isCover) {
    return -1;
  }
  if (!infoA.isCover && infoB.isCover) {
    return 1;
  }

  // If both are normal pages, sort numerically
  if (infoA.isNormalPage && infoB.isNormalPage) {
    return infoA.normalPageNumber - infoB.normalPageNumber;
  }

  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Validates records based on the LR / AMH log rules.
 * @param rawData - The raw data array from the Excel sheet or pasted table.
 * @param headerRowIndex - The index of the header row.
 * @param columnIndices - An object mapping column names to their indices.
 * @returns An array of flagged records with reasons for the flag.
 */
export const validateData = (
  rawData: (string | number)[][],
  headerRowIndex: number,
  columnIndices: HeaderIndices
): AIFlaggedRecord[] => {
  type TempFlaggedRecord = AIFlaggedRecord & { reasons: string[] };
  const recordsMap = new Map<number, TempFlaggedRecord>();
  const REASON_SEPARATOR = '|||';

  const getOrCreateFlaggedRecord = (rowIndex: number): TempFlaggedRecord => {
    if (recordsMap.has(rowIndex)) {
      return recordsMap.get(rowIndex)!;
    }
    const row = rawData[rowIndex] || [];
    const record: TempFlaggedRecord = {
      bragStatus: columnIndices.bragStatusColIndex !== undefined ? String(row[columnIndices.bragStatusColIndex] ?? '').trim() : '',
      source: String(row[columnIndices.sourceColIndex] ?? '').trim(),
      acknowledgement: String(row[columnIndices.ackColIndex] ?? '').trim(),
      pageNumber: String(row[columnIndices.pageColIndex] ?? '').trim(),
      usageClassification: String(row[columnIndices.usageColIndex] ?? '').trim(),
      licenseFee: columnIndices.feeColIndex !== undefined ? String(row[columnIndices.feeColIndex] ?? '').trim() : '',
      originalRowIndex: rowIndex,
      description: String(row[columnIndices.descColIndex] ?? '').trim(),
      libraryImageNo: String(row[columnIndices.imgNoColIndex] ?? '').trim(),
      rightsType: String(row[columnIndices.rightsColIndex] ?? '').trim(),
      photologCreation: columnIndices.photologColIndex !== undefined ? String(row[columnIndices.photologColIndex] ?? '').trim() : '',
      statusRecleared: columnIndices.statusReclearedColIndex !== undefined ? String(row[columnIndices.statusReclearedColIndex] ?? '').trim() : '',
      selectionsMade: columnIndices.selectionsMadeColIndex !== undefined ? String(row[columnIndices.selectionsMadeColIndex] ?? '').trim() : '',
      notes: columnIndices.notesColIndex !== undefined ? String(row[columnIndices.notesColIndex] ?? '').trim() : '',
      jcComments: columnIndices.jcCommentsColIndex !== undefined ? String(row[columnIndices.jcCommentsColIndex] ?? '').trim() : '',
      aptaraComments: columnIndices.aptaraCommentsColIndex !== undefined ? String(row[columnIndices.aptaraCommentsColIndex] ?? '').trim() : '',
      reason: '',
      reasons: [],
    };
    recordsMap.set(rowIndex, record);
    return record;
  };

  // Determine last data row index
  let lastDataRowIndex = -1;
  for (let i = rawData.length - 1; i > headerRowIndex; i--) {
    const row = rawData[i];
    if (Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
      if (isIgnoredLastRow(row)) {
        continue; // Skip last row if at least 10 cells contain identical data
      }
      lastDataRowIndex = i;
      break;
    }
  }

  if (lastDataRowIndex === -1) {
    return [];
  }

  // Pre-pass: Detect page number formatting style across the log
  let pPrefixCount = 0;
  let digitsLetterCount = 0;

  for (let i = headerRowIndex + 1; i <= lastDataRowIndex; i++) {
    const row = rawData[i];
    if (!Array.isArray(row)) continue;
    const pageStr = String(row[columnIndices.pageColIndex] ?? '').trim();
    if (!pageStr) continue;

    if (/^p\d+/i.test(pageStr)) {
      pPrefixCount++;
    } else if (/^\d+[a-z]?$/i.test(pageStr)) {
      digitsLetterCount++;
    }
  }

  const detectedPageStyle = pPrefixCount >= digitsLetterCount && pPrefixCount > 0 ? 'p_prefix' : 'digits';

  let prevPageStr = '';

  // --- ROW-BY-ROW VALIDATION ---
  for (let i = headerRowIndex + 1; i <= lastDataRowIndex; i++) {
    const row = rawData[i];
    if (!Array.isArray(row)) continue;

    const isRowEmpty = row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
    if (isRowEmpty) continue;

    // 1. Brag Status
    if (columnIndices.bragStatusColIndex !== undefined) {
      const bragVal = String(row[columnIndices.bragStatusColIndex] ?? '').trim();
      if (bragVal !== '') {
        getOrCreateFlaggedRecord(i).reasons.push(`Brag Status must always be empty, but is "${bragVal}".`);
      }
    }

    // 2. Usage Classification
    const usageVal = String(row[columnIndices.usageColIndex] ?? '').trim();
    const usageRegex = /^(New|Pick-?up)\/(License|No-? License|No-?License)$|^New$/i;
    if (!usageVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Usage Classification is required.');
    } else if (!usageRegex.test(usageVal)) {
      getOrCreateFlaggedRecord(i).reasons.push(`Invalid Usage Classification "${usageVal}". Must be New, New/License, New/No License, Pickup/License, or Pickup/No License.`);
    }

    // 3. Description
    const descVal = String(row[columnIndices.descColIndex] ?? '').trim();
    if (!descVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Description is required.');
    }

    // 4. Library Image No
    const imgNoVal = String(row[columnIndices.imgNoColIndex] ?? '').trim();
    if (!imgNoVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Library Image No is required.');
    }

    // 5. Source
    const sourceVal = String(row[columnIndices.sourceColIndex] ?? '').trim();
    if (!sourceVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Source is required.');
    } else {
      const lowerSource = sourceVal.toLowerCase();
      if (lowerSource.includes('shutterstock')) {
        if (sourceVal !== 'Shutterstock') {
          getOrCreateFlaggedRecord(i).reasons.push(`Source must be formatted exactly as "Shutterstock", but is "${sourceVal}".`);
        }
      } else if (lowerSource.includes('getty')) {
        if (sourceVal !== 'Getty Images') {
          getOrCreateFlaggedRecord(i).reasons.push(`Source must be formatted exactly as "Getty Images", but is "${sourceVal}".`);
        }
      } else if (lowerSource.includes('alamy')) {
        if (sourceVal !== 'Alamy Stock Photo') {
          getOrCreateFlaggedRecord(i).reasons.push(`Source must be formatted exactly as "Alamy Stock Photo", but is "${sourceVal}".`);
        }
      } else if (lowerSource === 'oup' || lowerSource.includes('oxford university press')) {
        if (sourceVal !== 'OUP') {
          getOrCreateFlaggedRecord(i).reasons.push(`Source must be formatted exactly as "OUP", but is "${sourceVal}".`);
        }
      }
    }

    // 6. Rights Type
    const rightsVal = String(row[columnIndices.rightsColIndex] ?? '').trim();
    const validRights = ['RF', 'RM', 'RFe', 'N/A', 'N/a', 'n/a'];
    if (!rightsVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Rights Type is required.');
    } else if (!validRights.includes(rightsVal) && rightsVal.toLowerCase() !== 'n/a') {
      getOrCreateFlaggedRecord(i).reasons.push(`Rights Type must be RF, RM, RFe, or n/a, but is "${rightsVal}".`);
    }

    // 7. Acknowledgement
    const ackVal = String(row[columnIndices.ackColIndex] ?? '').trim();
    if (!ackVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Acknowledgement is required.');
    } else {
      const isSameAsSource = ackVal.toLowerCase() === sourceVal.toLowerCase();
      if (isSameAsSource) {
        getOrCreateFlaggedRecord(i).reasons.push(`[WARNING] No known photographer/creator specified. Acknowledgement matches Source ("${sourceVal}") without a slash.`);
      } else if (!ackVal.includes('/')) {
        getOrCreateFlaggedRecord(i).reasons.push(`Acknowledgement "${ackVal}" should contain a slash "/" separating the credit from the source.`);
      } else {
        // Acknowledgement has a slash. Check that the last part matches the Source column value.
        const lastSlashIndex = ackVal.lastIndexOf('/');
        const lastPart = ackVal.substring(lastSlashIndex + 1).trim();
        if (lastPart.toLowerCase() !== sourceVal.toLowerCase()) {
          getOrCreateFlaggedRecord(i).reasons.push(`Acknowledgement source mismatch: Last part after slash is "${lastPart}", but the Source column says "${sourceVal}".`);
        }
      }
    }

    // 8. Page Number
    const pageVal = String(row[columnIndices.pageColIndex] ?? '').trim();
    if (!pageVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Page Number is required.');
    } else {
      const pageInfo = parsePageSequenceInfo(pageVal);

      // Check for format error (e.g. CVR(0) or negative/invalid page format)
      if (!pageInfo.isValidFormat && pageInfo.formatErrorMessage) {
        getOrCreateFlaggedRecord(i).reasons.push(pageInfo.formatErrorMessage);
      } else if (!pageInfo.isCover) {
        // Style consistency check for normal pages
        if (detectedPageStyle === 'p_prefix' && !/^p\d+/i.test(pageVal)) {
          getOrCreateFlaggedRecord(i).reasons.push(`Page Number "${pageVal}" does not match the established "p000" style of the log.`);
        } else if (detectedPageStyle === 'digits' && /^p\d+/i.test(pageVal)) {
          getOrCreateFlaggedRecord(i).reasons.push(`Page Number "${pageVal}" is inconsistent with the numerical page format of the log.`);
        }
      }

      // Order check: CVR / CVR(n) must precede normal pages, and sequence must be non-decreasing
      if (prevPageStr !== '') {
        if (comparePageValues(prevPageStr, pageVal) > 0) {
          getOrCreateFlaggedRecord(i).reasons.push(`Page Number "${pageVal}" is out of order (follows page "${prevPageStr}").`);
        }
      }
      prevPageStr = pageVal;
    }

    // Notes classification & relationship flags
    const notesVal = columnIndices.notesColIndex !== undefined ? String(row[columnIndices.notesColIndex] ?? '').trim() : '';
    const cleanNote = notesVal.replace(/\s+/g, ' ').trim();
    const lowerNote = cleanNote.toLowerCase();

    const isNoteRoyaltyFree = lowerNote.includes('marked as royalty free in the reproduction form') && lowerNote.includes('okay to use');
    const isNoteOUPOwned = lowerNote.includes('marked as oup owned in the reproduction form') && lowerNote.includes('okay to use');
    const isNoteCommissioned = (lowerNote.includes('commissioned photography') || lowerNote.includes('commissioned')) && 
      (lowerNote.includes('as per acknowledgement') || lowerNote.includes('acknowledgement')) && 
      lowerNote.includes('okay to use');
    const hasZeroFeeNote = isNoteRoyaltyFree || isNoteOUPOwned || isNoteCommissioned;

    const twoPartNote = parseTwoPartNote(notesVal);
    const hasTwoPartNote = !!(twoPartNote && twoPartNote.outcome);

    // 9. Photolog Creation (£)
    if (columnIndices.photologColIndex !== undefined) {
      const photologVal = String(row[columnIndices.photologColIndex] ?? '').trim();
      const numPhotolog = parseFloat(photologVal);
      if (photologVal === '' || isNaN(numPhotolog) || numPhotolog !== 0.5) {
        getOrCreateFlaggedRecord(i).reasons.push(`Photolog Creation (£) must be 0.5, but is "${photologVal || 'blank'}".`);
      }
    }

    // 10. Status recleared (£)
    if (columnIndices.statusReclearedColIndex !== undefined) {
      const statusReclearedVal = String(row[columnIndices.statusReclearedColIndex] ?? '').trim();
      if (hasZeroFeeNote) {
        if (statusReclearedVal !== '' && statusReclearedVal !== '0') {
          const numRecleared = parseFloat(statusReclearedVal);
          if (isNaN(numRecleared) || numRecleared !== 0) {
            getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Status recleared (£) must be 0 or blank, but found "${statusReclearedVal}".`);
          }
        }
      } else if (!hasTwoPartNote && statusReclearedVal !== '') {
        const numRecleared = parseFloat(statusReclearedVal);
        if (isNaN(numRecleared) || numRecleared !== 4) {
          getOrCreateFlaggedRecord(i).reasons.push(`Status recleared (£) must be blank or 4, but is "${statusReclearedVal}".`);
        }
      }
    }

    // 11. Selections made (£)
    if (columnIndices.selectionsMadeColIndex !== undefined) {
      const selectionsVal = String(row[columnIndices.selectionsMadeColIndex] ?? '').trim();
      if (hasZeroFeeNote) {
        if (selectionsVal !== '' && selectionsVal !== '0') {
          const numSelections = parseFloat(selectionsVal);
          if (isNaN(numSelections) || numSelections !== 0) {
            getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Selections made (£) must be 0 or blank, but found "${selectionsVal}".`);
          }
        }
      } else if (!hasTwoPartNote && selectionsVal !== '') {
        const numSelections = parseFloat(selectionsVal);
        if (isNaN(numSelections) || (numSelections !== 4 && numSelections !== 8)) {
          getOrCreateFlaggedRecord(i).reasons.push(`Selections made (£) must be blank, 4, or 8, but is "${selectionsVal}".`);
        }
      }
    }

    // 12. License Fee Check for Licensed Usage Classifications
    if (columnIndices.feeColIndex !== undefined) {
      const feeVal = String(row[columnIndices.feeColIndex] ?? '').trim();
      const usageLower = usageVal.toLowerCase();
      const isLicenseType = (usageLower.includes('new/license') || usageLower.includes('pickup/license') || usageLower.includes('pick-up/license')) && !usageLower.includes('no');
      
      if (isLicenseType) {
        const numFee = parseFloat(feeVal);
        if (feeVal === '' || isNaN(numFee) || numFee === 0) {
          getOrCreateFlaggedRecord(i).reasons.push(`License fee is required and cannot be empty or 0 when Usage Classification is "${usageVal}".`);
        } else {
          const lowerSource = sourceVal.toLowerCase();
          const cleanRights = rightsVal.toUpperCase();
          
          if (lowerSource.includes('shutterstock')) {
            if (cleanRights === 'RF' && numFee !== 10) {
              getOrCreateFlaggedRecord(i).reasons.push(`License fee for Shutterstock RF must be exactly 10, but is "${feeVal}".`);
            } else if (cleanRights === 'RM' && numFee !== 40) {
              getOrCreateFlaggedRecord(i).reasons.push(`License fee for Shutterstock RM must be exactly 40, but is "${feeVal}".`);
            }
          } else if (lowerSource.includes('getty')) {
            if (cleanRights === 'RF' && numFee !== 17.5) {
              getOrCreateFlaggedRecord(i).reasons.push(`License fee for Getty Images RF must be exactly 17.5, but is "${feeVal}".`);
            } else if (cleanRights === 'RM' && numFee !== 40) {
              getOrCreateFlaggedRecord(i).reasons.push(`License fee for Getty Images RM must be exactly 40, but is "${feeVal}".`);
            }
          } else if (lowerSource.includes('alamy')) {
            if (numFee !== 45 && numFee !== 29) {
              getOrCreateFlaggedRecord(i).reasons.push(`License fee for Alamy Stock Photo must be either 45 or 29, but is "${feeVal}".`);
            }
          }
        }
      }
    }

    // 13. Notes Relationship Checks
    if (hasZeroFeeNote) {
      // Usage Classification must be Pickup/No License
      const cleanUsage = usageVal.toLowerCase().replace(/[\s-]/g, '');
      if (cleanUsage !== 'pickup/nolicense') {
        getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Usage Classification must be "Pickup/No License", but found "${usageVal || 'blank'}".`);
      }

      // Cost (License Fee) must be 0 or blank
      if (columnIndices.feeColIndex !== undefined) {
        const feeVal = String(row[columnIndices.feeColIndex] ?? '').trim();
        if (feeVal !== '' && feeVal !== '0') {
          const numFee = parseFloat(feeVal.replace(/[^0-9.-]/g, ''));
          if (!isNaN(numFee) && numFee !== 0) {
            getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Cost (License Fee) must be 0 or blank, but found "${feeVal}".`);
          }
        }
      }

      // Note 1: Royalty Free in Reproduction Form
      if (isNoteRoyaltyFree) {
        const cleanRights = rightsVal.toUpperCase();
        if (cleanRights !== 'RF') {
          getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Rights Type must be "RF", but found "${rightsVal || 'blank'}".`);
        }
      }

      // Note 2: OUP owned in Reproduction Form
      if (isNoteOUPOwned) {
        const cleanRights = rightsVal.toUpperCase();
        if (cleanRights !== 'RF' && cleanRights !== 'RFE') {
          getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Rights Type must be "RF" or "RFe", but found "${rightsVal || 'blank'}".`);
        }
        if (sourceVal !== 'OUP') {
          getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Source must be "OUP", but found "${sourceVal || 'blank'}".`);
        }
      }

      // Note 3: Commissioned Photography
      if (isNoteCommissioned) {
        const cleanRights = rightsVal.toUpperCase();
        if (cleanRights !== 'RF' && cleanRights !== 'RFE') {
          getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Rights Type must be "RF" or "RFe", but found "${rightsVal || 'blank'}".`);
        }
        if (sourceVal !== 'OUP') {
          getOrCreateFlaggedRecord(i).reasons.push(`Note discrepancy: Note indicates Source must be "OUP", but found "${sourceVal || 'blank'}".`);
        }
      }
    }

    // 14. Two-Part Notes Relationship Checks
    if (twoPartNote && twoPartNote.outcome) {
      const statusReclearedVal = columnIndices.statusReclearedColIndex !== undefined ? String(row[columnIndices.statusReclearedColIndex] ?? '').trim() : '';
      const selectionsVal = columnIndices.selectionsMadeColIndex !== undefined ? String(row[columnIndices.selectionsMadeColIndex] ?? '').trim() : '';

      if (twoPartNote.outcome === 'not_found_research_recommended') {
        // Usage Classification: New
        const cleanUsage = usageVal.toLowerCase().replace(/[\s-]/g, '');
        if (!cleanUsage.startsWith('new')) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When Photo Research is recommended, Usage Classification must be "New" (or "New/No License"), but found "${usageVal || 'blank'}".`
          );
        }

        // Source: Same as in Part 1 (previous source)
        if (twoPartNote.previousSource && sourceVal.toLowerCase() !== twoPartNote.previousSource.toLowerCase()) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When Photo Research is recommended, Source must match the previous image source ("${twoPartNote.previousSource}"), but found "${sourceVal || 'blank'}".`
          );
        }

        // Rights Type: Same as in Part 1 (previous rights type)
        if (twoPartNote.previousRightsType && rightsVal.toUpperCase() !== twoPartNote.previousRightsType.toUpperCase()) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When Photo Research is recommended, Rights Type must match the previous image rights ("${twoPartNote.previousRightsType}"), but found "${rightsVal || 'blank'}".`
          );
        }

        // Status recleared: 4
        if (statusReclearedVal === '' || parseFloat(statusReclearedVal) !== 4) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When Photo Research is recommended, Status recleared (£) must be 4, but found "${statusReclearedVal || 'blank'}".`
          );
        }

        // Selections made: 0 or blank
        if (selectionsVal !== '' && selectionsVal !== '0') {
          const numSelections = parseFloat(selectionsVal);
          if (isNaN(numSelections) || numSelections !== 0) {
            getOrCreateFlaggedRecord(i).reasons.push(
              `Note discrepancy: When Photo Research is recommended, Selections made (£) must be 0 or blank, but found "${selectionsVal}".`
            );
          }
        }

        // License Fee: 0 or blank
        if (columnIndices.feeColIndex !== undefined) {
          const feeVal = String(row[columnIndices.feeColIndex] ?? '').trim();
          if (feeVal !== '' && feeVal !== '0') {
            const numFee = parseFloat(feeVal.replace(/[^0-9.-]/g, ''));
            if (!isNaN(numFee) && numFee !== 0) {
              getOrCreateFlaggedRecord(i).reasons.push(
                `Note discrepancy: When Photo Research is recommended, License fee must be 0 or blank, but found "${feeVal}".`
              );
            }
          }
        }
      } else if (twoPartNote.outcome === 'tineye_found') {
        // Usage Classification: Pickup/License
        const cleanUsage = usageVal.toLowerCase().replace(/[\s-]/g, '');
        if (cleanUsage !== 'pickup/license') {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in TinEye and licensing is recommended, Usage Classification must be "Pickup/License", but found "${usageVal || 'blank'}".`
          );
        }

        // Source: source found during TinEye
        if (twoPartNote.newSource && sourceVal.toLowerCase() !== twoPartNote.newSource.toLowerCase()) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in TinEye, Source must be "${twoPartNote.newSource}", but found "${sourceVal || 'blank'}".`
          );
        }

        // Rights Type: rights type found during TinEye
        if (twoPartNote.newRightsType && rightsVal.toUpperCase() !== twoPartNote.newRightsType.toUpperCase()) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in TinEye, Rights Type must be "${twoPartNote.newRightsType}", but found "${rightsVal || 'blank'}".`
          );
        }

        // Status recleared: 4
        if (statusReclearedVal === '' || parseFloat(statusReclearedVal) !== 4) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in TinEye, Status recleared (£) must be 4, but found "${statusReclearedVal || 'blank'}".`
          );
        }

        // Selections made: 0 or blank
        if (selectionsVal !== '' && selectionsVal !== '0') {
          const numSelections = parseFloat(selectionsVal);
          if (isNaN(numSelections) || numSelections !== 0) {
            getOrCreateFlaggedRecord(i).reasons.push(
              `Note discrepancy: When image is found in TinEye, Selections made (£) must be 0 or blank, but found "${selectionsVal}".`
            );
          }
        }
      } else if (twoPartNote.outcome === 'reverse_research_found') {
        // Usage Classification: Pickup/License
        const cleanUsage = usageVal.toLowerCase().replace(/[\s-]/g, '');
        if (cleanUsage !== 'pickup/license') {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in Reverse Research and licensing is recommended, Usage Classification must be "Pickup/License", but found "${usageVal || 'blank'}".`
          );
        }

        // Source: source found during Reverse Research
        if (twoPartNote.newSource && sourceVal.toLowerCase() !== twoPartNote.newSource.toLowerCase()) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in Reverse Research, Source must be "${twoPartNote.newSource}", but found "${sourceVal || 'blank'}".`
          );
        }

        // Rights Type: rights type found during Reverse Research
        if (twoPartNote.newRightsType && rightsVal.toUpperCase() !== twoPartNote.newRightsType.toUpperCase()) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in Reverse Research, Rights Type must be "${twoPartNote.newRightsType}", but found "${rightsVal || 'blank'}".`
          );
        }

        // Status recleared: 0 or blank
        if (statusReclearedVal !== '' && statusReclearedVal !== '0') {
          const numRecleared = parseFloat(statusReclearedVal);
          if (isNaN(numRecleared) || numRecleared !== 0) {
            getOrCreateFlaggedRecord(i).reasons.push(
              `Note discrepancy: When image is found in Reverse Research, Status recleared (£) must be 0 or blank, but found "${statusReclearedVal}".`
            );
          }
        }

        // Selections made: 8
        if (selectionsVal === '' || parseFloat(selectionsVal) !== 8) {
          getOrCreateFlaggedRecord(i).reasons.push(
            `Note discrepancy: When image is found in Reverse Research, Selections made (£) must be 8, but found "${selectionsVal || 'blank'}".`
          );
        }
      }
    }
  }

  const finalFlags: AIFlaggedRecord[] = [];
  for (const record of recordsMap.values()) {
    if (record.reasons.length > 0) {
      record.reason = record.reasons.join(REASON_SEPARATOR);
      const { reasons, ...finalRecord } = record;
      finalFlags.push(finalRecord);
    }
  }

  return finalFlags;
};
