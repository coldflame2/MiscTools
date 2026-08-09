export interface BmsHeaderInfo {
  headerRowIndex: number;
  thumbnailColIndex: number;
  foundHeaders: string[];
  missingHeaders: string[];
  colMap: Record<string, number>; // Normalized header key -> column index
}

export interface BmsIssue {
  id: string;
  fileType: 'original' | 'final' | 'cross';
  fileName: string;
  rowIndex?: number; // 1-based row number in spreadsheet
  origRow?: number | string; // Excel row in Original Hi-Res log (for cross-matching)
  finalRow?: number | string; // Excel row in Final Recoded log (for cross-matching)
  excelRow?: number | string;
  assetName?: string;
  field?: string;
  currentValue?: string;
  origValue?: string;
  finalValue?: string;
  severity: 'error' | 'warning' | 'info';
  category: 'mandatory' | 'type_value' | 'brag_metadata' | 'cross_discrepancy' | 'header_missing';
  message: string;
  expectedValue?: string;
}

export interface NameLengthAnalysis {
  totalCount: number;
  isUniformLength: boolean;
  commonLength: number | null;
  lengthCounts: Record<number, number>;
  outliers: { rowIndex: number; value: string; length: number }[];
}

export interface BmsFileValidationResult {
  fileName: string;
  fileType: 'original' | 'final';
  totalRows: number;
  validRowsCount: number;
  headerInfo: BmsHeaderInfo;
  issues: BmsIssue[];
  records: Record<string, string>[];
  nameLengthAnalysis: NameLengthAnalysis;
}

export interface BmsCrossValidationResult {
  totalOriginalRecords: number;
  totalFinalRecords: number;
  matchedCount: number;
  unmatchedOriginalCount: number;
  unmatchedFinalCount: number;
  discrepanciesCount: number;
  issues: BmsIssue[];
}

export const EXPECTED_BMS_HEADERS = [
  "Thumbnail",
  "BRAG Status",
  "Type (read-only)",
  "Name (mandatory)",
  "Title",
  "Description",
  "Tags",
  "Supplier Name (mandatory)",
  "Supplier Asset ID",
  "Metadata Complete",
  "Status (mandatory)",
  "Usage Description",
  "Associated Documentation",
  "Image Type (mandatory)",
  "Image Mode",
  "Orientation",
  "Audio Type (mandatory)",
  "Sampling Frequency",
  "Bitrate",
  "Audio Length",
  "Video Type (mandatory)",
  "Video Length",
  "Aspect Ratio",
  "Frame Rate",
  "Bit rate (kbps)",
  "Multimedia Type (mandatory)",
  "System Requirements For Use",
  "Installation Notes",
  "Text Type (mandatory)",
  "Original Filename (read-only)",
  "Original Creator",
  "Application Version",
  "Caption",
  "Non-DAM location",
  "Main Language",
  "Additional Languages",
  "Education Level",
  "Age range (from)",
  "Age range (to)",
  "Usage Context",
  "Educational Purpose",
  "Qualification",
  "Exam Board",
  "Language Skill",
  "Language Level",
  "Language Audio Warning",
  "Region",
  "Period related",
  "Difficulty",
  "Frequency of Use",
  "User",
  "Copyright",
  "Edition",
  "Sub-Supplier Name",
  "Campaign Year",
  "First Use",
  "Dispatch Note",
  "SIM ID",
  "Cost",
  "Article ID",
  "Currency",
  "Cost Notes",
  "Date Of Gratis Order",
  "Return Original",
  "GAB Image Type",
  "Figure/Plate Number/Headword",
  "In Plate Section",
  "Box Number",
  "Table Number",
  "Anchored/non-floating",
  "Size Recommended",
  "Critical Art",
  "Online",
  "Re-draw",
  "Special Instructions",
  "Final Print Size",
  "Charge of Royalties",
  "Embargo Date From",
  "Embargo Date To"
];

// Helper to compare values ignoring scientific notation differences (e.g. 3.06228422E8 vs 306228422)
export function areValuesEqualWithSciNotation(val1: string, val2: string): boolean {
  const v1 = (val1 ?? '').toString().trim();
  const v2 = (val2 ?? '').toString().trim();

  if (v1 === v2) return true;
  if (v1.toLowerCase() === v2.toLowerCase()) return true;

  // Check if both are numeric / scientific notation values
  if (v1 !== '' && v2 !== '') {
    const n1 = Number(v1);
    const n2 = Number(v2);
    if (!isNaN(n1) && !isNaN(n2) && isFinite(n1) && isFinite(n2)) {
      if (Math.abs(n1 - n2) < 0.00001 || n1 === n2) {
        return true;
      }
    }
  }

  return false;
}

// Helper to normalize header string for comparison
export function normalizeHeaderKey(str: string): string {
  if (!str) return '';
  return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

// Find header row and build column mapping
export function findBmsHeaderRow(matrix: (string | number)[][]): BmsHeaderInfo {
  let headerRowIndex = -1;
  let thumbnailColIndex = -1;

  // 1. Search matrix for "Thumbnail" cell
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] ?? '').trim();
      if (normalizeHeaderKey(cellVal) === 'thumbnail') {
        headerRowIndex = r;
        thumbnailColIndex = c;
        break;
      }
    }
    if (headerRowIndex !== -1) break;
  }

  // Fallback: search for other primary headers if "Thumbnail" isn't explicitly found
  if (headerRowIndex === -1) {
    for (let r = 0; r < Math.min(10, matrix.length); r++) {
      const row = matrix[r];
      if (!row) continue;
      const rowText = row.map(cell => String(cell ?? '').toLowerCase()).join(' ');
      if (rowText.includes('brag status') || rowText.includes('name (mandatory)') || rowText.includes('supplier name')) {
        headerRowIndex = r;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0; // default fallback to row 0
  }

  const headerRow = matrix[headerRowIndex] || [];
  const colMap: Record<string, number> = {};
  const foundHeaders: string[] = [];

  headerRow.forEach((cell, colIdx) => {
    const headerStr = String(cell ?? '').trim();
    if (headerStr) {
      const normKey = normalizeHeaderKey(headerStr);
      colMap[normKey] = colIdx;
      foundHeaders.push(headerStr);
    }
  });

  const missingHeaders: string[] = [];
  EXPECTED_BMS_HEADERS.forEach(reqHeader => {
    const normReq = normalizeHeaderKey(reqHeader);
    if (colMap[normReq] === undefined) {
      missingHeaders.push(reqHeader);
    }
  });

  return {
    headerRowIndex,
    thumbnailColIndex,
    foundHeaders,
    missingHeaders,
    colMap,
  };
}

// Helper to extract value from a row using column map
export function getRowVal(
  row: (string | number)[],
  colMap: Record<string, number>,
  headerName: string
): string {
  const norm = normalizeHeaderKey(headerName);
  const colIdx = colMap[norm];
  if (colIdx === undefined || !row) return '';
  return String(row[colIdx] ?? '').trim();
}

// Validate an individual BMS file matrix
export function validateBmsFile(
  matrix: (string | number)[][],
  fileName: string,
  fileType: 'original' | 'final'
): BmsFileValidationResult {
  const headerInfo = findBmsHeaderRow(matrix);
  const issues: BmsIssue[] = [];
  const records: Record<string, string>[] = [];

  // Report missing mandatory structural headers
  headerInfo.missingHeaders.forEach(missingH => {
    if (missingH.includes('(mandatory)') || missingH === 'Thumbnail' || missingH === 'Original Creator') {
      issues.push({
        id: `${fileType}-hdr-missing-${missingH}`,
        fileType,
        fileName,
        field: missingH,
        severity: 'error',
        category: 'header_missing',
        message: `Missing expected column header: "${missingH}" in file sheet.`,
      });
    }
  });

  const dataRows = matrix.slice(headerInfo.headerRowIndex + 1);
  let validRowsCount = 0;

  dataRows.forEach((row, idx) => {
    // Skip totally empty rows
    const isRowEmpty = !row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
    if (isRowEmpty) return;

    const rowNumInSheet = headerInfo.headerRowIndex + 2 + idx; // 1-based index in Excel
    const rowIssuesCountBefore = issues.length;

    // Build record object
    const recordObj: Record<string, string> = {
      _excelRow: String(rowNumInSheet),
    };
    EXPECTED_BMS_HEADERS.forEach(h => {
      recordObj[h] = getRowVal(row, headerInfo.colMap, h);
    });
    records.push(recordObj);

    const assetName = recordObj['Name (mandatory)'] || recordObj['Title'] || `Row ${rowNumInSheet}`;

    // 1. Mandatory Fields Validation
    if (!recordObj['Name (mandatory)']) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-name`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Name (mandatory)',
        currentValue: '',
        severity: 'error',
        category: 'mandatory',
        message: `Name (mandatory) cannot be blank on row ${rowNumInSheet}.`,
      });
    }

    if (!recordObj['Supplier Name (mandatory)']) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-supplier`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Supplier Name (mandatory)',
        currentValue: '',
        severity: 'error',
        category: 'mandatory',
        message: `Supplier Name (mandatory) cannot be blank on row ${rowNumInSheet}.`,
      });
    }

    // Treated as mandatory per explicit requirement
    if (!recordObj['Original Creator']) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-creator`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Original Creator',
        currentValue: '',
        severity: 'error',
        category: 'mandatory',
        message: `Original Creator is required (mandatory) on row ${rowNumInSheet}.`,
      });
    }

    // Status (mandatory) -> Must be "Final"
    const statusVal = recordObj['Status (mandatory)'];
    if (!statusVal) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-status-empty`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Status (mandatory)',
        currentValue: '',
        severity: 'error',
        category: 'mandatory',
        message: `Status (mandatory) cannot be blank on row ${rowNumInSheet}. Must be "Final".`,
        expectedValue: 'Final',
      });
    } else if (statusVal.toLowerCase() !== 'final') {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-status-invalid`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Status (mandatory)',
        currentValue: statusVal,
        severity: 'error',
        category: 'type_value',
        message: `Status (mandatory) must be "Final" (found "${statusVal}").`,
        expectedValue: 'Final',
      });
    }

    // 2. Type (read-only) check
    const typeVal = recordObj['Type (read-only)'];
    const normType = typeVal.toLowerCase();

    if (!typeVal) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-type-empty`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Type (read-only)',
        currentValue: '',
        severity: 'error',
        category: 'type_value',
        message: `Type (read-only) cannot be empty. In 99.99% of cases, it must be "Image".`,
        expectedValue: 'Image',
      });
    } else if (normType === 'general') {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-type-general`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Type (read-only)',
        currentValue: typeVal,
        severity: 'error',
        category: 'type_value',
        message: `Type (read-only) can NEVER be "general". It must be "Image" (or Audio/Video/Multimedia/Text).`,
        expectedValue: 'Image',
      });
    }

    // Conditional Mandatory Media Types
    if (normType === 'image' || normType === 'img' || normType === '') {
      // In 99% cases, Type is image. Image Type (mandatory) applies!
      const imgTypeVal = recordObj['Image Type (mandatory)'];
      const normImgType = imgTypeVal.toLowerCase();
      const validImgTypes = ['photo', 'illustration', 'illustration vector'];

      if (!imgTypeVal) {
        issues.push({
          id: `${fileType}-r${rowNumInSheet}-imgtype-empty`,
          fileType,
          fileName,
          rowIndex: rowNumInSheet,
          assetName,
          field: 'Image Type (mandatory)',
          currentValue: '',
          severity: 'error',
          category: 'mandatory',
          message: `Image Type (mandatory) cannot be blank when Type is "Image".`,
          expectedValue: 'photo, illustration, or illustration vector',
        });
      } else if (!validImgTypes.includes(normImgType)) {
        issues.push({
          id: `${fileType}-r${rowNumInSheet}-imgtype-invalid`,
          fileType,
          fileName,
          rowIndex: rowNumInSheet,
          assetName,
          field: 'Image Type (mandatory)',
          currentValue: imgTypeVal,
          severity: 'error',
          category: 'type_value',
          message: `Image Type must be "photo", "illustration", or "illustration vector" (found "${imgTypeVal}").`,
          expectedValue: 'photo / illustration / illustration vector',
        });
      }
    } else if (normType === 'audio') {
      if (!recordObj['Audio Type (mandatory)']) {
        issues.push({
          id: `${fileType}-r${rowNumInSheet}-audiotype`,
          fileType,
          fileName,
          rowIndex: rowNumInSheet,
          assetName,
          field: 'Audio Type (mandatory)',
          currentValue: '',
          severity: 'error',
          category: 'mandatory',
          message: `Audio Type (mandatory) cannot be blank when Type is "Audio".`,
        });
      }
    } else if (normType === 'video') {
      if (!recordObj['Video Type (mandatory)']) {
        issues.push({
          id: `${fileType}-r${rowNumInSheet}-videotype`,
          fileType,
          fileName,
          rowIndex: rowNumInSheet,
          assetName,
          field: 'Video Type (mandatory)',
          currentValue: '',
          severity: 'error',
          category: 'mandatory',
          message: `Video Type (mandatory) cannot be blank when Type is "Video".`,
        });
      }
    } else if (normType === 'multimedia') {
      if (!recordObj['Multimedia Type (mandatory)']) {
        issues.push({
          id: `${fileType}-r${rowNumInSheet}-multimediatype`,
          fileType,
          fileName,
          rowIndex: rowNumInSheet,
          assetName,
          field: 'Multimedia Type (mandatory)',
          currentValue: '',
          severity: 'error',
          category: 'mandatory',
          message: `Multimedia Type (mandatory) cannot be blank when Type is "Multimedia".`,
        });
      }
    } else if (normType === 'text') {
      if (!recordObj['Text Type (mandatory)']) {
        issues.push({
          id: `${fileType}-r${rowNumInSheet}-texttype`,
          fileType,
          fileName,
          rowIndex: rowNumInSheet,
          assetName,
          field: 'Text Type (mandatory)',
          currentValue: '',
          severity: 'error',
          category: 'mandatory',
          message: `Text Type (mandatory) cannot be blank when Type is "Text".`,
        });
      }
    }

    // 3. BRAG Status Validation (Amber, Red, Green - NEVER Black)
    const bragVal = recordObj['BRAG Status'];
    const normBrag = bragVal.toLowerCase();
    const validBrag = ['amber', 'red', 'green'];

    if (!bragVal) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-brag-empty`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'BRAG Status',
        currentValue: '',
        severity: 'warning',
        category: 'brag_metadata',
        message: `BRAG Status is missing on row ${rowNumInSheet}. Must be Amber, Red, or Green.`,
        expectedValue: 'Amber / Red / Green',
      });
    } else if (normBrag === 'black') {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-brag-black`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'BRAG Status',
        currentValue: bragVal,
        severity: 'error',
        category: 'brag_metadata',
        message: `BRAG Status can NEVER be "Black". Allowed values are Amber, Red, or Green.`,
        expectedValue: 'Amber / Red / Green',
      });
    } else if (!validBrag.includes(normBrag)) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-brag-invalid`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'BRAG Status',
        currentValue: bragVal,
        severity: 'warning',
        category: 'brag_metadata',
        message: `BRAG Status should be Amber, Red, or Green (found "${bragVal}").`,
        expectedValue: 'Amber / Red / Green',
      });
    }

    // 4. Metadata Complete Validation (Should be true / 1 / yes)
    const metaVal = recordObj['Metadata Complete'];
    const normMeta = metaVal.toLowerCase();
    const isMetaTrue = ['true', '1', 'yes'].includes(normMeta);

    if (!isMetaTrue) {
      issues.push({
        id: `${fileType}-r${rowNumInSheet}-metacomplete`,
        fileType,
        fileName,
        rowIndex: rowNumInSheet,
        assetName,
        field: 'Metadata Complete',
        currentValue: metaVal || '(blank)',
        severity: 'warning',
        category: 'brag_metadata',
        message: `Metadata Complete should be TRUE (found "${metaVal || 'blank'}").`,
        expectedValue: 'TRUE',
      });
    }

    // 5. Title & Supplier Asset ID Rule (Must be identical, ignoring scientific notation formatting)
    const titleVal = recordObj['Title'] || '';
    const supplierAssetIdVal = recordObj['Supplier Asset ID'] || '';

    if (titleVal || supplierAssetIdVal) {
      if (!areValuesEqualWithSciNotation(titleVal, supplierAssetIdVal)) {
        issues.push({
          id: `${fileType}-r${rowNumInSheet}-title-assetid-mismatch`,
          fileType,
          fileName,
          rowIndex: rowNumInSheet,
          assetName,
          field: 'Title / Supplier Asset ID',
          currentValue: `Title: "${titleVal}" | Supplier Asset ID: "${supplierAssetIdVal}"`,
          severity: 'error',
          category: 'type_value',
          message: `Title ("${titleVal}") and Supplier Asset ID ("${supplierAssetIdVal}") must be identical on row ${rowNumInSheet}.`,
          expectedValue: titleVal || supplierAssetIdVal,
        });
      }
    }

    if (issues.length === rowIssuesCountBefore) {
      validRowsCount++;
    }
  });

  // Calculate Name column length analysis
  const nameLengthAnalysis = analyzeNameLengths(records);

  // Add issues/warnings based on file type and name length behavior
  if (fileType === 'original') {
    if (nameLengthAnalysis.isUniformLength && nameLengthAnalysis.totalCount > 0) {
      issues.push({
        id: `${fileType}-name-len-uniform-warning`,
        fileType,
        fileName,
        field: 'Name (mandatory)',
        currentValue: `Uniform LEN = ${nameLengthAnalysis.commonLength}`,
        severity: 'warning',
        category: 'type_value',
        message: `All asset names in this Original Hi-Res file have an identical character length of ${nameLengthAnalysis.commonLength}. This file is likely the Final Recoded log!`,
      });
    }
  } else if (fileType === 'final') {
    if (!nameLengthAnalysis.isUniformLength && nameLengthAnalysis.totalCount > 0) {
      issues.push({
        id: `${fileType}-name-len-varies-error`,
        fileType,
        fileName,
        field: 'Name (mandatory)',
        currentValue: `Varying lengths: ${Object.keys(nameLengthAnalysis.lengthCounts).join(', ')} chars`,
        severity: 'error',
        category: 'type_value',
        message: `Name (mandatory) column in Final Recoded log must have uniform character lengths for all asset codes. Found ${nameLengthAnalysis.outliers.length} row(s) differing from expected length of ${nameLengthAnalysis.commonLength} characters.`,
      });

      nameLengthAnalysis.outliers.forEach(outlier => {
        issues.push({
          id: `${fileType}-r${outlier.rowIndex}-name-len-outlier`,
          fileType,
          fileName,
          rowIndex: outlier.rowIndex,
          assetName: outlier.value,
          field: 'Name (mandatory)',
          currentValue: `"${outlier.value}" (LEN: ${outlier.length})`,
          severity: 'error',
          category: 'type_value',
          message: `Asset code "${outlier.value}" on row ${outlier.rowIndex} has length ${outlier.length}, which differs from expected length of ${nameLengthAnalysis.commonLength} characters.`,
          expectedValue: `Length = ${nameLengthAnalysis.commonLength}`,
        });
      });
    }
  }

  return {
    fileName,
    fileType,
    totalRows: records.length,
    validRowsCount,
    headerInfo,
    issues,
    records,
    nameLengthAnalysis,
  };
}

// Helper to analyze length distribution of values in "Name (mandatory)" column
export function analyzeNameLengths(records: Record<string, string>[]): NameLengthAnalysis {
  const validRecords = records.filter(r => (r['Name (mandatory)'] || '').trim().length > 0);
  if (validRecords.length === 0) {
    return {
      totalCount: 0,
      isUniformLength: true,
      commonLength: null,
      lengthCounts: {},
      outliers: [],
    };
  }

  const lengthCounts: Record<number, number> = {};
  validRecords.forEach(r => {
    const len = (r['Name (mandatory)'] || '').trim().length;
    lengthCounts[len] = (lengthCounts[len] || 0) + 1;
  });

  // Find most frequent length (mode)
  let commonLength: number | null = null;
  let maxCount = 0;
  Object.entries(lengthCounts).forEach(([lenStr, count]) => {
    if (count > maxCount) {
      maxCount = count;
      commonLength = Number(lenStr);
    }
  });

  const uniqueLengths = Object.keys(lengthCounts).map(Number);
  const isUniformLength = uniqueLengths.length === 1;

  const outliers: { rowIndex: number; value: string; length: number }[] = [];
  if (!isUniformLength && commonLength !== null) {
    records.forEach(r => {
      const val = (r['Name (mandatory)'] || '').trim();
      const len = val.length;
      if (len !== commonLength && val !== '') {
        outliers.push({
          rowIndex: Number(r._excelRow) || 0,
          value: val,
          length: len,
        });
      }
    });
  }

  return {
    totalCount: validRecords.length,
    isUniformLength,
    commonLength,
    lengthCounts,
    outliers,
  };
}

// Perform cross-file matching and discrepancy checks between Original Hi-Res and Final Recoded
export function performCrossValidation(
  origResult: BmsFileValidationResult,
  finalResult: BmsFileValidationResult
): BmsCrossValidationResult {
  const issues: BmsIssue[] = [];

  const origRecords = origResult.records;
  const finalRecords = finalResult.records;

  // Helper to extract a clean filename from a string or path/url
  const cleanFilename = (val: string): string => {
    if (!val) return '';
    let str = val.trim();
    if (str.includes('/') || str.includes('\\')) {
      const parts = str.split(/[/\\]/);
      str = parts[parts.length - 1];
    }
    return str.toLowerCase();
  };

  // Helper to get primary filename key for Original record
  const getOrigFilenameKey = (rec: Record<string, string>): string => {
    const readOnlyFn = rec['Original Filename (read-only)'];
    const mandatoryName = rec['Name (mandatory)'];
    return cleanFilename(readOnlyFn || mandatoryName || '');
  };

  // Helper to get primary filename key for Final record
  const getFinalFilenameKey = (rec: Record<string, string>): string => {
    const readOnlyFn = rec['Original Filename (read-only)'];
    const mandatoryName = rec['Name (mandatory)'];
    return cleanFilename(readOnlyFn || mandatoryName || '');
  };

  // Map Final records by filename key
  const finalMap = new Map<string, { rec: Record<string, string>; idx: number }[]>();
  finalRecords.forEach((rec, idx) => {
    const key = getFinalFilenameKey(rec);
    if (key) {
      if (!finalMap.has(key)) {
        finalMap.set(key, []);
      }
      finalMap.get(key)!.push({ rec, idx });
    }
  });

  const matchedOrigSet = new Set<number>();
  const matchedFinalSet = new Set<number>();
  const matchedPairs: { origRec: Record<string, string>; finalRec: Record<string, string>; origIdx: number; finalIdx: number }[] = [];

  // Pass 1: Primary match on Original Filename
  origRecords.forEach((origRec, origIdx) => {
    const origKey = getOrigFilenameKey(origRec);
    if (origKey && finalMap.has(origKey)) {
      const candidates = finalMap.get(origKey)!;
      // Pick first unassigned candidate
      const unassigned = candidates.find(c => !matchedFinalSet.has(c.idx));
      if (unassigned) {
        matchedOrigSet.add(origIdx);
        matchedFinalSet.add(unassigned.idx);
        matchedPairs.push({
          origRec,
          finalRec: unassigned.rec,
          origIdx,
          finalIdx: unassigned.idx,
        });
      }
    }
  });

  // Pass 2: Fallback match by Row Position if row counts are equal and key wasn't present
  if (origRecords.length === finalRecords.length) {
    origRecords.forEach((origRec, idx) => {
      if (!matchedOrigSet.has(idx) && !matchedFinalSet.has(idx)) {
        const finalRec = finalRecords[idx];
        matchedOrigSet.add(idx);
        matchedFinalSet.add(idx);
        matchedPairs.push({
          origRec,
          finalRec,
          origIdx: idx,
          finalIdx: idx,
        });
      }
    });
  }

  let matchedCount = matchedPairs.length;
  let unmatchedOriginalCount = 0;
  let unmatchedFinalCount = 0;
  let discrepanciesCount = 0;

  // Compare matched pairs field by field
  matchedPairs.forEach(({ origRec, finalRec }) => {
    const origRow = origRec._excelRow;
    const finalRow = finalRec._excelRow;

    // The reference asset name is the Original Filename
    const assetName =
      origRec['Original Filename (read-only)'] ||
      origRec['Name (mandatory)'] ||
      finalRec['Original Filename (read-only)'] ||
      `Row ${origRow}`;

    // 1. Check Original Filename (read-only) consistency specifically
    const origFnVal = (origRec['Original Filename (read-only)'] || origRec['Name (mandatory)'] || '').trim();
    const finalFnVal = (finalRec['Original Filename (read-only)'] || '').trim();

    if (origFnVal && finalFnVal && cleanFilename(origFnVal) !== cleanFilename(finalFnVal)) {
      discrepanciesCount++;
      issues.push({
        id: `cross-mismatch-fn-o${origRow}-f${finalRow}`,
        fileType: 'cross',
        fileName: 'Cross-File Mismatch',
        rowIndex: Number(origRow),
        origRow: `Row ${origRow}`,
        finalRow: `Row ${finalRow}`,
        excelRow: `Orig R${origRow} / Final R${finalRow}`,
        assetName,
        field: 'Original Filename (read-only)',
        origValue: origFnVal,
        finalValue: finalFnVal,
        currentValue: `Original (Row ${origRow}): "${origFnVal}" | Final (Row ${finalRow}): "${finalFnVal}"`,
        severity: 'error',
        category: 'cross_discrepancy',
        message: `Field "Original Filename (read-only)" mismatch for asset "${assetName}": Original Hi-Res (Row ${origRow}) has "${origFnVal}" but Final Recoded (Row ${finalRow}) has "${finalFnVal}".`,
        expectedValue: origFnVal,
      });
    }

    // 2. Compare all standard BMS headers except "Name (mandatory)" and "Thumbnail"
    EXPECTED_BMS_HEADERS.forEach((field) => {
      if (field === 'Name (mandatory)' || field === 'Thumbnail' || field === 'Original Filename (read-only)') return;

      const origVal = origRec[field] || '';
      const finalVal = finalRec[field] || '';

      if (!areValuesEqualWithSciNotation(origVal, finalVal)) {
        discrepanciesCount++;
        issues.push({
          id: `cross-mismatch-o${origRow}-f${finalRow}-${field}`,
          fileType: 'cross',
          fileName: 'Cross-File Mismatch',
          rowIndex: Number(origRow),
          origRow: `Row ${origRow}`,
          finalRow: `Row ${finalRow}`,
          excelRow: `Orig R${origRow} / Final R${finalRow}`,
          assetName,
          field,
          origValue: origVal,
          finalValue: finalVal,
          currentValue: `Original (Row ${origRow}): "${origVal}" | Final (Row ${finalRow}): "${finalVal}"`,
          severity: 'error',
          category: 'cross_discrepancy',
          message: `Field "${field}" mismatch for asset "${assetName}": Original Hi-Res (Row ${origRow}) has "${origVal}" but Final Recoded (Row ${finalRow}) has "${finalVal}".`,
          expectedValue: origVal,
        });
      }
    });
  });

  // Unmatched Original Records
  origRecords.forEach((origRec, idx) => {
    if (!matchedOrigSet.has(idx)) {
      unmatchedOriginalCount++;
      const origRow = origRec._excelRow;
      const assetName = origRec['Original Filename (read-only)'] || origRec['Name (mandatory)'] || `Row ${origRow}`;
      issues.push({
        id: `cross-missing-final-r${origRow}`,
        fileType: 'cross',
        fileName: 'Cross-File Check',
        rowIndex: Number(origRow),
        origRow: `Row ${origRow}`,
        finalRow: 'Not Found',
        excelRow: `Orig Row ${origRow}`,
        assetName,
        field: 'Asset Record',
        origValue: assetName,
        finalValue: 'Missing in Final',
        currentValue: `Original (Row ${origRow}): "${assetName}" | Final: Missing`,
        severity: 'warning',
        category: 'cross_discrepancy',
        message: `Asset "${assetName}" from Original Hi-Res log (Row ${origRow}) was not found in Final Recoded log.`,
      });
    }
  });

  // Unmatched Final Records
  finalRecords.forEach((finalRec, idx) => {
    if (!matchedFinalSet.has(idx)) {
      unmatchedFinalCount++;
      const finalRow = finalRec._excelRow;
      const assetName = finalRec['Original Filename (read-only)'] || finalRec['Name (mandatory)'] || `Row ${finalRow}`;
      issues.push({
        id: `cross-missing-orig-r${finalRow}`,
        fileType: 'cross',
        fileName: 'Cross-File Check',
        rowIndex: Number(finalRow),
        origRow: 'Not Found',
        finalRow: `Row ${finalRow}`,
        excelRow: `Final Row ${finalRow}`,
        assetName,
        field: 'Asset Record',
        origValue: 'Missing in Original',
        finalValue: assetName,
        currentValue: `Original: Missing | Final (Row ${finalRow}): "${assetName}"`,
        severity: 'info',
        category: 'cross_discrepancy',
        message: `Asset "${assetName}" in Final Recoded log (Row ${finalRow}) was not found in Original Hi-Res log.`,
      });
    }
  });

  return {
    totalOriginalRecords: origRecords.length,
    totalFinalRecords: finalRecords.length,
    matchedCount,
    unmatchedOriginalCount,
    unmatchedFinalCount,
    discrepanciesCount,
    issues,
  };
}
