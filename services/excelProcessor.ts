import type { AcknowledgementRecord, ProcessedExcelData, HeaderIndices } from '../types';

const findMetadata = (data: (string | number)[][]): { isbn: string | null, title: string | null } => {
    let isbn: string | null = null;
    let title: string | null = null;
    const searchDepth = 5; // Search the first 5 rows for metadata

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
        if (isbn && title) break; // Stop searching once both are found
    }
    return { isbn, title };
};


const findHeaders = (data: (string | number)[][]): {
  headerRowIndex: number;
  columnIndices: HeaderIndices;
} => {
  let headerRowIndex = -1;
  let columnIndices: Partial<HeaderIndices> = {};

  // Map header names to keys in HeaderIndices. 
  // We prioritize 'jc comments' over 'notes' as per user request.
  const headerMap: { [key: string]: keyof HeaderIndices } = {
    'source': 'sourceColIndex',
    'acknowledgement': 'ackColIndex',
    'page number': 'pageColIndex',
    'usage classification': 'usageColIndex',
    'licence fee': 'feeColIndex',
    'description': 'descColIndex',
    'library image no': 'imgNoColIndex',
    'rights type': 'rightsColIndex',
    'photolog creation': 'photologColIndex',
    'jc comments': 'notesColIndex', // Primary
    'notes': 'notesColIndex',        // Secondary fallback
    'po number': 'poNumColIndex'
  };

  const requiredKeys: (keyof HeaderIndices)[] = [
    'sourceColIndex',
    'ackColIndex',
    'pageColIndex',
    'usageColIndex',
    'feeColIndex',
    'descColIndex',
    'imgNoColIndex',
    'rightsColIndex',
    'photologColIndex',
    'notesColIndex'
  ];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;

    const lowerCaseRow = row.map(cell =>
      typeof cell === 'string' ? cell.toLowerCase().trim().replace(/\s*\(.*\)\s*$/, '') : ''
    );
    
    const tempIndices: Partial<HeaderIndices> = {};
    
    // Track indices for jc comments and notes to resolve conflicts
    let jcCommentsIndex = -1;
    let notesIndex = -1;

    // Check all headers in the map
    // We iterate in order, but since multiple names can map to the same key,
    // we should be careful about which index we pick.
    for (const headerName in headerMap) {
        let index = lowerCaseRow.indexOf(headerName);
        
        // Relaxed substring matching if exact match fails
        if (index === -1) {
            index = lowerCaseRow.findIndex(cell => {
                if (!cell) return false;
                if (headerName === 'source') {
                    return cell === 'source' || cell.includes('source');
                }
                if (headerName === 'notes') {
                    return cell === 'notes' || cell.includes('notes') || cell.includes('comment');
                }
                return cell.includes(headerName);
            });
        }

        if (index !== -1) {
            const key = headerMap[headerName];
            
            if (headerName === 'jc comments') {
                jcCommentsIndex = index;
            } else if (headerName === 'notes') {
                notesIndex = index;
            }

            // By default, map to key. We will resolve conflict for notesColIndex below.
            if (tempIndices[key] === undefined || headerName === 'jc comments') {
                tempIndices[key] = index;
            }
        }
    }

    // Dynamic conflict resolution: if BOTH jc comments and notes columns are found,
    // choose the one that actually contains more non-empty data cells in the sheet!
    if (jcCommentsIndex !== -1 && notesIndex !== -1) {
        let jcCount = 0;
        let notesCount = 0;
        for (let r = i + 1; r < data.length; r++) {
            const dataRow = data[r];
            if (Array.isArray(dataRow)) {
                if (dataRow[jcCommentsIndex] !== undefined && dataRow[jcCommentsIndex] !== null && String(dataRow[jcCommentsIndex]).trim() !== '') {
                    jcCount++;
                }
                if (dataRow[notesIndex] !== undefined && dataRow[notesIndex] !== null && String(dataRow[notesIndex]).trim() !== '') {
                    notesCount++;
                }
            }
        }
        // If notes has more content than jc comments, prefer the notes column
        if (notesCount > jcCount) {
            tempIndices['notesColIndex'] = notesIndex;
        } else {
            tempIndices['notesColIndex'] = jcCommentsIndex;
        }
    }

    // Check if all required keys were filled
    const missingRequired = requiredKeys.filter(key => tempIndices[key] === undefined);

    if (missingRequired.length === 0) {
      headerRowIndex = i;
      columnIndices = tempIndices;
      break; 
    }
  }

  if (headerRowIndex === -1) {
    const missingCols: string[] = [];
    const mostLikelyHeaderRow = data.find(row => Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('source'))) || [];
    const lowerCaseCheckRow = mostLikelyHeaderRow.map(cell => typeof cell === 'string' ? cell.toLowerCase().trim().replace(/\s*\(.*\)\s*$/, '') : '');
    
    const requiredNames = ['source', 'acknowledgement', 'page number', 'usage classification', 'licence fee', 'description', 'library image no', 'rights type', 'photolog creation', 'notes'];
    
    for (const name of requiredNames) {
        const hasExact = lowerCaseCheckRow.includes(name);
        const hasRelaxed = lowerCaseCheckRow.some(cell => cell.includes(name));
        const isNotesOK = name === 'notes' && (
            lowerCaseCheckRow.includes('jc comments') || 
            lowerCaseCheckRow.includes('notes') || 
            lowerCaseCheckRow.some(cell => cell.includes('notes') || cell.includes('comment'))
        );
        
        if (!hasExact && !hasRelaxed && !isNotesOK) {
            missingCols.push(`"${name}"`);
        }
    }

    if (missingCols.length > 0) {
        throw new Error(`Could not find all required columns. Missing: ${missingCols.join(', ')}. Please check the Excel file headers.`);
    }
    throw new Error('Could not find a valid header row containing all required columns.');
  }

  return { headerRowIndex, columnIndices: columnIndices as HeaderIndices };
};


export const processExcelFile = (file: File): Promise<ProcessedExcelData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        // @ts-ignore
        const XLSX = window.XLSX;
        if (!XLSX) {
            throw new Error('The library for reading Excel files (xlsx) could not be found. Please check your internet connection and try again.');
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
                const { headerRowIndex, columnIndices } = findHeaders(jsonData);
                const metadata = findMetadata(jsonData);
                
                const sheetRecords: AcknowledgementRecord[] = [];
                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!Array.isArray(row)) continue;
                    
                    const source = row[columnIndices.sourceColIndex];
                    const acknowledgement = row[columnIndices.ackColIndex];

                    if (source && acknowledgement) {
                        sheetRecords.push({
                            source: String(source).trim(),
                            acknowledgement: String(acknowledgement).trim(),
                            pageNumber: String(row[columnIndices.pageColIndex] || '').trim(),
                            usageClassification: String(row[columnIndices.usageColIndex] || '').trim(),
                            licenseFee: String(row[columnIndices.feeColIndex] || '').trim(),
                            originalRowIndex: i,
                            description: String(row[columnIndices.descColIndex] || '').trim(),
                            libraryImageNo: String(row[columnIndices.imgNoColIndex] || '').trim(),
                            rightsType: String(row[columnIndices.rightsColIndex] || '').trim(),
                            photologCreation: String(row[columnIndices.photologColIndex] || '').trim(),
                            notes: String(row[columnIndices.notesColIndex] || '').trim(),
                            poNumber: columnIndices.poNumColIndex !== undefined ? String(row[columnIndices.poNumColIndex] || '').trim() : undefined,
                        });
                    }
                }
                
                processedData = {
                    records: sheetRecords,
                    isbn: metadata.isbn,
                    title: metadata.title,
                    rawData: jsonData,
                    headerRowIndex: headerRowIndex,
                    columnIndices: columnIndices,
                };
                break; // Found and processed the correct sheet, exit loop
            } catch (error) {
                // Headers not in this sheet, continue to the next
                continue;
            }
        }
        
        if (processedData === null) {
            return reject(new Error('Could not find required columns in any sheet. Please check your Excel file.'));
        }

        if (processedData.records.length === 0) {
            reject(new Error("No data rows found under the required headers."));
        } else {
            resolve(processedData);
        }

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