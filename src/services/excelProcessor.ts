import type { AcknowledgementRecord, ProcessedExcelData, HeaderIndices } from '../types';
import { isIgnoredLastRow } from './dataValidator';

const findMetadata = (data: (string | number)[][]): { isbn: string | null, title: string | null } => {
  let isbn: string | null = null;
  let title: string | null = null;
  const searchDepth = 10; // Search the first 10 rows for metadata

  for (let r = 0; r < Math.min(data.length, searchDepth); r++) {
    const row = data[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length - 1; c++) {
      const cellValue = String(row[c]).toLowerCase().trim();
      const nextCellValue = String(row[c + 1]).trim();

      if (cellValue.includes('isbn') && !isbn) {
        isbn = nextCellValue;
      }
      if (cellValue.includes('title') && !title) {
        title = nextCellValue;
      }
    }
    if (isbn && title) break;
  }
  return { isbn, title };
};

const findHeaders = (data: (string | number)[][]): {
  headerRowIndex: number;
  columnIndices: HeaderIndices;
} => {
  let headerRowIndex = -1;
  let columnIndices: Partial<HeaderIndices> = {};

  const headerMap: { [key: string]: keyof HeaderIndices } = {
    'brag status': 'bragStatusColIndex',
    'bragg status': 'bragStatusColIndex',
    'usage classification': 'usageColIndex',
    'description': 'descColIndex',
    'library image no': 'imgNoColIndex',
    'library image number': 'imgNoColIndex',
    'source': 'sourceColIndex',
    'rights type': 'rightsColIndex',
    'acknowledgement': 'ackColIndex',
    'page number': 'pageColIndex',
    'photolog creation': 'photologColIndex',
    'status recleared': 'statusReclearedColIndex',
    'selections made': 'selectionsMadeColIndex',
    'licence fee': 'feeColIndex',
    'license fee': 'feeColIndex',
    'notes': 'notesColIndex',
    'jc comments': 'jcCommentsColIndex',
    'aptara comments': 'aptaraCommentsColIndex',
    'po number': 'poNumColIndex'
  };

  const requiredKeys: (keyof HeaderIndices)[] = [
    'sourceColIndex',
    'ackColIndex',
    'pageColIndex',
    'usageColIndex',
    'descColIndex',
    'imgNoColIndex',
    'rightsColIndex'
  ];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;

    const lowerCaseRow = row.map(cell =>
      typeof cell === 'string' ? cell.toLowerCase().trim().replace(/\s*\(.*\)\s*$/, '') : ''
    );
    
    const tempIndices: Partial<HeaderIndices> = {};

    for (const headerName in headerMap) {
      let index = lowerCaseRow.indexOf(headerName);
      if (index === -1) {
        index = lowerCaseRow.findIndex(cell => {
          if (!cell) return false;
          if (headerName === 'source') {
            return cell === 'source' || cell.includes('source');
          }
          if (headerName === 'notes') {
            return cell === 'notes' || cell.includes('notes');
          }
          return cell.includes(headerName);
        });
      }

      if (index !== -1) {
        const key = headerMap[headerName];
        if (tempIndices[key] === undefined) {
          tempIndices[key] = index;
        }
      }
    }

    const missingRequired = requiredKeys.filter(key => tempIndices[key] === undefined);

    if (missingRequired.length === 0) {
      headerRowIndex = i;
      columnIndices = tempIndices;
      break; 
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find a valid header row containing the required log columns (Usage Classification, Description, Library Image No, Source, Rights Type, Acknowledgement, Page Number, etc.).');
  }

  return { headerRowIndex, columnIndices: columnIndices as HeaderIndices };
};

export const processDataMatrix = (jsonData: (string | number)[][]): ProcessedExcelData => {
  const { headerRowIndex, columnIndices } = findHeaders(jsonData);
  const metadata = findMetadata(jsonData);
  
  // Find last non-empty row index
  let lastNonEmptyIdx = -1;
  for (let i = jsonData.length - 1; i > headerRowIndex; i--) {
    const row = jsonData[i];
    if (Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
      lastNonEmptyIdx = i;
      break;
    }
  }

  const sheetRecords: AcknowledgementRecord[] = [];
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!Array.isArray(row)) continue;

    // Ignore last row if at least 10 cells contain identical data
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
    throw new Error("No data rows found under the header row.");
  }

  return {
    records: sheetRecords,
    isbn: metadata.isbn,
    title: metadata.title,
    rawData: jsonData,
    headerRowIndex: headerRowIndex,
    columnIndices: columnIndices,
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
          throw new Error('The library for reading Excel files (xlsx) could not be found.');
        }

        if (!e.target?.result) {
          return reject(new Error('Failed to read file.'));
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let processedData: ProcessedExcelData | null = null;

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) continue;

          try {
            processedData = processDataMatrix(jsonData);
            break;
          } catch (error) {
            continue;
          }
        }
        
        if (processedData === null) {
          return reject(new Error('Could not find required header columns in any sheet of the Excel file.'));
        }

        resolve(processedData);
      } catch (error) {
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error('An unknown error occurred during file processing.'));
        }
      }
    };

    reader.onerror = (error) => {
      reject(new Error('File reading error: ' + error));
    };

    reader.readAsArrayBuffer(file);
  });
};
