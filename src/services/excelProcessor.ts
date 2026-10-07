import type { 
  AcknowledgementRecord, 
  ProcessedExcelData, 
  HeaderIndices, 
  HeaderDetectionMeta, 
  MatchedColumnDetail, 
  CandidateHeaderRow, 
  SheetDiagnostic, 
  FileParseDiagnostic 
} from '../types';
import { isIgnoredLastRow } from './dataValidator';

export const FIELD_LABELS: Record<keyof HeaderIndices, string> = {
  usageColIndex: 'Usage Classification',
  descColIndex: 'Description',
  imgNoColIndex: 'Library Image No',
  sourceColIndex: 'Source',
  rightsColIndex: 'Rights Type',
  ackColIndex: 'Acknowledgement',
  pageColIndex: 'Page Number',
  photologColIndex: 'Photolog Creation (£)',
  feeColIndex: 'Licence Fee (£)',
  notesColIndex: 'Notes',
  bragStatusColIndex: 'Brag Status',
  statusReclearedColIndex: 'Status Recleared',
  selectionsMadeColIndex: 'Selections Made',
  jcCommentsColIndex: 'JC Comments',
  aptaraCommentsColIndex: 'Aptara Comments',
  poNumColIndex: 'PO Number'
};

const getColLetter = (colIndex: number): string => {
  let temp = '';
  let letter = '';
  let idx = colIndex;
  while (idx >= 0) {
    temp = String.fromCharCode((idx % 26) + 65);
    letter = temp + letter;
    idx = Math.floor(idx / 26) - 1;
  }
  return letter;
};

export class ExcelProcessingError extends Error {
  diagnostic?: FileParseDiagnostic;
  constructor(message: string, diagnostic?: FileParseDiagnostic) {
    super(message);
    this.name = 'ExcelProcessingError';
    this.diagnostic = diagnostic;
  }
}

const findMetadata = (data: (string | number)[][]): { isbn: string | null, title: string | null } => {
  let isbn: string | null = null;
  let title: string | null = null;
  const searchDepth = 20; // Search the first 20 rows for metadata

  for (let r = 0; r < Math.min(data.length, searchDepth); r++) {
    const row = data[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length - 1; c++) {
      const cellValue = String(row[c] ?? '').toLowerCase().trim();
      const nextCellValue = String(row[c + 1] ?? '').trim();

      if (cellValue.includes('isbn') && !isbn && nextCellValue) {
        isbn = nextCellValue;
      }
      if ((cellValue.includes('title') || cellValue.includes('book title')) && !title && nextCellValue) {
        title = nextCellValue;
      }
    }
    if (isbn && title) break;
  }
  return { isbn, title };
};

const cleanCellText = (cell: any): string => {
  if (cell === null || cell === undefined) return '';
  return String(cell)
    .replace(/[\r\n\t\u00A0]+/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s+/g, ' ');
};

export const findHeaders = (data: (string | number)[][]): {
  headerRowIndex: number;
  columnIndices: HeaderIndices;
  headerMeta: HeaderDetectionMeta;
} => {
  const EXACT_HEADERS: { [key: string]: keyof HeaderIndices } = {
    'usage classification': 'usageColIndex',
    'description': 'descColIndex',
    'library image no': 'imgNoColIndex',
    'library image number': 'imgNoColIndex',
    'source': 'sourceColIndex',
    'rights type': 'rightsColIndex',
    'acknowledgement': 'ackColIndex',
    'acknowledgements': 'ackColIndex',
    'acknowledgment': 'ackColIndex',
    'acknowledgments': 'ackColIndex',
    'page number': 'pageColIndex',
    'photolog creation': 'photologColIndex',
    'photolog creation fee': 'photologColIndex',
    'licence fee': 'feeColIndex',
    'license fee': 'feeColIndex',
    'notes': 'notesColIndex',
    'brag status': 'bragStatusColIndex',
    'bragg status': 'bragStatusColIndex',
    'status recleared': 'statusReclearedColIndex',
    'selections made': 'selectionsMadeColIndex',
    'jc comments': 'jcCommentsColIndex',
    'aptara comments': 'aptaraCommentsColIndex',
    'po number': 'poNumColIndex'
  };

  const ALIAS_HEADERS: { [key: string]: keyof HeaderIndices } = {
    // Usage Classification
    'usage class': 'usageColIndex',
    'usage': 'usageColIndex',
    'classification': 'usageColIndex',
    'use classification': 'usageColIndex',
    'usage / license': 'usageColIndex',

    // Description
    'desc': 'descColIndex',
    'image description': 'descColIndex',
    'photo description': 'descColIndex',
    'picture description': 'descColIndex',
    'caption': 'descColIndex',
    'subject': 'descColIndex',

    // Library Image No
    'library image no.': 'imgNoColIndex',
    'library image #': 'imgNoColIndex',
    'library image': 'imgNoColIndex',
    'image no': 'imgNoColIndex',
    'image no.': 'imgNoColIndex',
    'image number': 'imgNoColIndex',
    'image #': 'imgNoColIndex',
    'library no': 'imgNoColIndex',
    'library no.': 'imgNoColIndex',
    'library #': 'imgNoColIndex',
    'asset id': 'imgNoColIndex',
    'asset no': 'imgNoColIndex',
    'asset number': 'imgNoColIndex',
    'ref no': 'imgNoColIndex',
    'ref no.': 'imgNoColIndex',
    'reference no': 'imgNoColIndex',
    'image ref': 'imgNoColIndex',

    // Source
    'source / agency': 'sourceColIndex',
    'source / vendor': 'sourceColIndex',
    'vendor': 'sourceColIndex',
    'agency': 'sourceColIndex',
    'supplier': 'sourceColIndex',
    'photo source': 'sourceColIndex',

    // Rights Type
    'right type': 'rightsColIndex',
    'rights': 'rightsColIndex',
    'rights / license': 'rightsColIndex',
    'license type': 'rightsColIndex',
    'licence type': 'rightsColIndex',
    'rights classification': 'rightsColIndex',

    // Acknowledgement
    'credit': 'ackColIndex',
    'credits': 'ackColIndex',
    'credit line': 'ackColIndex',
    'photo credit': 'ackColIndex',
    'photo credit / source': 'ackColIndex',
    'picture credit': 'ackColIndex',
    'courtesy': 'ackColIndex',
    'ack': 'ackColIndex',

    // Page Number
    'page no': 'pageColIndex',
    'page no.': 'pageColIndex',
    'page num': 'pageColIndex',
    'page number(s)': 'pageColIndex',
    'page #': 'pageColIndex',
    'pages': 'pageColIndex',
    'page': 'pageColIndex',
    'pg no': 'pageColIndex',
    'pg no.': 'pageColIndex',
    'pg #': 'pageColIndex',
    'pg': 'pageColIndex',

    // Financial & Status
    'photolog': 'photologColIndex',
    'photolog creation (£)': 'photologColIndex',
    'fee': 'feeColIndex',
    'fee (£)': 'feeColIndex',
    'license cost': 'feeColIndex',
    'licence cost': 'feeColIndex',
    'recleared': 'statusReclearedColIndex',
    're-cleared': 'statusReclearedColIndex',

    // Notes & Comments
    'note': 'notesColIndex',
    'remarks': 'notesColIndex',
    'comments': 'notesColIndex',
    'jc comment': 'jcCommentsColIndex',
    'aptara comment': 'aptaraCommentsColIndex',
    'po no': 'poNumColIndex',
    'po no.': 'poNumColIndex',
    'po #': 'poNumColIndex'
  };

  const REQUIRED_KEYS: (keyof HeaderIndices)[] = [
    'sourceColIndex',
    'ackColIndex',
    'pageColIndex',
    'usageColIndex',
    'descColIndex',
    'imgNoColIndex',
    'rightsColIndex'
  ];

  const maxScanRows = Math.min(data.length, 50);
  let bestHeaderRow = -1;
  let bestIndices: Partial<HeaderIndices> = {};
  let bestMatchedDetails: MatchedColumnDetail[] = [];
  let bestWarnings: string[] = [];
  let bestMatchScore = -1;
  let isMergedRowHeader = false;

  const candidateRowsList: CandidateHeaderRow[] = [];

  for (let i = 0; i < maxScanRows; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;

    const lowerRow = row.map(cleanCellText);
    const tempIndices: Partial<HeaderIndices> = {};
    const matchedDetails: MatchedColumnDetail[] = [];
    const warnings: string[] = [];
    let hasFuzzyMatch = false;

    // 1. Exact match pass
    for (const [exactName, key] of Object.entries(EXACT_HEADERS)) {
      if (tempIndices[key] !== undefined) continue;
      const index = lowerRow.indexOf(exactName);
      if (index !== -1) {
        tempIndices[key] = index;
        matchedDetails.push({
          field: key,
          fieldLabel: FIELD_LABELS[key] || key,
          colIndex: index,
          colLetter: getColLetter(index),
          detectedHeader: String(row[index] ?? '').trim(),
          matchType: 'exact'
        });
      }
    }

    // 2. Alias match pass
    for (const [aliasName, key] of Object.entries(ALIAS_HEADERS)) {
      if (tempIndices[key] !== undefined) continue;
      const index = lowerRow.indexOf(aliasName);
      if (index !== -1) {
        tempIndices[key] = index;
        hasFuzzyMatch = true;
        warnings.push(`Column "${FIELD_LABELS[key] || key}" matched using alias "${String(row[index] ?? '').trim()}".`);
        matchedDetails.push({
          field: key,
          fieldLabel: FIELD_LABELS[key] || key,
          colIndex: index,
          colLetter: getColLetter(index),
          detectedHeader: String(row[index] ?? '').trim(),
          matchType: 'alias'
        });
      }
    }

    // 3. Substring match pass
    for (const [aliasName, key] of Object.entries({ ...EXACT_HEADERS, ...ALIAS_HEADERS })) {
      if (tempIndices[key] !== undefined) continue;
      const index = lowerRow.findIndex(cell => cell && (cell === aliasName || cell.includes(aliasName)));
      if (index !== -1) {
        tempIndices[key] = index;
        hasFuzzyMatch = true;
        warnings.push(`Column "${FIELD_LABELS[key] || key}" matched via partial text in "${String(row[index] ?? '').trim()}".`);
        matchedDetails.push({
          field: key,
          fieldLabel: FIELD_LABELS[key] || key,
          colIndex: index,
          colLetter: getColLetter(index),
          detectedHeader: String(row[index] ?? '').trim(),
          matchType: 'substring'
        });
      }
    }

    const matchedRequiredCount = REQUIRED_KEYS.filter(key => tempIndices[key] !== undefined).length;

    // Track candidate rows
    if (matchedRequiredCount >= 3) {
      const sampleHeaders = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').map(c => String(c).trim()).slice(0, 6);
      candidateRowsList.push({
        rowIndex: i,
        matchedCount: matchedRequiredCount,
        sampleHeaders
      });
    }

    if (matchedRequiredCount > bestMatchScore) {
      bestMatchScore = matchedRequiredCount;
      bestHeaderRow = i;
      bestIndices = tempIndices;
      bestMatchedDetails = matchedDetails;
      bestWarnings = warnings;
      isMergedRowHeader = false;
    }

    // All 7 required columns found!
    if (matchedRequiredCount === REQUIRED_KEYS.length) {
      bestHeaderRow = i;
      bestIndices = tempIndices;
      bestMatchedDetails = matchedDetails;
      bestWarnings = warnings;
      isMergedRowHeader = false;
      break;
    }

    // Check if next row can be merged (2-row merged header)
    if (i < maxScanRows - 1 && Array.isArray(data[i + 1])) {
      const nextRow = data[i + 1];
      const mergedRow = row.map((cell, idx) => {
        const top = cleanCellText(cell);
        const bottom = cleanCellText(nextRow[idx]);
        if (top && bottom && top !== bottom) return `${top} ${bottom}`;
        return top || bottom;
      });

      const mergedIndices: Partial<HeaderIndices> = {};
      const mergedMatchedDetails: MatchedColumnDetail[] = [];
      const mergedWarnings: string[] = [];

      for (const [name, key] of Object.entries({ ...EXACT_HEADERS, ...ALIAS_HEADERS })) {
        if (mergedIndices[key] !== undefined) continue;
        const index = mergedRow.findIndex(cell => cell && (cell === name || cell.includes(name)));
        if (index !== -1) {
          mergedIndices[key] = index;
          const detectedStr = `${String(row[index] ?? '').trim()} ${String(nextRow[index] ?? '').trim()}`.trim();
          mergedWarnings.push(`Column "${FIELD_LABELS[key] || key}" matched from merged 2-row header: "${detectedStr}".`);
          mergedMatchedDetails.push({
            field: key,
            fieldLabel: FIELD_LABELS[key] || key,
            colIndex: index,
            colLetter: getColLetter(index),
            detectedHeader: detectedStr,
            matchType: 'merged'
          });
        }
      }

      const mergedRequiredCount = REQUIRED_KEYS.filter(key => mergedIndices[key] !== undefined).length;
      if (mergedRequiredCount === REQUIRED_KEYS.length) {
        bestHeaderRow = i + 1; // Data begins after second header row
        bestIndices = mergedIndices;
        bestMatchedDetails = mergedMatchedDetails;
        bestWarnings = mergedWarnings;
        isMergedRowHeader = true;
        break;
      }
    }
  }

  const missingRequired = REQUIRED_KEYS.filter(key => bestIndices[key] === undefined);

  if (bestHeaderRow === -1 || missingRequired.length > 0) {
    const missingNames = missingRequired.map(k => FIELD_LABELS[k] || k).join(', ');
    throw new ExcelProcessingError(
      `Could not find a complete log header row. Missing required columns: ${missingNames}.`
    );
  }

  // Determine if fuzzy/ambiguous validation warning is needed
  const alternateCandidates = candidateRowsList.filter(c => c.rowIndex !== bestHeaderRow && c.matchedCount >= 4);
  const hasFuzzyOrAliasMatches = bestMatchedDetails.some(m => m.matchType !== 'exact');
  const isFuzzyOrAmbiguous = hasFuzzyOrAliasMatches || alternateCandidates.length > 0 || isMergedRowHeader;

  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (alternateCandidates.length > 0 || isMergedRowHeader) {
    confidence = 'low';
  } else if (hasFuzzyOrAliasMatches) {
    confidence = 'medium';
  }

  const headerMeta: HeaderDetectionMeta = {
    headerRowIndex: bestHeaderRow,
    columnIndices: bestIndices as HeaderIndices,
    isFuzzyOrAmbiguous,
    confidence,
    warnings: bestWarnings,
    matchedColumns: bestMatchedDetails,
    alternateCandidateRows: alternateCandidates
  };

  return {
    headerRowIndex: bestHeaderRow,
    columnIndices: bestIndices as HeaderIndices,
    headerMeta
  };
};

export const diagnoseSheet = (jsonData: (string | number)[][], sheetName: string): SheetDiagnostic => {
  const rowCount = jsonData.length;
  const colCount = Math.max(0, ...jsonData.map(r => Array.isArray(r) ? r.length : 0));

  const REQUIRED_KEYS: (keyof HeaderIndices)[] = [
    'sourceColIndex',
    'ackColIndex',
    'pageColIndex',
    'usageColIndex',
    'descColIndex',
    'imgNoColIndex',
    'rightsColIndex'
  ];

  try {
    const { headerRowIndex, columnIndices } = findHeaders(jsonData);
    const foundHeaders = REQUIRED_KEYS.filter(k => columnIndices[k] !== undefined).map(k => `${FIELD_LABELS[k]} (Col ${getColLetter(columnIndices[k]!)})`);
    return {
      sheetName,
      rowCount,
      colCount,
      bestRowIndex: headerRowIndex,
      foundHeaders,
      missingRequiredHeaders: []
    };
  } catch (err) {
    // Scan for best partial match
    let bestRow = 0;
    let maxMatch = 0;
    let foundList: string[] = [];
    let sampleValues: string[] = [];

    const maxScan = Math.min(jsonData.length, 30);
    for (let i = 0; i < maxScan; i++) {
      const row = jsonData[i];
      if (!Array.isArray(row)) continue;
      const lowerRow = row.map(cleanCellText);
      const currentFound: string[] = [];

      REQUIRED_KEYS.forEach(k => {
        const label = FIELD_LABELS[k].toLowerCase();
        const foundIdx = lowerRow.findIndex(c => c && (c.includes(label) || label.includes(c)));
        if (foundIdx !== -1) {
          currentFound.push(`${FIELD_LABELS[k]} (Col ${getColLetter(foundIdx)})`);
        }
      });

      if (currentFound.length > maxMatch) {
        maxMatch = currentFound.length;
        bestRow = i;
        foundList = currentFound;
        sampleValues = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').map(c => String(c).trim()).slice(0, 8);
      }
    }

    const foundKeyNames = new Set(foundList.map(s => s.split(' (')[0]));
    const missingHeaders = REQUIRED_KEYS.filter(k => !foundKeyNames.has(FIELD_LABELS[k])).map(k => FIELD_LABELS[k]);

    return {
      sheetName,
      rowCount,
      colCount,
      bestRowIndex: bestRow,
      foundHeaders: foundList,
      missingRequiredHeaders: missingHeaders,
      sampleRowValues: sampleValues
    };
  }
};

export const processDataMatrix = (jsonData: (string | number)[][]): ProcessedExcelData => {
  const { headerRowIndex, columnIndices, headerMeta } = findHeaders(jsonData);
  const metadata = findMetadata(jsonData);
  
  // Find last non-empty row index
  let lastNonEmptyIdx = -1;
  for (let i = jsonData.length - 1; i > headerRowIndex; i--) {
    const row = jsonData[i];
    if (Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
      if (isIgnoredLastRow(row)) {
        continue;
      }
      lastNonEmptyIdx = i;
      break;
    }
  }

  const sheetRecords: AcknowledgementRecord[] = [];
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!Array.isArray(row)) continue;

    if (i === lastNonEmptyIdx && isIgnoredLastRow(row)) {
      continue;
    }
    
    const source = row[columnIndices.sourceColIndex];
    const acknowledgement = row[columnIndices.ackColIndex];
    const pageNumber = row[columnIndices.pageColIndex];

    const hasAnyContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');

    if (hasAnyContent) {
      sheetRecords.push({
        bragStatus: columnIndices.bragStatusColIndex !== undefined ? String(row[columnIndices.bragStatusColIndex] ?? '').trim() : '',
        source: String(source ?? '').trim(),
        acknowledgement: String(acknowledgement ?? '').trim(),
        pageNumber: String(pageNumber ?? '').trim(),
        usageClassification: String(row[columnIndices.usageColIndex] ?? '').trim(),
        licenseFee: columnIndices.feeColIndex !== undefined ? String(row[columnIndices.feeColIndex] ?? '').trim() : '',
        originalRowIndex: i,
        description: String(row[columnIndices.descColIndex] ?? '').trim(),
        libraryImageNo: String(row[columnIndices.imgNoColIndex] ?? '').trim(),
        rightsType: String(row[columnIndices.rightsColIndex] ?? '').trim(),
        photologCreation: columnIndices.photologColIndex !== undefined ? String(row[columnIndices.photologColIndex] ?? '').trim() : '',
        statusRecleared: columnIndices.statusReclearedColIndex !== undefined ? String(row[columnIndices.statusReclearedColIndex] ?? '').trim() : '',
        selectionsMade: columnIndices.selectionsMadeColIndex !== undefined ? String(row[columnIndices.selectionsMadeColIndex] ?? '').trim() : '',
        notes: columnIndices.notesColIndex !== undefined ? String(row[columnIndices.notesColIndex] ?? '').trim() : '',
        jcComments: columnIndices.jcCommentsColIndex !== undefined ? String(row[columnIndices.jcCommentsColIndex] ?? '').trim() : '',
        aptaraComments: columnIndices.aptaraCommentsColIndex !== undefined ? String(row[columnIndices.aptaraCommentsColIndex] ?? '').trim() : '',
        poNumber: columnIndices.poNumColIndex !== undefined ? String(row[columnIndices.poNumColIndex] ?? '').trim() : undefined,
      });
    }
  }

  if (sheetRecords.length === 0) {
    throw new ExcelProcessingError("No data rows found under the header row.");
  }

  return {
    records: sheetRecords,
    isbn: metadata.isbn,
    title: metadata.title,
    rawData: jsonData,
    headerRowIndex,
    columnIndices,
    headerMeta
  };
};

export const parsePastedTextToMatrix = (text: string): (string | number)[][] => {
  const lines = text.split(/\r?\n/);
  return lines.map(line => {
    if (line.includes('\t')) {
      return line.split('\t').map(cell => cell.trim());
    } else if (line.includes(',')) {
      return line.split(',').map(cell => cell.trim());
    }
    return [line.trim()];
  }).filter(row => row.some(cell => cell !== ''));
};

export const processExcelFile = (file: File): Promise<ProcessedExcelData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        // @ts-ignore
        const XLSX = window.XLSX;
        if (!XLSX) {
          throw new ExcelProcessingError('The Excel reading library (SheetJS/xlsx) could not be loaded.');
        }

        if (!e.target?.result) {
          return reject(new ExcelProcessingError('Failed to read the file buffer.'));
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          return reject(new ExcelProcessingError('The Excel workbook contains no sheet tabs.'));
        }

        let processedData: ProcessedExcelData | null = null;
        const sheetDiagnostics: SheetDiagnostic[] = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) {
            sheetDiagnostics.push({
              sheetName,
              rowCount: 0,
              colCount: 0,
              foundHeaders: [],
              missingRequiredHeaders: ['Sheet tab is completely empty']
            });
            continue;
          }

          try {
            processedData = processDataMatrix(jsonData);
            break;
          } catch (error) {
            const diag = diagnoseSheet(jsonData, sheetName);
            sheetDiagnostics.push(diag);
            continue;
          }
        }
        
        if (processedData === null) {
          const diagnostic: FileParseDiagnostic = {
            fileName: file.name,
            sheetsChecked: sheetDiagnostics,
            generalMessage: `Could not find a valid header row containing the required 7 log columns across ${workbook.SheetNames.length} sheet tab(s).`,
            suggestions: [
              'Verify that the required headers (Usage Classification, Description, Library Image No, Source, Rights Type, Acknowledgement, Page Number) exist in a single header row.',
              'Ensure headers are not broken across non-contiguous rows or hidden inside merged instruction blocks.',
              'Try copying the table rows directly and use the "Paste Raw TSV/CSV/Text" option.'
            ]
          };
          return reject(new ExcelProcessingError(diagnostic.generalMessage, diagnostic));
        }

        resolve(processedData);
      } catch (error) {
        if (error instanceof ExcelProcessingError) {
          reject(error);
        } else if (error instanceof Error) {
          reject(new ExcelProcessingError(error.message));
        } else {
          reject(new ExcelProcessingError('An unknown error occurred during file processing.'));
        }
      }
    };

    reader.onerror = (error) => {
      reject(new ExcelProcessingError('File reading error: ' + error));
    };

    reader.readAsArrayBuffer(file);
  });
};
