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

  let prevPageNumeric: number | null = null;
  let prevPageStr = '';

  const parsePageNumeric = (pageStr: string): number | null => {
    const clean = pageStr.trim().toLowerCase();
    if (clean === 'c' || clean.includes('cover')) return 0;
    const match = clean.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
    return null;
  };

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
    const usageRegex = /^(New|Pick-?up)\/(License|No-? License|No-?License)$/i;
    if (!usageVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Usage Classification is required.');
    } else if (!usageRegex.test(usageVal)) {
      getOrCreateFlaggedRecord(i).reasons.push(`Invalid Usage Classification "${usageVal}". Must be New/License, New/No License, Pickup/License, or Pickup/No License.`);
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
    } else if (!ackVal.includes('/')) {
      getOrCreateFlaggedRecord(i).reasons.push(`Acknowledgement "${ackVal}" should contain a slash "/" separating the credit from the source.`);
    }

    // 8. Page Number
    const pageVal = String(row[columnIndices.pageColIndex] ?? '').trim();
    if (!pageVal) {
      getOrCreateFlaggedRecord(i).reasons.push('Page Number is required.');
    } else {
      // Style consistency check
      if (detectedPageStyle === 'p_prefix' && !/^p\d+/i.test(pageVal) && pageVal.toLowerCase() !== 'c' && !pageVal.toLowerCase().includes('cover')) {
        getOrCreateFlaggedRecord(i).reasons.push(`Page Number "${pageVal}" does not match the established "p000" style of the log.`);
      } else if (detectedPageStyle === 'digits' && /^p\d+/i.test(pageVal)) {
        getOrCreateFlaggedRecord(i).reasons.push(`Page Number "${pageVal}" is inconsistent with the numerical page format of the log.`);
      }

      // Order check
      const currentNumeric = parsePageNumeric(pageVal);
      if (currentNumeric !== null && prevPageNumeric !== null) {
        if (currentNumeric < prevPageNumeric) {
          getOrCreateFlaggedRecord(i).reasons.push(`Page Number "${pageVal}" is out of order (follows page "${prevPageStr}").`);
        }
      }
      if (currentNumeric !== null) {
        prevPageNumeric = currentNumeric;
        prevPageStr = pageVal;
      }
    }

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
      if (statusReclearedVal !== '') {
        const numRecleared = parseFloat(statusReclearedVal);
        if (isNaN(numRecleared) || numRecleared !== 4) {
          getOrCreateFlaggedRecord(i).reasons.push(`Status recleared (£) must be blank or 4, but is "${statusReclearedVal}".`);
        }
      }
    }

    // 11. Selections made (£)
    if (columnIndices.selectionsMadeColIndex !== undefined) {
      const selectionsVal = String(row[columnIndices.selectionsMadeColIndex] ?? '').trim();
      if (selectionsVal !== '') {
        const numSelections = parseFloat(selectionsVal);
        if (isNaN(numSelections) || (numSelections !== 4 && numSelections !== 8)) {
          getOrCreateFlaggedRecord(i).reasons.push(`Selections made (£) must be blank, 4, or 8, but is "${selectionsVal}".`);
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
