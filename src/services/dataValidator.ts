import type { AIFlaggedRecord, HeaderIndices } from '../types';

const normalizeText = (text: string): string => {
    // Treat hyphens, slashes as word separators and ignore case.
    return (text || '').toLowerCase().replace(/[-/]/g, ' ');
};

/**
 * Validates records based on a set of concrete rules.
 * @param rawData - The raw data array from the Excel sheet.
 * @param headerRowIndex - The index of the header row.
 * @param columnIndices - An object mapping column names to their indices.
 * @returns An array of flagged records with reasons for the flag.
 */
export const validateData = (
    rawData: (string | number)[][],
    headerRowIndex: number,
    columnIndices: HeaderIndices
): AIFlaggedRecord[] => {
    // Use a temporary type for the map to hold the array of reasons
    type TempFlaggedRecord = AIFlaggedRecord & { reasons: string[] };
    const recordsMap = new Map<number, TempFlaggedRecord>();
    const REASON_SEPARATOR = '|||';

    const getOrCreateFlaggedRecord = (rowIndex: number): TempFlaggedRecord => {
        if (recordsMap.has(rowIndex)) {
            return recordsMap.get(rowIndex)!;
        }
        const row = rawData[rowIndex];
        const record: TempFlaggedRecord = {
            source: String(row[columnIndices.sourceColIndex] || '').trim(),
            acknowledgement: String(row[columnIndices.ackColIndex] || '').trim(),
            pageNumber: String(row[columnIndices.pageColIndex] || '').trim(),
            usageClassification: String(row[columnIndices.usageColIndex] || '').trim(),
            licenseFee: String(row[columnIndices.feeColIndex] || '').trim(),
            originalRowIndex: rowIndex,
            reason: '', // Will be populated at the end
            reasons: [],
        };
        recordsMap.set(rowIndex, record);
        return record;
    };

    // Find the last row that is considered a valid entry.
    let lastDataRowIndex = -1;
    for (let i = rawData.length - 1; i > headerRowIndex; i--) {
        const row = rawData[i];
        if (Array.isArray(row)) {
            const sourceCell = row[columnIndices.sourceColIndex];
            const ackCell = row[columnIndices.ackColIndex];

            const source = (sourceCell === null || sourceCell === undefined) ? '' : String(sourceCell).trim();
            const acknowledgement = (ackCell === null || ackCell === undefined) ? '' : String(ackCell).trim();

            const hasSource = source !== '' && source !== '.';
            const hasAck = acknowledgement !== '' && acknowledgement !== '.';

            if (hasSource && hasAck) {
                lastDataRowIndex = i;
                break;
            }
        }
    }

    if (lastDataRowIndex === -1) {
        return [];
    }

    // --- ROW-BY-ROW VALIDATION ---
    for (let i = headerRowIndex + 1; i <= lastDataRowIndex; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        const source = String(row[columnIndices.sourceColIndex] || '').trim();
        const rightsType = String(row[columnIndices.rightsColIndex] || '').trim().toUpperCase();
        
        // This index points to 'Notes' or 'JC Comments' depending on what was found in headers.
        const notes = String(row[columnIndices.notesColIndex] || '').trim().toLowerCase();
        
        const licenseFeeValue = row[columnIndices.feeColIndex];
        const licenseFeeStr = (licenseFeeValue === null || licenseFeeValue === undefined) ? '' : String(licenseFeeValue).trim();
        
        const licenseFee = parseFloat(licenseFeeStr);
        const usageClassification = String(row[columnIndices.usageColIndex] || '').trim();
        const normalizedUsage = normalizeText(usageClassification);
        const sourceLower = source.toLowerCase();
        
        // Key definitions
        const hasNoLicense = normalizedUsage.includes('no license');
        const isLicensed = normalizedUsage.includes('license') && !hasNoLicense;

        // --- License-Dependent Fee Validation ---
        if (hasNoLicense) {
            // Simplify: fee column has to be empty if 'usage classification' contains "No License"
            if (licenseFeeStr !== '') {
                getOrCreateFlaggedRecord(i).reasons.push(`For No License usage, Licence Fee must be blank, but is "${licenseFeeStr}".`);
            }
        } else if (isLicensed) {
            // Apply rules for licensed usage
            if (sourceLower === 'shutterstock') {
                if (rightsType === 'RF' && licenseFee !== 10) {
                    getOrCreateFlaggedRecord(i).reasons.push(`For Shutterstock/RF, fee must be 10, but is "${licenseFeeStr}".`);
                } else if (rightsType === 'RM' && licenseFee !== 40) {
                    getOrCreateFlaggedRecord(i).reasons.push(`For Shutterstock/RM, fee must be 40, but is "${licenseFeeStr}".`);
                }
            } else if (sourceLower === 'getty images') {
                if (rightsType === 'RF' && licenseFee !== 17.5) {
                    getOrCreateFlaggedRecord(i).reasons.push(`For Getty Images/RF, fee must be 17.5, but is "${licenseFeeStr}".`);
                } else if (rightsType === 'RM' && licenseFee !== 40) {
                    getOrCreateFlaggedRecord(i).reasons.push(`For Getty Images/RM, fee must be 40, but is "${licenseFeeStr}".`);
                }
            } else if (sourceLower === 'alamy') {
                if (licenseFeeStr !== '' && ![0, 29, 45].includes(licenseFee)) {
                    getOrCreateFlaggedRecord(i).reasons.push(`For Alamy, licensed fee must be 0, 29, or 45, but is "${licenseFeeStr}".`);
                }
            } else if (sourceLower === 'oup') {
                getOrCreateFlaggedRecord(i).reasons.push(`For OUP, Usage must not contain "License", but is "${usageClassification}".`);
            } else {
                if (licenseFeeStr === '' || isNaN(licenseFee) || licenseFee <= 0) {
                    getOrCreateFlaggedRecord(i).reasons.push(`Usage is licensed but Licence Fee ("${licenseFeeStr || 'empty'}") is not a positive number.`);
                }
            }
        } else { 
            // Neither "No License" nor "License" found explicitly or other state
            if (licenseFeeStr !== '') {
                getOrCreateFlaggedRecord(i).reasons.push(`Usage is not specified as Licensed or No License, but Licence Fee is not empty ("${licenseFeeStr}").`);
            }
        }
        
        if (sourceLower === 'oup') {
            if (rightsType !== 'RF') {
                getOrCreateFlaggedRecord(i).reasons.push(`For OUP, Rights Type must be "RF", but is "${rightsType}".`);
            }
        }

        const columnsToAssertNotEmpty = [
            { name: 'Usage Classification', index: columnIndices.usageColIndex },
            { name: 'Description', index: columnIndices.descColIndex },
            { name: 'Library Image no', index: columnIndices.imgNoColIndex },
            { name: 'Source', index: columnIndices.sourceColIndex },
            { name: 'Rights type', index: columnIndices.rightsColIndex },
            { name: 'Acknowledgement', index: columnIndices.ackColIndex },
            { name: 'Page number', index: columnIndices.pageColIndex },
            { name: 'Photolog creation', index: columnIndices.photologColIndex },
        ];

        const emptyColumns: string[] = [];
        columnsToAssertNotEmpty.forEach(col => {
            if (col.index === undefined) return;
            const cellValue = row[col.index];
            if (cellValue === null || cellValue === undefined || String(cellValue).trim() === '') {
                emptyColumns.push(col.name);
            }
        });

        if (emptyColumns.length > 0) {
            getOrCreateFlaggedRecord(i).reasons.push(`Required column${emptyColumns.length > 1 ? 's' : ''} empty: ${emptyColumns.join(', ')}.`);
        }
        
        if (columnIndices.poNumColIndex !== undefined) {
            if (isLicensed) {
                const poNumber = row[columnIndices.poNumColIndex];
                if (poNumber === null || poNumber === undefined || String(poNumber).trim() === '') {
                    getOrCreateFlaggedRecord(i).reasons.push(`Usage is "${usageClassification}" but PO Number is empty.`);
                }
            }
        }
    }
    
    // --- GLOBAL VALIDATION (REUSE PAIRING) ---
    const imageNoGroups = new Map<string, number[]>();
    for (let i = headerRowIndex + 1; i <= lastDataRowIndex; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        const imageNo = String(row[columnIndices.imgNoColIndex] || '').trim();
        if (imageNo) {
            if (!imageNoGroups.has(imageNo)) {
                imageNoGroups.set(imageNo, []);
            }
            imageNoGroups.get(imageNo)!.push(i);
        }
    }

    for (const [imageNo, rowIndices] of imageNoGroups.entries()) {
        if (rowIndices.length === 1) continue;

        const rowNumbers = rowIndices.map(rowIndex => rowIndex + 1).join(', ');
        const pageNumbers = rowIndices.map(rowIndex => String(rawData[rowIndex][columnIndices.pageColIndex] || 'N/A').trim()).join(', ');

        if (rowIndices.length > 2) {
            const reason = `Image Used Too Many Times: '${imageNo}' appears ${rowIndices.length} times on rows ${rowNumbers} (pages: ${pageNumbers}). An image number should appear exactly twice for a reuse pair.`;
            for (const rowIndex of rowIndices) {
                getOrCreateFlaggedRecord(rowIndex).reasons.push(reason);
            }
            continue;
        }

        const [indexA, indexB] = rowIndices;
        const notesA = String(rawData[indexA][columnIndices.notesColIndex] || '').trim().toLowerCase();
        const notesB = String(rawData[indexB][columnIndices.notesColIndex] || '').trim().toLowerCase();
        const isAReuse = notesA.includes('reuse');
        const isBReuse = notesB.includes('reuse');
        
        let mainRowIndex: number | null = null;
        let reuseRowIndex: number | null = null;
        
        if (isAReuse && !isBReuse) {
            mainRowIndex = indexB;
            reuseRowIndex = indexA;
        } else if (!isAReuse && isBReuse) {
            mainRowIndex = indexA;
            reuseRowIndex = indexB;
        } else {
            const roleError = isAReuse && isBReuse 
                ? `Ambiguous Pair (Conflicted): Image No "${imageNo}" (rows ${rowNumbers}) has 'reuse' in Notes for both entries. Only one is allowed.`
                : `Ambiguous Pair (Missing Role): Image No "${imageNo}" (rows ${rowNumbers}) is missing a 'reuse' entry in Notes for one of the entries.`;
            
            getOrCreateFlaggedRecord(indexA).reasons.push(roleError);
            getOrCreateFlaggedRecord(indexB).reasons.push(roleError);
            continue;
        }
        
        const mainRow = rawData[mainRowIndex];
        const reuseRow = rawData[reuseRowIndex];
        const pairErrors: string[] = [];

        if (String(mainRow[columnIndices.descColIndex]).trim() !== String(reuseRow[columnIndices.descColIndex]).trim()) pairErrors.push("Inconsistent Description.");
        if (String(mainRow[columnIndices.sourceColIndex]).trim() !== String(reuseRow[columnIndices.sourceColIndex]).trim()) pairErrors.push("Inconsistent Source.");
        if (String(mainRow[columnIndices.rightsColIndex]).trim() !== String(reuseRow[columnIndices.rightsColIndex]).trim()) pairErrors.push("Inconsistent Rights Type.");
        
        if (pairErrors.length > 0) {
            const combinedReason = `Inconsistent Pair Data for Image No "${imageNo}": ${pairErrors.join(' ')}`;
            getOrCreateFlaggedRecord(mainRowIndex).reasons.push(combinedReason);
            getOrCreateFlaggedRecord(reuseRowIndex).reasons.push(combinedReason);
        }

        const mainUsage = String(mainRow[columnIndices.usageColIndex] || '').trim();
        const reuseUsage = String(reuseRow[columnIndices.usageColIndex] || '').trim();
        const normalizedMainUsage = normalizeText(mainUsage);
        const normalizedReuseUsage = normalizeText(reuseUsage);

        if (((normalizedMainUsage.includes('new')) && !normalizedReuseUsage.includes('new')) || 
            ((normalizedMainUsage.includes('pickup') || normalizedMainUsage.includes('pick up')) && !(normalizedReuseUsage.includes('pickup') || normalizedReuseUsage.includes('pick up')))) {
            const statusError = `Inconsistent Pair Status: Mismatching 'New'/'Pickup' status between main entry and reuse entry.`;
            getOrCreateFlaggedRecord(mainRowIndex).reasons.push(statusError);
            getOrCreateFlaggedRecord(reuseRowIndex).reasons.push(statusError);
        }

        if (normalizedReuseUsage.includes('license') && !normalizedReuseUsage.includes('no license')) {
            getOrCreateFlaggedRecord(reuseRowIndex).reasons.push(`Malformed Reuse Entry: The reuse entry must have a non-licensed Usage.`);
        }

        // Reuse entry fee logic follows the "No License" rule
        const reuseFeeStr = String(reuseRow[columnIndices.feeColIndex] || '').trim();
        if (normalizedReuseUsage.includes('no license')) {
            if (reuseFeeStr !== '') {
                getOrCreateFlaggedRecord(reuseRowIndex).reasons.push(`Malformed Reuse Entry: For No License usage, Licence Fee must be blank, but is "${reuseFeeStr}".`);
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