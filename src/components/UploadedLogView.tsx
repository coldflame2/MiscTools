import React, { useState, useMemo, useCallback } from 'react';
import type { HeaderIndices, AIFlaggedRecord } from '../types';
import type { ParentCrossAuditSummary, ParentCrossMatchResult } from '../services/parentLogMatcher';
import { RowDetailModal } from './RowDetailModal';
import { 
  AlertTriangle, Check, BookOpen, Layers
} from 'lucide-react';
import { ExcelDataGrid, type GridColumnDef, type ColumnType } from './ExcelDataGrid';

export interface ColumnMeta {
  index: number;
  letter: string;
  headerName: string;
  isDefault: boolean;
  nonEmptyCount: number;
}

export const getColumnLetter = (colIndex: number): string => {
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

// Target default column letters requested by user: B, C, D, E, F, G, H, Q
export const DEFAULT_VISIBLE_LETTERS = new Set(['B', 'C', 'D', 'E', 'F', 'G', 'H', 'Q']);

export const DEFAULT_VISIBLE_KEYWORDS = [
  'usage classification',
  'description',
  'library image no',
  'library image number',
  'source',
  'rights',
  'rights type',
  'acknowledgement',
  'acknowledgements',
  'page number',
  'notes'
];

export const STORAGE_KEY_COL_SETTINGS = 'assessment_log_column_settings_v1';

export interface SavedColumnSettings {
  widthsByHeader: Record<string, number>;
  widthsByLetter: Record<string, number>;
  widthsByIndex: Record<number, number>;
  visibilityByHeader: Record<string, boolean>;
  visibilityByLetter: Record<string, boolean>;
  orderedHeaderKeys?: string[];
  colWidthPreset?: 'best_fit' | 'tight' | 'normal' | 'wide' | 'fit' | 'custom';
  isWrapEnabled?: boolean;
  columnWrapByHeader?: Record<string, boolean>;
  columnWrapByIndex?: Record<number, boolean>;
}

export const normalizeHeaderKey = (header: string): string => {
  const clean = header.replace(/\s*\([a-z0-9]+\)$/i, '');
  return clean.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

export const getCanonicalHeaderKey = (header: string): string => {
  const norm = normalizeHeaderKey(header);
  if (norm === 'acknowledgement' || norm === 'acknowledgements') return 'acknowledgements';
  if (norm === 'pagenumber' || norm === 'page' || norm === 'pages') return 'pagenumber';
  if (norm === 'imagenumber' || norm === 'imagestatusno' || norm === 'imgno' || norm === 'imageno') return 'imageno';
  if (norm === 'sources' || norm === 'source') return 'source';
  return norm;
};

export const loadSavedColumnSettings = (): SavedColumnSettings | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COL_SETTINGS);
    if (!raw) return null;
    return JSON.parse(raw) as SavedColumnSettings;
  } catch (err) {
    console.warn('Failed to load column settings from localStorage', err);
    return null;
  }
};

export const saveColumnSettings = (settings: SavedColumnSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY_COL_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save column settings to localStorage', err);
  }
};

export type RowDensity = 'compact' | 'standard' | 'comfortable' | 'wrap';
export type FontSize = 'small' | 'medium' | 'large';

export interface LogRowItem {
  originalRowIndex: number;
  excelRowNumber: number;
  data: (string | number)[];
}

interface UploadedLogViewProps {
  rawData: (string | number)[][];
  headerRowIndex: number;
  columnIndices: HeaderIndices | null;
  dataValidationFlags?: AIFlaggedRecord[];
  fileName?: string;
  enabledRuleIds?: Set<string>;
  onDisableRule?: (ruleId: string) => void;
  onDisableRules?: (ruleIds: string[]) => void;
  onToggleRule?: (ruleId: string) => void;
  onOpenInfoPanel?: () => void;
  parentAudit?: ParentCrossAuditSummary | null;
}

export const UploadedLogView: React.FC<UploadedLogViewProps> = ({
  rawData,
  headerRowIndex,
  columnIndices,
  dataValidationFlags = [],
  fileName,
  parentAudit,
}) => {
  // Status filter state (All, Issues, Pickups, Mismatches)
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues' | 'parent_pickups' | 'parent_mismatch'>('all');

  // Inspected Row Details Modal State
  const [inspectedRowIndex, setInspectedRowIndex] = useState<number | null>(null);

  // Validation map: originalRowIndex -> details
  const validationMap = useMemo(() => {
    const map = new Map<number, { isError: boolean; isWarning: boolean; reasons: string[] }>();
    dataValidationFlags.forEach(flag => {
      const reasons = flag.reason ? flag.reason.split('|||') : [];
      const hasErrors = reasons.some(r => !r.startsWith('[WARNING]'));
      const hasWarnings = reasons.some(r => r.startsWith('[WARNING]'));
      map.set(flag.originalRowIndex, {
        isError: hasErrors,
        isWarning: hasWarnings,
        reasons
      });
    });
    return map;
  }, [dataValidationFlags]);

  // Parent audit lookup map by child originalRowIndex
  const parentAuditResultMap = useMemo(() => {
    const map = new Map<number, ParentCrossMatchResult>();
    if (parentAudit && parentAudit.results) {
      parentAudit.results.forEach(res => {
        map.set(res.childRowIndex, res);
      });
    }
    return map;
  }, [parentAudit]);

  // Extract all columns metadata from header row
  const allColumns = useMemo<ColumnMeta[]>(() => {
    if (!rawData || rawData.length === 0 || headerRowIndex < 0 || headerRowIndex >= rawData.length) {
      return [];
    }

    const headerRow = rawData[headerRowIndex] || [];
    const maxCols = Math.max(
      headerRow.length,
      ...rawData.slice(headerRowIndex + 1, headerRowIndex + 50).map(r => r.length)
    );

    const cols: ColumnMeta[] = [];

    for (let c = 0; c < maxCols; c++) {
      const letter = getColumnLetter(c);
      const rawHeaderName = headerRow[c] !== undefined && headerRow[c] !== null ? String(headerRow[c]).trim() : '';
      const headerName = rawHeaderName || `Column ${letter}`;

      // Calculate non-empty cell count
      let nonEmpty = 0;
      for (let r = headerRowIndex + 1; r < rawData.length; r++) {
        const val = rawData[r]?.[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          nonEmpty++;
        }
      }

      const norm = normalizeHeaderKey(headerName);
      const isDefault = DEFAULT_VISIBLE_LETTERS.has(letter) || DEFAULT_VISIBLE_KEYWORDS.some(kw => norm.includes(kw));

      cols.push({
        index: c,
        letter,
        headerName,
        isDefault,
        nonEmptyCount: nonEmpty
      });
    }

    return cols;
  }, [rawData, headerRowIndex]);

  // Extract all valid data rows
  const allDataRows = useMemo<LogRowItem[]>(() => {
    if (!rawData || rawData.length === 0) return [];
    const startIdx = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    
    const rows: LogRowItem[] = [];
    for (let i = startIdx; i < rawData.length; i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
      if (hasContent) {
        rows.push({
          originalRowIndex: i,
          excelRowNumber: i + 1,
          data: row
        });
      }
    }
    return rows;
  }, [rawData, headerRowIndex]);

  // Apply Status Filter to rows
  const displayedRows = useMemo(() => {
    if (statusFilter === 'all') return allDataRows;

    return allDataRows.filter(rowObj => {
      const val = validationMap.get(rowObj.originalRowIndex);
      const pMatch = parentAuditResultMap.get(rowObj.originalRowIndex);

      if (statusFilter === 'issues') {
        return !!val && (val.isError || val.isWarning);
      }
      if (statusFilter === 'parent_pickups') {
        return !!pMatch;
      }
      if (statusFilter === 'parent_mismatch') {
        return !!pMatch && (!pMatch.isVerified || pMatch.matchConfidence === 'unmatched');
      }
      return true;
    });
  }, [allDataRows, statusFilter, validationMap, parentAuditResultMap]);

  // Build the single column definition config array
  // (id, header, type, default width, min width, pinned, hidden)
  const gridColumns = useMemo<GridColumnDef<LogRowItem>[]>(() => {
    return allColumns.map(col => {
      const norm = normalizeHeaderKey(col.headerName);
      const letter = col.letter;

      // Determine column type: 'id' for asset/image numbers, 'number' for page numbers, 'text' otherwise
      let type: ColumnType = 'text';
      if (
        norm.includes('imageno') ||
        norm.includes('image no') ||
        norm.includes('image id') ||
        norm.includes('library image') ||
        norm.includes('asset id') ||
        norm.includes('id') ||
        letter === 'D'
      ) {
        type = 'id';
      } else if (
        norm.includes('page') ||
        norm.includes('number') ||
        norm.includes('qty') ||
        norm.includes('count') ||
        letter === 'G'
      ) {
        type = 'number';
      }

      // Best Fit default widths requested:
      // Usage classification: width to fit Pick-Up/No License (~170px)
      // Description to fit 20 characters (~180px)
      // Library image ID to fit 10 digits (~120px)
      // Source to fit up to: Alamy Stock (~130px)
      // Rights Type to fit up to 'RFe' with two more spaces (~85px)
      // Acknowledgement to fit 25 characters (~210px)
      // Page number to fit up to : 7 characters (~75px)
      // Notes: stick to right edge / stretch (~240px)
      let defaultWidth = 140;
      if (letter === 'B' || norm.includes('usage') || norm.includes('classification')) {
        defaultWidth = 170;
      } else if (letter === 'C' || norm.includes('desc') || norm.includes('description')) {
        defaultWidth = 180;
      } else if (letter === 'D' || norm.includes('image') || norm.includes('asset') || norm.includes('library')) {
        defaultWidth = 120;
      } else if (letter === 'E' || norm.includes('source') || norm.includes('vendor')) {
        defaultWidth = 130;
      } else if (letter === 'F' || norm.includes('right') || norm.includes('license')) {
        defaultWidth = 85;
      } else if (letter === 'G' || norm.includes('page')) {
        defaultWidth = 75;
      } else if (letter === 'H' || norm.includes('ack') || norm.includes('credit') || norm.includes('acknowledgement')) {
        defaultWidth = 210;
      } else if (letter === 'Q' || norm.includes('note') || norm.includes('comment')) {
        defaultWidth = 240;
      }

      return {
        id: `col_${col.index}`,
        header: `${col.headerName} (${letter})`,
        type,
        defaultWidth,
        minWidth: 40,
        hidden: !col.isDefault,
        accessorFn: (row: LogRowItem) => {
          const val = row.data[col.index];
          return val !== null && val !== undefined ? String(val) : '';
        },
        cell: ({ row, value, isWrapped }) => {
          const strVal = String(value ?? '');
          const valInfo = validationMap.get(row.originalRowIndex);
          const pMatch = parentAuditResultMap.get(row.originalRowIndex);

          // If this is column B or C, or if it has an issue, show status icon indicator
          const isFirstCol = col.letter === 'B' || col.index === 1;

          return (
            <div className="flex items-center gap-1.5 w-full min-w-0">
              {/* Status Indicator Icon for issues / parent verification */}
              {isFirstCol && (valInfo?.isError || valInfo?.isWarning || pMatch) && (
                <div className="shrink-0 flex items-center">
                  {valInfo?.isError ? (
                    <span 
                      className="w-2 h-2 rounded-full bg-red-500 shrink-0" 
                      title={valInfo.reasons.join('\n')}
                    />
                  ) : valInfo?.isWarning ? (
                    <span 
                      className="w-2 h-2 rounded-full bg-amber-500 shrink-0" 
                      title={valInfo.reasons.join('\n')}
                    />
                  ) : pMatch?.isVerified ? (
                    <span 
                      className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" 
                      title={`Verified with parent log: ${pMatch.parentTitleName}`}
                    />
                  ) : pMatch ? (
                    <span 
                      className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" 
                      title={`Pickup from parent log: ${pMatch.parentTitleName}`}
                    />
                  ) : null}
                </div>
              )}

              <span className={isWrapped ? "whitespace-normal break-words leading-tight py-1 flex-1" : "truncate flex-1"} title={strVal}>
                {strVal || <span className="text-slate-300">-</span>}
              </span>
            </div>
          );
        }
      };
    });
  }, [allColumns, validationMap, parentAuditResultMap]);

  // Current inspected row object for detail modal
  const inspectedRowObj = useMemo(() => {
    if (inspectedRowIndex === null) return null;
    return allDataRows.find(r => r.originalRowIndex === inspectedRowIndex) || null;
  }, [inspectedRowIndex, allDataRows]);

  const inspectedDisplayIndex = useMemo(() => {
    if (inspectedRowIndex === null) return -1;
    return allDataRows.findIndex(r => r.originalRowIndex === inspectedRowIndex);
  }, [inspectedRowIndex, allDataRows]);

  const handlePrevRow = useCallback(() => {
    if (inspectedDisplayIndex > 0) {
      setInspectedRowIndex(allDataRows[inspectedDisplayIndex - 1].originalRowIndex);
    }
  }, [inspectedDisplayIndex, allDataRows]);

  const handleNextRow = useCallback(() => {
    if (inspectedDisplayIndex < allDataRows.length - 1) {
      setInspectedRowIndex(allDataRows[inspectedDisplayIndex + 1].originalRowIndex);
    }
  }, [inspectedDisplayIndex, allDataRows]);

  // Extra Toolbar Actions: Segmented status filter tabs
  const extraToolbarActions = (
    <div className="flex items-center gap-1 bg-slate-100/90 rounded-md p-0.5 border border-slate-200 text-[11px]">
      <button
        onClick={() => setStatusFilter('all')}
        className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
          statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        All ({allDataRows.length})
      </button>

      {dataValidationFlags.length > 0 && (
        <button
          onClick={() => setStatusFilter('issues')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
            statusFilter === 'issues' ? 'bg-white text-red-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-red-700'
          }`}
          title="Filter rows with errors or warnings"
        >
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span>Issues ({dataValidationFlags.length})</span>
        </button>
      )}

      {parentAudit && parentAudit.pickupRowsCount > 0 && (
        <button
          onClick={() => setStatusFilter('parent_pickups')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
            statusFilter === 'parent_pickups' ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-indigo-700'
          }`}
          title="Filter to rows sourced from parent titles"
        >
          <BookOpen className="w-3 h-3 text-indigo-500" />
          <span>Pickups ({parentAudit.pickupRowsCount})</span>
        </button>
      )}

      {parentAudit && parentAudit.discrepanciesCount > 0 && (
        <button
          onClick={() => setStatusFilter('parent_mismatch')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
            statusFilter === 'parent_mismatch' ? 'bg-white text-amber-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-amber-700'
          }`}
          title="Filter to parent pickup rows with metadata discrepancies"
        >
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>Mismatches ({parentAudit.discrepanciesCount})</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50">
      {/* Excel Data Grid Component */}
      <ExcelDataGrid<LogRowItem>
        tableId="uploaded-log-grid"
        data={displayedRows}
        columns={gridColumns}
        loading={false}
        error={null}
        emptyMessage="No rows in uploaded log"
        getRowId={(row) => row.originalRowIndex}
        getRowNumber={(row) => row.excelRowNumber}
        onRowDoubleClick={(row) => {
          setInspectedRowIndex(row.originalRowIndex);
        }}
        extraToolbarActions={extraToolbarActions}
        showRowNumbers={true}
      />

      {/* Row Detail Inspector Modal */}
      {inspectedRowObj && (
        <RowDetailModal
          isOpen={inspectedRowIndex !== null}
          onClose={() => setInspectedRowIndex(null)}
          currentRow={inspectedRowObj}
          columns={allColumns}
          visibleColumns={allColumns.filter(c => c.isDefault)}
          totalRows={allDataRows.length}
          currentRowDisplayIndex={inspectedDisplayIndex}
          onPrevRow={handlePrevRow}
          onNextRow={handleNextRow}
          hasPrev={inspectedDisplayIndex > 0}
          hasNext={inspectedDisplayIndex < allDataRows.length - 1}
          validationInfo={validationMap.get(inspectedRowObj.originalRowIndex)}
          parentMatchResult={parentAuditResultMap.get(inspectedRowObj.originalRowIndex)}
        />
      )}
    </div>
  );
};
