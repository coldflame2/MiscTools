import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { HeaderIndices, AIFlaggedRecord } from '../types';
import { 
  VALIDATION_RULES, 
  getRulesForReasons, 
  getRuleIdForReason, 
  getRuleById, 
  type ValidationRuleDef 
} from '../services/validationRules';
import { comparePageValues } from '../services/dataValidator';
import { RowDetailModal } from './RowDetailModal';
import { ErrorIcon } from './icons/ErrorIcon';
import { CopyIcon } from './icons/CopyIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CloseIcon } from './icons/CloseIcon';
import { 
  Search, SlidersHorizontal, Check, FileSpreadsheet, ArrowRight, Info, AlertTriangle, 
  XCircle, ArrowUpDown, ArrowUp, ArrowDown, Pin, PinOff, WrapText, AlignLeft, 
  Maximize2, Minimize2, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Eye, EyeOff, MoveLeft, MoveRight, Settings2, Grid, CheckCheck, Ban, Copy
} from 'lucide-react';

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
const DEFAULT_VISIBLE_LETTERS = new Set(['B', 'C', 'D', 'E', 'F', 'G', 'H', 'Q']);

const DEFAULT_VISIBLE_KEYWORDS = [
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
  colWidthPreset?: 'tight' | 'normal' | 'wide' | 'fit' | 'custom';
  isWrapEnabled?: boolean;
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

interface SelectedCellState {
  rowIdx: number;
  excelRowNumber: number;
  colIdx: number;
  letter: string;
  headerName: string;
  value: string;
  reasons: string[];
  isError: boolean;
  isWarning: boolean;
}

interface SortConfig {
  colIndex: number | null;
  direction: 'asc' | 'desc' | null;
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
}

export const UploadedLogView: React.FC<UploadedLogViewProps> = ({
  rawData,
  headerRowIndex,
  dataValidationFlags = [],
  fileName,
  enabledRuleIds,
  onDisableRule,
  onDisableRules,
  onToggleRule,
  onOpenInfoPanel,
}) => {
  // Column visibility & ordering
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [colSearchQuery, setColSearchQuery] = useState('');
  
  // Saved Column Settings on initial mount
  const savedSettingsOnMount = useMemo(() => loadSavedColumnSettings(), []);

  // Custom Column Widths
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [colWidthPreset, setColWidthPreset] = useState<'tight' | 'normal' | 'wide' | 'fit' | 'custom'>(() => {
    return savedSettingsOnMount?.colWidthPreset ?? 'normal';
  });
  const [resizingCol, setResizingCol] = useState<{ index: number; startX: number; startWidth: number } | null>(null);

  // Row Wrapping & Height Customization
  const [isWrapEnabled, setIsWrapEnabled] = useState<boolean>(() => {
    return savedSettingsOnMount?.isWrapEnabled ?? false;
  });
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [zebraStriping, setZebraStriping] = useState(true);
  const [showGridlines, setShowGridlines] = useState(true);
  const [freezeFirstCol, setFreezeFirstCol] = useState(false);

  // Sorting, Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues' | 'errors' | 'warnings'>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ colIndex: null, direction: null });
  const [jumpRowInput, setJumpRowInput] = useState('');

  // Pagination
  const [pageSize, setPageSize] = useState<number | 'all'>(100);
  const [currentPage, setCurrentPage] = useState(1);

  // Active Cell & Inspector Modal
  const [selectedCell, setSelectedCell] = useState<SelectedCellState | null>(null);
  const [inspectedRowIndex, setInspectedRowIndex] = useState<number | null>(null);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Action status & toast feedback
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [cellCopyStatus, setCellCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Right-Click Context Menu State
  const [rowContextMenu, setRowContextMenu] = useState<{
    x: number;
    y: number;
    rowObj: { originalRowIndex: number; excelRowNumber: number; data: (string | number)[] };
    reasons: string[];
    rules: ValidationRuleDef[];
    isError: boolean;
    isWarning: boolean;
  } | null>(null);

  // Active Column Menu popup
  const [activeHeaderMenu, setActiveHeaderMenu] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const managerPanelRef = useRef<HTMLDivElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  // Validation map
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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3000);
  }, []);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, rowObj: { originalRowIndex: number; excelRowNumber: number; data: (string | number)[] }) => {
    e.preventDefault();
    e.stopPropagation();

    const valInfo = validationMap.get(rowObj.originalRowIndex);
    const reasons = valInfo?.reasons || [];
    const rules = getRulesForReasons(reasons);
    const isError = valInfo?.isError ?? false;
    const isWarning = valInfo?.isWarning ?? false;

    // Safety clamping coordinates
    const menuWidth = 320;
    const menuHeight = 360;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setRowContextMenu({
      x: Math.max(10, x),
      y: Math.max(10, y),
      rowObj,
      reasons,
      rules,
      isError,
      isWarning
    });
  }, [validationMap]);

  const handleDehighlightRule = useCallback((rule: ValidationRuleDef) => {
    if (onDisableRule) {
      onDisableRule(rule.id);
    } else if (onToggleRule) {
      onToggleRule(rule.id);
    }
    showToast(`De-highlighted: "${rule.name}". Red highlight removed.`);
    setRowContextMenu(null);
  }, [onDisableRule, onToggleRule, showToast]);

  const handleDehighlightAllRules = useCallback((rules: ValidationRuleDef[]) => {
    const ruleIds = rules.map(r => r.id);
    if (onDisableRules) {
      onDisableRules(ruleIds);
    } else if (onDisableRule) {
      ruleIds.forEach(id => onDisableRule(id));
    }
    showToast(`De-highlighted ${rules.length} rule type(s). Red highlights removed.`);
    setRowContextMenu(null);
  }, [onDisableRules, onDisableRule, showToast]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleGlobalClick = () => {
      if (rowContextMenu) {
        setRowContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRowContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [rowContextMenu]);

  // Compute all column metadata from rawData
  const allColumns = useMemo<ColumnMeta[]>(() => {
    if (!rawData || rawData.length === 0) return [];

    const effectiveHeaderIdx = headerRowIndex >= 0 ? headerRowIndex : 0;
    const headerRow = rawData[effectiveHeaderIdx] || [];

    let maxCols = headerRow.length;
    for (let r = effectiveHeaderIdx + 1; r < rawData.length; r++) {
      if (rawData[r] && rawData[r].length > maxCols) {
        maxCols = rawData[r].length;
      }
    }

    const columns: ColumnMeta[] = [];
    for (let c = 0; c < maxCols; c++) {
      const letter = getColumnLetter(c);
      const rawHeaderCell = headerRow[c];
      const headerName = rawHeaderCell !== undefined && rawHeaderCell !== null && String(rawHeaderCell).trim() !== ''
        ? String(rawHeaderCell).trim()
        : `Column ${letter}`;

      const isDefaultByLetter = DEFAULT_VISIBLE_LETTERS.has(letter);
      const lowerHeader = headerName.toLowerCase();
      const isDefaultByName = DEFAULT_VISIBLE_KEYWORDS.some(k => lowerHeader.includes(k));

      // Calculate non-empty cell count
      let nonEmptyCount = 0;
      for (let r = effectiveHeaderIdx + 1; r < rawData.length; r++) {
        const val = rawData[r]?.[c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          nonEmptyCount++;
        }
      }

      columns.push({
        index: c,
        letter,
        headerName,
        isDefault: isDefaultByLetter || isDefaultByName,
        nonEmptyCount
      });
    }

    return columns;
  }, [rawData, headerRowIndex]);

  // Determine visible column order using saved settings if available
  const computeColumnOrder = useCallback((columns: ColumnMeta[]): number[] => {
    const saved = loadSavedColumnSettings();
    if (!saved || (!saved.visibilityByHeader && !saved.visibilityByLetter && !saved.orderedHeaderKeys)) {
      const list: number[] = [];
      columns.forEach(col => {
        if (col.isDefault) list.push(col.index);
      });
      if (list.length === 0 && columns.length > 0) {
        columns.slice(0, 8).forEach(col => list.push(col.index));
      }
      return list;
    }

    const visibleIndices: number[] = [];
    columns.forEach(col => {
      const canonicalKey = getCanonicalHeaderKey(col.headerName);
      const normKey = normalizeHeaderKey(col.headerName);
      let isVisible: boolean | undefined = undefined;

      if (saved.visibilityByHeader && saved.visibilityByHeader[canonicalKey] !== undefined) {
        isVisible = saved.visibilityByHeader[canonicalKey];
      } else if (saved.visibilityByHeader && saved.visibilityByHeader[normKey] !== undefined) {
        isVisible = saved.visibilityByHeader[normKey];
      } else if (saved.visibilityByLetter && saved.visibilityByLetter[col.letter] !== undefined) {
        isVisible = saved.visibilityByLetter[col.letter];
      }

      if (isVisible !== undefined) {
        if (isVisible) visibleIndices.push(col.index);
      } else {
        if (col.isDefault) visibleIndices.push(col.index);
      }
    });

    if (visibleIndices.length === 0 && columns.length > 0) {
      columns.slice(0, 8).forEach(col => visibleIndices.push(col.index));
    }

    if (saved.orderedHeaderKeys && saved.orderedHeaderKeys.length > 0) {
      const orderMap = new Map<string, number>();
      saved.orderedHeaderKeys.forEach((key, idx) => orderMap.set(key, idx));

      visibleIndices.sort((a, b) => {
        const colA = columns[a];
        const colB = columns[b];
        const keyA = colA ? getCanonicalHeaderKey(colA.headerName) : '';
        const keyB = colB ? getCanonicalHeaderKey(colB.headerName) : '';
        const letterA = colA ? colA.letter : '';
        const letterB = colB ? colB.letter : '';

        const rankA = orderMap.has(keyA) ? orderMap.get(keyA)! : (orderMap.has(letterA) ? orderMap.get(letterA)! : 9999 + a);
        const rankB = orderMap.has(keyB) ? orderMap.get(keyB)! : (orderMap.has(letterB) ? orderMap.get(letterB)! : 9999 + b);
        return rankA - rankB;
      });
    }

    return visibleIndices;
  }, []);

  const computeColumnWidths = useCallback((columns: ColumnMeta[]): Record<number, number> => {
    const saved = loadSavedColumnSettings();
    if (!saved || (!saved.widthsByHeader && !saved.widthsByLetter && !saved.widthsByIndex)) {
      return {};
    }

    const widths: Record<number, number> = {};
    columns.forEach(col => {
      const canonicalKey = getCanonicalHeaderKey(col.headerName);
      const normKey = normalizeHeaderKey(col.headerName);

      if (saved.widthsByHeader && saved.widthsByHeader[canonicalKey] !== undefined) {
        widths[col.index] = saved.widthsByHeader[canonicalKey];
      } else if (saved.widthsByHeader && saved.widthsByHeader[normKey] !== undefined) {
        widths[col.index] = saved.widthsByHeader[normKey];
      } else if (saved.widthsByLetter && saved.widthsByLetter[col.letter] !== undefined) {
        widths[col.index] = saved.widthsByLetter[col.letter];
      } else if (saved.widthsByIndex && saved.widthsByIndex[col.index] !== undefined) {
        widths[col.index] = saved.widthsByIndex[col.index];
      }
    });

    return widths;
  }, []);

  // Default visible column order (for reset to default)
  const defaultColOrder = useMemo(() => {
    const list: number[] = [];
    allColumns.forEach(col => {
      if (col.isDefault) list.push(col.index);
    });
    if (list.length === 0 && allColumns.length > 0) {
      allColumns.slice(0, 8).forEach(col => list.push(col.index));
    }
    return list;
  }, [allColumns]);

  // Current visible columns in user-defined order
  const [columnOrder, setColumnOrder] = useState<number[]>(() => computeColumnOrder(allColumns));
  const isSyncingFromDataRef = useRef(false);

  // Sync when dataset changes (e.g. new file uploaded)
  useEffect(() => {
    if (!allColumns || allColumns.length === 0) return;
    isSyncingFromDataRef.current = true;

    const initialOrder = computeColumnOrder(allColumns);
    const initialWidths = computeColumnWidths(allColumns);
    const saved = loadSavedColumnSettings();

    setColumnOrder(initialOrder);
    setColumnWidths(initialWidths);
    if (saved?.colWidthPreset) {
      setColWidthPreset(saved.colWidthPreset);
    }
    if (saved?.isWrapEnabled !== undefined) {
      setIsWrapEnabled(saved.isWrapEnabled);
    }
    setSortConfig({ colIndex: null, direction: null });
    setCurrentPage(1);
    setSelectedCell(null);

    const timer = setTimeout(() => {
      isSyncingFromDataRef.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [allColumns, computeColumnOrder, computeColumnWidths]);

  // Persist column widths & visibility settings to localStorage whenever changed
  const persistCurrentSettings = useCallback((
    currentWidths: Record<number, number>,
    currentOrder: number[],
    currentCols: ColumnMeta[],
    currentPreset?: 'tight' | 'normal' | 'wide' | 'fit' | 'custom',
    currentWrap?: boolean
  ) => {
    if (!currentCols || currentCols.length === 0 || !currentOrder || currentOrder.length === 0) return;

    const existing = loadSavedColumnSettings() || {
      widthsByHeader: {},
      widthsByLetter: {},
      widthsByIndex: {},
      visibilityByHeader: {},
      visibilityByLetter: {},
      orderedHeaderKeys: []
    };

    const widthsByHeader = { ...existing.widthsByHeader };
    const widthsByLetter = { ...existing.widthsByLetter };
    const widthsByIndex = { ...existing.widthsByIndex };
    const visibilityByHeader = { ...existing.visibilityByHeader };
    const visibilityByLetter = { ...existing.visibilityByLetter };

    const visibleSet = new Set(currentOrder);

    currentCols.forEach(col => {
      const canonicalKey = getCanonicalHeaderKey(col.headerName);
      const isVisible = visibleSet.has(col.index);

      visibilityByHeader[canonicalKey] = isVisible;
      visibilityByLetter[col.letter] = isVisible;

      if (currentWidths[col.index] !== undefined) {
        widthsByHeader[canonicalKey] = currentWidths[col.index];
        widthsByLetter[col.letter] = currentWidths[col.index];
        widthsByIndex[col.index] = currentWidths[col.index];
      }
    });

    const orderedHeaderKeys = currentOrder.map(idx => {
      const col = currentCols[idx];
      return col ? getCanonicalHeaderKey(col.headerName) : '';
    }).filter(Boolean);

    saveColumnSettings({
      widthsByHeader,
      widthsByLetter,
      widthsByIndex,
      visibilityByHeader,
      visibilityByLetter,
      orderedHeaderKeys,
      colWidthPreset: currentPreset,
      isWrapEnabled: currentWrap
    });
  }, []);

  useEffect(() => {
    if (isSyncingFromDataRef.current) return;
    if (!allColumns || allColumns.length === 0 || columnOrder.length === 0) return;

    persistCurrentSettings(columnWidths, columnOrder, allColumns, colWidthPreset, isWrapEnabled);
  }, [columnWidths, columnOrder, allColumns, colWidthPreset, isWrapEnabled, persistCurrentSettings]);

  const visibleColumnSet = useMemo(() => new Set(columnOrder), [columnOrder]);

  // Extract valid data rows
  const allDataRows = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const startIdx = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
    
    const rows = [];
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

  // Filtered rows (search query + status filter)
  const filteredRows = useMemo(() => {
    let result = allDataRows;

    // Filter by issue status
    if (statusFilter !== 'all') {
      result = result.filter(rowObj => {
        const val = validationMap.get(rowObj.originalRowIndex);
        if (statusFilter === 'issues') return !!val && (val.isError || val.isWarning);
        if (statusFilter === 'errors') return !!val && val.isError;
        if (statusFilter === 'warnings') return !!val && !val.isError && val.isWarning;
        return true;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(rowObj => {
        return rowObj.data.some((cell, colIdx) => {
          if (!visibleColumnSet.has(colIdx)) return false;
          if (cell === null || cell === undefined) return false;
          return String(cell).toLowerCase().includes(query);
        });
      });
    }

    // Sort if active
    if (sortConfig.colIndex !== null && sortConfig.direction !== null) {
      const colIdx = sortConfig.colIndex;
      const dir = sortConfig.direction === 'asc' ? 1 : -1;

      result = [...result].sort((a, b) => {
        const valA = a.data[colIdx];
        const valB = b.data[colIdx];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (columnIndices?.pageColIndex !== undefined && colIdx === columnIndices.pageColIndex) {
          return comparePageValues(valA, valB) * dir;
        }

        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB)) {
          return (numA - numB) * dir;
        }

        return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }

    return result;
  }, [allDataRows, statusFilter, searchQuery, visibleColumnSet, sortConfig, validationMap]);

  // Pagination calculation
  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(filteredRows.length / pageSize));
  }, [filteredRows.length, pageSize]);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize, sortConfig]);

  // Visible column metadata list in custom order
  const orderedVisibleColumns = useMemo(() => {
    const metaMap = new Map<number, ColumnMeta>();
    allColumns.forEach(c => metaMap.set(c.index, c));
    return columnOrder.map(idx => metaMap.get(idx)).filter((c): c is ColumnMeta => !!c);
  }, [allColumns, columnOrder]);

  // Column Resizing logic
  const handleMouseDownResize = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = columnWidths[colIndex] || getDefaultColWidth(colIndex);
    setResizingCol({
      index: colIndex,
      startX: e.clientX,
      startWidth: currentWidth
    });
  };

  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      // Allow columns to be reduced down to 36px without artificial constraints!
      const newWidth = Math.max(36, Math.min(900, Math.round(resizingCol.startWidth + deltaX)));
      setColWidthPreset('custom');
      setColumnWidths(prev => ({
        ...prev,
        [resizingCol.index]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  // Default width calculation - purely based on expected data types, NOT header text length!
  const getDefaultColWidth = useCallback((colIndex: number): number => {
    const col = allColumns.find(c => c.index === colIndex);
    if (!col) return 140;
    // Standard data field sizing
    if (col.letter === 'H') return 70;  // Page Number
    if (col.letter === 'B') return 130; // Usage
    if (col.letter === 'D') return 120; // Image No
    if (col.letter === 'E') return 150; // Source
    if (col.letter === 'C') return 190; // Description
    if (col.letter === 'G') return 240; // Acknowledgements
    if (col.letter === 'Q') return 160; // Notes
    return 130; // Clean neutral width, completely free from header length
  }, [allColumns]);

  // Auto-fit column based STRICTLY on row cell data contents (ignoring header title completely)
  const calculateContentFitWidth = useCallback((colIndex: number): number => {
    let maxCharLen = 0;
    // Sample first 100 rows of data
    const sampleRows = allDataRows.slice(0, 100);
    sampleRows.forEach(r => {
      const val = r.data[colIndex];
      if (val !== undefined && val !== null) {
        const str = String(val).trim();
        if (str.length > maxCharLen) {
          maxCharLen = str.length;
        }
      }
    });

    if (maxCharLen === 0) {
      return 50; // purely enough for column letter
    }

    // Purely based on data character count:
    // e.g. 2 chars (page "12") -> 52px
    // 6 chars ("Photos") -> 82px
    // 20 chars -> 190px
    // min 45px, max 450px
    return Math.max(45, Math.min(450, Math.round(maxCharLen * 7.5 + 36)));
  }, [allDataRows]);

  // Auto-fit single column strictly to data content
  const handleAutoFitColumn = (colIndex: number) => {
    const fitWidth = calculateContentFitWidth(colIndex);
    setColumnWidths(prev => ({
      ...prev,
      [colIndex]: fitWidth
    }));
  };

  // Auto-fit all visible columns strictly to data content
  const handleAutoFitAllColumns = () => {
    const updated: Record<number, number> = {};
    orderedVisibleColumns.forEach(col => {
      updated[col.index] = calculateContentFitWidth(col.index);
    });
    setColumnWidths(updated);
  };

  // Preset Column Widths
  const handleSetGlobalWidthPreset = (width: number) => {
    const updated: Record<number, number> = {};
    orderedVisibleColumns.forEach(col => {
      updated[col.index] = width;
    });
    setColumnWidths(updated);
  };

  const handleResetWidths = () => {
    setColumnWidths({});
  };

  // Calculate strict total table width so browser does not force-stretch narrow columns
  const totalTableWidth = useMemo(() => {
    const rowNumWidth = 56;
    const colsWidth = orderedVisibleColumns.reduce((sum, col) => {
      const w = columnWidths[col.index] !== undefined ? columnWidths[col.index] : getDefaultColWidth(col.index);
      return sum + w;
    }, 0);
    return rowNumWidth + colsWidth;
  }, [orderedVisibleColumns, columnWidths, getDefaultColWidth]);

  // Column reordering
  const handleMoveColumn = (colIndex: number, direction: 'left' | 'right') => {
    setColumnOrder(prev => {
      const idx = prev.indexOf(colIndex);
      if (idx === -1) return prev;
      const nextIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;

      const nextOrder = [...prev];
      const temp = nextOrder[idx];
      nextOrder[idx] = nextOrder[nextIdx];
      nextOrder[nextIdx] = temp;
      return nextOrder;
    });
  };

  // Column visibility toggling
  const handleToggleColumn = (colIndex: number) => {
    setColumnOrder(prev => {
      if (prev.includes(colIndex)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter(idx => idx !== colIndex);
      } else {
        // Find natural position
        return [...prev, colIndex].sort((a, b) => a - b);
      }
    });
  };

  const handleSelectDefaultColumns = () => {
    setColumnOrder(defaultColOrder);
  };

  const handleSelectAllColumns = () => {
    setColumnOrder(allColumns.map(c => c.index));
  };

  const handleSelectNonEmptyColumns = () => {
    const nonEmpty = allColumns.filter(c => c.nonEmptyCount > 0).map(c => c.index);
    if (nonEmpty.length > 0) {
      setColumnOrder(nonEmpty);
    }
  };

  const handleHideColumn = (colIndex: number) => {
    if (columnOrder.length > 1) {
      setColumnOrder(prev => prev.filter(idx => idx !== colIndex));
    }
    setActiveHeaderMenu(null);
  };

  // Sorting handlers
  const handleSortColumn = (colIndex: number) => {
    setSortConfig(prev => {
      if (prev.colIndex !== colIndex) {
        return { colIndex, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { colIndex, direction: 'desc' };
      }
      return { colIndex: null, direction: null };
    });
  };

  // Row inspection
  const inspectedRow = useMemo(() => {
    if (inspectedRowIndex === null) return null;
    return allDataRows[inspectedRowIndex] ?? null;
  }, [allDataRows, inspectedRowIndex]);

  const currentDisplayIndex = useMemo(() => {
    if (inspectedRowIndex === null) return -1;
    return filteredRows.findIndex(r => r.originalRowIndex === allDataRows[inspectedRowIndex]?.originalRowIndex);
  }, [allDataRows, filteredRows, inspectedRowIndex]);

  const handleInspectRowByNumber = (excelRowNum: number) => {
    const rowIdx = allDataRows.findIndex(r => r.excelRowNumber === excelRowNum);
    if (rowIdx !== -1) {
      setInspectedRowIndex(rowIdx);
    }
  };

  // Jump to row
  const handleJumpToRow = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rowNum = parseInt(jumpRowInput.trim(), 10);
    if (isNaN(rowNum)) return;

    // Check if row is in filtered set
    const inFilteredIndex = filteredRows.findIndex(r => r.excelRowNumber === rowNum);
    if (inFilteredIndex !== -1) {
      if (pageSize !== 'all') {
        const targetPage = Math.floor(inFilteredIndex / pageSize) + 1;
        setCurrentPage(targetPage);
      }
      setTimeout(() => {
        const el = document.getElementById(`sheet-row-${rowNum}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('bg-blue-100', 'ring-2', 'ring-blue-400');
          setTimeout(() => {
            el.classList.remove('bg-blue-100', 'ring-2', 'ring-blue-400');
          }, 2000);
        }
      }, 100);
    }
  };

  // Export handlers
  const handleCopyTSV = () => {
    const headerLine = orderedVisibleColumns.map(c => `${c.letter}: ${c.headerName}`).join('\t');
    const rowLines = filteredRows.map(rObj => {
      return orderedVisibleColumns.map(c => String(rObj.data[c.index] ?? '').trim()).join('\t');
    });
    const content = [headerLine, ...rowLines].join('\n');

    navigator.clipboard.writeText(content).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleDownloadExcel = () => {
    try {
      // @ts-ignore
      const XLSX = window.XLSX;
      if (!XLSX) return;

      const headers = orderedVisibleColumns.map(c => `${c.letter}: ${c.headerName}`);
      const rows = filteredRows.map(rObj => {
        return orderedVisibleColumns.map(c => String(rObj.data[c.index] ?? '').trim());
      });

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Uploaded Sheet");

      const outName = fileName ? `Sheet_${fileName.replace(/\.[^/.]+$/, "")}.xlsx` : "Uploaded_Sheet.xlsx";
      XLSX.writeFile(workbook, outName);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const handleCopyActiveCell = () => {
    if (!selectedCell) return;
    navigator.clipboard.writeText(selectedCell.value).then(() => {
      setCellCopyStatus('copied');
      setTimeout(() => setCellCopyStatus('idle'), 2000);
    });
  };

  // Density classes for rows and cells
  const getDensityRowClasses = () => {
    if (isWrapEnabled) {
      return 'min-h-[40px] py-1.5 leading-normal';
    }
    return 'h-9 max-h-9 leading-9';
  };

  const getDensityCellClasses = () => {
    if (isWrapEnabled) {
      return 'whitespace-normal break-words py-0.5';
    }
    return 'whitespace-nowrap overflow-hidden text-ellipsis';
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small': return 'text-[11px]';
      case 'medium': return 'text-xs';
      case 'large': return 'text-[13px]';
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.header-menu-container') && activeHeaderMenu !== null) {
        setActiveHeaderMenu(null);
      }
      if (!target.closest('.view-settings-container') && isViewSettingsOpen) {
        setIsViewSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeHeaderMenu, isViewSettingsOpen]);

  // Filter columns inside manager
  const managerFilteredColumns = useMemo(() => {
    if (!colSearchQuery.trim()) return allColumns;
    const q = colSearchQuery.toLowerCase();
    return allColumns.filter(c => c.letter.toLowerCase().includes(q) || c.headerName.toLowerCase().includes(q));
  }, [allColumns, colSearchQuery]);

  return (
    <div 
      ref={containerRef}
      className={`animate-fade-in flex flex-col gap-2 flex-1 min-h-0 h-full overflow-hidden w-full ${
        isFullscreen ? 'fixed inset-0 z-50 bg-slate-100 p-4' : ''
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. TOP POWER TOOLBAR: Search, Columns, Row Height, Widths, Export, View   */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0 w-full">
        {/* Left Side: Summary & Quick Search */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <div className="p-1 bg-blue-50 text-blue-600 rounded-md">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
            </div>
            <span>
              Showing <strong className="font-bold text-slate-900 tabular-nums">{filteredRows.length}</strong> of{' '}
              <span className="text-slate-500 tabular-nums">{allDataRows.length} rows</span>
            </span>
          </div>

          {/* Quick Search Box */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in visible columns..."
              className="w-full text-xs border border-slate-300 rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-2xs placeholder:text-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                title="Clear search"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Issues / Status Filter Segments */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('issues')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'issues' ? 'bg-white text-red-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-red-700'
              }`}
              title="Filter rows with errors or warnings"
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Issues</span>
              {dataValidationFlags.length > 0 && (
                <span className="text-[10px] font-mono font-bold bg-red-100 text-red-700 px-1 rounded-full">
                  {dataValidationFlags.length}
                </span>
              )}
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Column Width Quick Buttons: Tight, Normal, Wide, Fit Data */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200" title="Customize column widths">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 select-none">Cols:</span>
            <button
              onClick={() => {
                setColWidthPreset('tight');
                handleSetGlobalWidthPreset(75);
              }}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                colWidthPreset === 'tight' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tight columns (75px width, max columns in view)"
            >
              Tight
            </button>
            <button
              onClick={() => {
                setColWidthPreset('normal');
                handleSetGlobalWidthPreset(140);
              }}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                colWidthPreset === 'normal' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Normal balanced column width (140px)"
            >
              Normal
            </button>
            <button
              onClick={() => {
                setColWidthPreset('wide');
                handleSetGlobalWidthPreset(250);
              }}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                colWidthPreset === 'wide' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Wide columns (250px)"
            >
              Wide
            </button>
            <button
              onClick={() => {
                setColWidthPreset('fit');
                handleAutoFitAllColumns();
              }}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                colWidthPreset === 'fit' ? 'bg-blue-600 text-white shadow-2xs font-semibold' : 'text-blue-700 hover:bg-blue-50'
              }`}
              title="Fit column widths strictly to row cell content (completely ignores header length)"
            >
              <SlidersHorizontal className={`w-3 h-3 ${colWidthPreset === 'fit' ? 'text-white' : 'text-blue-600'}`} />
              <span>Fit Data</span>
            </button>
          </div>

          {/* Dedicated Wrap Toggle Button */}
          <button
            onClick={() => setIsWrapEnabled(prev => !prev)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 shadow-2xs ${
              isWrapEnabled
                ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            title={isWrapEnabled ? "Wrap is ON: Click to disable text wrapping" : "Wrap is OFF: Click to enable text wrapping"}
          >
            <WrapText className="w-3.5 h-3.5" />
            <span>Wrap</span>
            {isWrapEnabled && <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />}
          </button>
        </div>

        {/* Right Side: Jump to Row, Columns, View Customizations, Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Jump to Row */}
          <form onSubmit={handleJumpToRow} className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max={rawData.length}
              value={jumpRowInput}
              onChange={(e) => setJumpRowInput(e.target.value)}
              placeholder="Row #"
              className="w-16 text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1.5 focus:ring-blue-500 bg-white shadow-2xs text-center tabular-nums"
              title="Enter Excel row number to scroll directly to it"
            />
            <button
              type="submit"
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-600 shadow-2xs transition-colors"
              title="Jump to row"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="h-4 w-px bg-slate-200" />

          {/* Column Customizer Toggle */}
          <button
            onClick={() => setIsColumnManagerOpen(!isColumnManagerOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
              isColumnManagerOpen
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            title="Open column visibility and reordering options"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Columns ({orderedVisibleColumns.length}/{allColumns.length})</span>
            <ChevronDownIcon className={`w-3 h-3 transition-transform ${isColumnManagerOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* View Options Menu (Freeze, Font size, Gridlines, Zebra) */}
          <div className="relative view-settings-container">
            <button
              onClick={() => setIsViewSettingsOpen(!isViewSettingsOpen)}
              className={`p-1.5 border rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-colors ${
                isViewSettingsOpen ? 'bg-slate-100 border-slate-400' : 'bg-white border-slate-300'
              }`}
              title="View settings: Freeze columns, font size, gridlines, auto-fit widths"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {isViewSettingsOpen && (
              <div 
                ref={settingsPanelRef}
                className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-40 text-xs animate-fade-in-fast"
              >
                <div className="font-bold text-slate-800 pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
                  <span>Display Customization</span>
                  <button 
                    onClick={() => setIsViewSettingsOpen(false)} 
                    className="text-slate-400 hover:text-slate-600"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Column Width Presets */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Column Widths</span>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={handleAutoFitAllColumns}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-left font-medium transition-colors"
                      >
                        Auto-Fit All
                      </button>
                      <button
                        onClick={handleResetWidths}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-left font-medium transition-colors"
                      >
                        Reset Widths
                      </button>
                      <button
                        onClick={() => handleSetGlobalWidthPreset(140)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-left font-medium transition-colors"
                      >
                        Compact (140px)
                      </button>
                      <button
                        onClick={() => handleSetGlobalWidthPreset(280)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-left font-medium transition-colors"
                      >
                        Wide (280px)
                      </button>
                    </div>
                  </div>

                  {/* Freeze First Column Toggle */}
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Pin className={`w-3.5 h-3.5 ${freezeFirstCol ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="font-medium text-slate-700">Freeze First Column</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={freezeFirstCol}
                      onChange={(e) => setFreezeFirstCol(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                  </label>

                  {/* Zebra Striping Toggle */}
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                    <span className="font-medium text-slate-700">Alternating Row Colors</span>
                    <input
                      type="checkbox"
                      checked={zebraStriping}
                      onChange={(e) => setZebraStriping(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                  </label>

                  {/* Gridlines Toggle */}
                  <label className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer">
                    <span className="font-medium text-slate-700">Show Full Gridlines</span>
                    <input
                      type="checkbox"
                      checked={showGridlines}
                      onChange={(e) => setShowGridlines(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                  </label>

                  {/* Font Size Selector */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1">Font Size</span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {(['small', 'medium', 'large'] as FontSize[]).map(size => (
                        <button
                          key={size}
                          onClick={() => setFontSize(size)}
                          className={`flex-1 py-1 capitalize font-medium rounded-md transition-colors ${
                            fontSize === size ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-900 shadow-2xs transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Table Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopyTSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            title="Copy visible sheet data to clipboard as TSV"
          >
            {copyStatus === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copyStatus === 'copied' ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-2xs transition-colors"
            title="Download visible columns and rows as Excel (.xlsx)"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ADVANCED COLUMN MANAGER DRAWER / PANEL: Search, Reorder, Presets        */}
      {/* ========================================================================= */}
      {isColumnManagerOpen && (
        <div ref={managerPanelRef} className="w-full bg-white border border-blue-200 rounded-xl p-3.5 shadow-sm flex-shrink-0 animate-fade-in-fast">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 mb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-900">
                Customize Visible Columns & Order
              </span>
              <span className="text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {orderedVisibleColumns.length} of {allColumns.length} visible
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Find column input */}
              <div className="relative min-w-[170px]">
                <input
                  type="text"
                  value={colSearchQuery}
                  onChange={(e) => setColSearchQuery(e.target.value)}
                  placeholder="Filter columns..."
                  className="w-full text-xs border border-slate-200 rounded-lg pl-6 pr-6 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50"
                />
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                {colSearchQuery && (
                  <button
                    onClick={() => setColSearchQuery('')}
                    className="absolute right-1.5 top-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSelectDefaultColumns}
                  className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                  title="Reset to Publishing defaults: B, C, D, E, F, G, H, Q"
                >
                  Publishing Default
                </button>
                <button
                  onClick={handleSelectNonEmptyColumns}
                  className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                  title="Show only columns that have at least 1 non-empty value"
                >
                  Non-Empty Only
                </button>
                <button
                  onClick={handleSelectAllColumns}
                  className="text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                >
                  All ({allColumns.length})
                </button>
              </div>

              <button
                onClick={() => setIsColumnManagerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                title="Close"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Columns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {managerFilteredColumns.map(col => {
              const isChecked = visibleColumnSet.has(col.index);
              const orderIdx = columnOrder.indexOf(col.index);

              return (
                <div
                  key={col.index}
                  className={`flex items-center justify-between gap-1.5 p-1.5 rounded-lg border text-xs select-none transition-all ${
                    isChecked
                      ? 'bg-blue-50/70 border-blue-300 text-blue-950 font-medium shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <label className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleColumn(col.index)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 shrink-0 cursor-pointer"
                    />
                    <span className={`font-mono font-bold text-[10px] px-1 py-0.2 rounded shrink-0 ${
                      col.isDefault ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {col.letter}
                    </span>
                    <span className="truncate text-[11px]" title={`${col.headerName} (${col.nonEmptyCount} entries)`}>
                      {col.headerName}
                    </span>
                  </label>

                  {/* Reorder arrows if column is currently visible */}
                  {isChecked && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-60 hover:opacity-100">
                      <button
                        onClick={() => handleMoveColumn(col.index, 'left')}
                        disabled={orderIdx === 0}
                        className="p-0.5 rounded hover:bg-blue-200 disabled:opacity-20 text-slate-600"
                        title="Move left"
                      >
                        <MoveLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveColumn(col.index, 'right')}
                        disabled={orderIdx === columnOrder.length - 1}
                        className="p-0.5 rounded hover:bg-blue-200 disabled:opacity-20 text-slate-600"
                        title="Move right"
                      >
                        <MoveRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Columns Strip */}
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-[80%]">
              <span className="font-semibold text-slate-600 shrink-0">Active sequence:</span>
              {orderedVisibleColumns.map((col, idx) => (
                <span
                  key={col.index}
                  className="shrink-0 bg-slate-100 text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[10px] flex items-center gap-1"
                >
                  <strong className="text-blue-700">{col.letter}</strong>: {col.headerName.slice(0, 10)}
                  {col.headerName.length > 10 ? '..' : ''}
                  <button
                    onClick={() => handleToggleColumn(col.index)}
                    className="hover:text-red-600 text-slate-400 font-bold ml-0.5"
                    title="Hide column"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleAutoFitAllColumns}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Auto-Fit Widths
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ACTIVE CELL FORMULA & VALUE INSPECTION BAR (Shown when cell clicked)   */}
      {/* ========================================================================= */}
      {selectedCell && (
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-3 text-xs shadow-2xs min-h-[36px] flex-shrink-0 w-full animate-fade-in-fast">
          <div className="flex items-center gap-2.5 w-full min-w-0">
            {/* Cell Coordinate Badge */}
            <span className="shrink-0 bg-blue-100 text-blue-900 font-mono font-bold text-[11px] px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
              <span>Row {selectedCell.excelRowNumber}</span>
              <span className="text-blue-400">:</span>
              <span>Col {selectedCell.letter}</span>
            </span>

            {/* Header Column Name */}
            <span className="shrink-0 text-slate-600 font-semibold truncate max-w-[150px]" title={selectedCell.headerName}>
              [{selectedCell.headerName}]
            </span>

            {/* Unabbreviated Value Preview */}
            <div className="flex-1 min-w-0 text-slate-900 font-medium truncate select-text" title={selectedCell.value}>
              {selectedCell.value || <span className="text-slate-300 italic">Empty cell</span>}
            </div>

            {/* Character & Word count */}
            {selectedCell.value && (
              <span className="shrink-0 text-[11px] text-slate-400 font-mono hidden md:inline">
                {selectedCell.value.length} chars
              </span>
            )}

            {/* Validation Notice */}
            {selectedCell.isError && (
              <span className="shrink-0 flex items-center gap-1 bg-red-50 text-red-700 text-[11px] font-semibold px-2 py-0.5 rounded border border-red-200">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span>Issue in row</span>
              </span>
            )}
            {!selectedCell.isError && selectedCell.isWarning && (
              <span className="shrink-0 flex items-center gap-1 bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-0.5 rounded border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Warning</span>
              </span>
            )}

            {/* Inspect Entire Row Button */}
            <button
              onClick={() => handleInspectRowByNumber(selectedCell.excelRowNumber)}
              className="shrink-0 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="Open full row details modal"
            >
              Inspect Row
            </button>

            {/* Copy Cell Value Button */}
            {selectedCell.value && (
              <button
                onClick={handleCopyActiveCell}
                className="shrink-0 text-[11px] flex items-center gap-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors cursor-pointer"
                title="Copy cell text"
              >
                {cellCopyStatus === 'copied' ? <Check className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3 text-slate-400" />}
                <span>{cellCopyStatus === 'copied' ? 'Copied' : 'Copy'}</span>
              </button>
            )}

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedCell(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded shrink-0 cursor-pointer"
              title="Clear selection"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MAIN DATA SHEET TABLE WITH RESIZABLE COLUMNS & CUSTOM HEIGHT/WRAP     */}
      {/* ========================================================================= */}
      <div className="w-full flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        <div ref={tableContainerRef} className="overflow-auto flex-1 min-h-0 w-full relative">
          <table 
            className={`border-collapse ${getFontSizeClass()} select-text ${
              showGridlines ? 'border-spacing-0' : ''
            }`}
            style={{ 
              tableLayout: 'fixed',
              width: `${totalTableWidth}px`,
              minWidth: `${totalTableWidth}px`
            }}
          >
            {/* Column Width Definitions */}
            <colgroup>
              {/* Row number column */}
              <col style={{ width: '56px', minWidth: '56px', maxWidth: '56px' }} />
              {/* Visible data columns */}
              {orderedVisibleColumns.map((col) => {
                const width = columnWidths[col.index] !== undefined ? columnWidths[col.index] : getDefaultColWidth(col.index);
                return <col key={col.index} style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }} />;
              })}
            </colgroup>

            {/* Table Header */}
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs">
              <tr className="h-9 leading-9 bg-slate-100">
                {/* Sticky Row Number Header */}
                <th
                  scope="col"
                  className="sticky left-0 z-30 w-14 px-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider border-r border-b border-slate-300 bg-slate-100 select-none shadow-xs"
                >
                  #
                </th>

                {/* Visible Column Headers */}
                {orderedVisibleColumns.map((col, idx) => {
                  const width = columnWidths[col.index] !== undefined ? columnWidths[col.index] : getDefaultColWidth(col.index);
                  const isSorted = sortConfig.colIndex === col.index;
                  const isFirstFrozen = freezeFirstCol && idx === 0;

                  // Clean header and format as: Header Name (Letter) e.g., Usage Classification (B), Source (E)
                  const cleanHeader = col.headerName.replace(new RegExp(`\\s*\\(${col.letter}\\)$`, 'i'), '').trim();
                  const headerDisplayName = `${cleanHeader} (${col.letter})`;

                  return (
                    <th
                      key={col.index}
                      scope="col"
                      className={`relative p-0 text-left font-bold text-slate-800 border-r border-b border-slate-300 bg-slate-100 select-none group transition-colors overflow-hidden ${
                        isFirstFrozen ? 'sticky left-14 z-30 shadow-md bg-slate-100 border-r-2 border-r-blue-300' : ''
                      }`}
                      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                    >
                      <div className="flex items-center justify-between gap-0.5 h-9 px-0 overflow-hidden">
                        {/* Header Label & Letter (Clickable to Sort) - zero padding to start right from the edge */}
                        <div 
                          onClick={() => handleSortColumn(col.index)}
                          className="flex items-center min-w-0 flex-1 cursor-pointer hover:text-blue-700 overflow-hidden px-0"
                          title={`${headerDisplayName} (Click to sort)`}
                        >
                          <span 
                            className="truncate font-semibold text-[11px] min-w-0 text-slate-800 hover:text-blue-700 pl-0" 
                            title={headerDisplayName}
                          >
                            {cleanHeader} <span className="font-mono text-[10px] font-bold text-slate-500">({col.letter})</span>
                          </span>

                          {/* Sort Indicator */}
                          {isSorted && (
                            <span className="shrink-0 text-blue-600 ml-0.5">
                              {sortConfig.direction === 'asc' ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )}
                            </span>
                          )}
                        </div>

                        {/* Column Header Dropdown Menu Trigger */}
                        {width >= 60 && (
                          <div className="relative header-menu-container shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveHeaderMenu(activeHeaderMenu === col.index ? null : col.index);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-opacity"
                              title="Column options"
                            >
                              <ChevronDownIcon className="w-3 h-3" />
                            </button>

                            {/* Column Context Menu */}
                            {activeHeaderMenu === col.index && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-40 text-xs font-normal">
                                <button
                                  onClick={() => {
                                    handleSortColumn(col.index);
                                    setActiveHeaderMenu(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700"
                                >
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Sort A → Z</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleAutoFitColumn(col.index);
                                    setActiveHeaderMenu(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Auto-fit to Data</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleMoveColumn(col.index, 'left');
                                    setActiveHeaderMenu(null);
                                  }}
                                  disabled={idx === 0}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 disabled:opacity-40"
                                >
                                  <MoveLeft className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Move Left</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleMoveColumn(col.index, 'right');
                                    setActiveHeaderMenu(null);
                                  }}
                                  disabled={idx === orderedVisibleColumns.length - 1}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 disabled:opacity-40"
                                >
                                  <MoveRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Move Right</span>
                                </button>
                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  onClick={() => handleHideColumn(col.index)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>Hide Column</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Interactive Drag-to-Resize Handle on Right Edge */}
                      <div
                        onMouseDown={(e) => handleMouseDownResize(e, col.index)}
                        onDoubleClick={() => handleAutoFitColumn(col.index)}
                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-blue-500/60 active:bg-blue-600 z-10 transition-colors"
                        title="Drag to resize column width without constraints (double-click to fit data)"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={orderedVisibleColumns.length + 1} className="py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-slate-300" />
                      <span>No rows match your current search or filter criteria.</span>
                      {(searchQuery || statusFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                          }}
                          className="mt-1 text-xs text-blue-600 hover:underline font-semibold"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((rowObj) => {
                  const valInfo = validationMap.get(rowObj.originalRowIndex);
                  const isError = valInfo?.isError ?? false;
                  const isWarning = valInfo?.isWarning ?? false;
                  const isFlagged = isError || isWarning;
                  const tooltipText = valInfo?.reasons
                    ? valInfo.reasons.map(r => r.replace('[WARNING] ', '').replace('[WARNING]', '')).join('\n• ')
                    : undefined;

                  let rowBg = zebraStriping
                    ? 'odd:bg-white even:bg-slate-50/50 hover:bg-blue-50/60'
                    : 'bg-white hover:bg-blue-50/60';
                  let indexBg = 'bg-slate-100/70';

                  if (isError) {
                    rowBg = 'bg-red-50/80 hover:bg-red-100/70';
                    indexBg = 'bg-red-100/90 text-red-800';
                  } else if (isWarning) {
                    rowBg = 'bg-amber-50/70 hover:bg-amber-100/70';
                    indexBg = 'bg-amber-100/80 text-amber-800';
                  }

                  const rowHeightClass = getDensityRowClasses();
                  const cellTextClass = getDensityCellClasses();

                  return (
                    <tr
                      id={`sheet-row-${rowObj.excelRowNumber}`}
                      key={rowObj.originalRowIndex}
                      onDoubleClick={() => handleInspectRowByNumber(rowObj.excelRowNumber)}
                      onContextMenu={(e) => handleRowContextMenu(e, rowObj)}
                      className={`transition-colors ${rowBg} ${rowHeightClass}`}
                    >
                      {/* Sticky Row Number Cell */}
                      <td
                        onClick={() => handleInspectRowByNumber(rowObj.excelRowNumber)}
                        onContextMenu={(e) => handleRowContextMenu(e, rowObj)}
                        className={`sticky left-0 z-10 px-2 text-center text-[11px] font-mono border-r border-b border-slate-200 select-none cursor-pointer hover:bg-blue-100/70 ${indexBg}`}
                        title={tooltipText ? `Row ${rowObj.excelRowNumber} (Click to inspect, Right-click to de-highlight):\n• ${tooltipText}` : `Row ${rowObj.excelRowNumber} (Double click to inspect, Right-click for options)`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {isError && (
                            <span className="text-red-500 shrink-0">
                              <ErrorIcon className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {!isError && isWarning && (
                            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                              !
                            </span>
                          )}
                          <span className={isFlagged ? 'font-bold' : 'text-slate-400'}>
                            {rowObj.excelRowNumber}
                          </span>
                        </div>
                      </td>

                      {/* Visible Data Cells */}
                      {orderedVisibleColumns.map((col, idx) => {
                        const width = columnWidths[col.index] !== undefined ? columnWidths[col.index] : getDefaultColWidth(col.index);
                        const cellVal = rowObj.data[col.index];
                        const displayStr = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
                        const isSelected = selectedCell?.rowIdx === rowObj.originalRowIndex && selectedCell?.colIdx === col.index;
                        const isFirstFrozen = freezeFirstCol && idx === 0;

                        return (
                          <td
                            key={col.index}
                            onClick={() => {
                              setSelectedCell({
                                rowIdx: rowObj.originalRowIndex,
                                excelRowNumber: rowObj.excelRowNumber,
                                colIdx: col.index,
                                letter: col.letter,
                                headerName: col.headerName,
                                value: displayStr,
                                reasons: valInfo?.reasons || [],
                                isError,
                                isWarning
                              });
                            }}
                            onContextMenu={(e) => handleRowContextMenu(e, rowObj)}
                            className={`px-2 py-1 text-slate-800 border-r border-b border-slate-200/80 cursor-pointer transition-colors overflow-hidden ${
                              isFirstFrozen ? 'sticky left-14 z-10 bg-inherit border-r-2 border-r-blue-300 shadow-sm' : ''
                            } ${
                              isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-100/80 font-medium' : ''
                            }`}
                            style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                            title={displayStr}
                          >
                            <div className={`${cellTextClass} overflow-hidden`}>
                              {displayStr ? (
                                searchQuery.trim() && displayStr.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                                  <span>
                                    {/* Simple highlight of query match */}
                                    {renderHighlightedText(displayStr, searchQuery)}
                                  </span>
                                ) : (
                                  displayStr
                                )
                              ) : (
                                <span className="text-slate-300 italic text-[11px] select-none">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================================================= */}
        {/* 5. BOTTOM STATUS & PAGINATION CONTROLS                                    */}
        {/* ========================================================================= */}
        <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 flex-shrink-0">
          {/* Summary */}
          <div className="flex items-center gap-3">
            <span>
              Rows <strong className="font-semibold text-slate-800 tabular-nums">
                {filteredRows.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? filteredRows.length : pageSize) + 1}
              </strong>
              {' – '}
              <strong className="font-semibold text-slate-800 tabular-nums">
                {pageSize === 'all' ? filteredRows.length : Math.min(currentPage * pageSize, filteredRows.length)}
              </strong>
              {' of '}
              <strong className="font-semibold text-slate-800 tabular-nums">{filteredRows.length}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              <strong className="font-semibold text-slate-800 tabular-nums">{orderedVisibleColumns.length}</strong> columns visible
            </span>
            {sortConfig.colIndex !== null && (
              <>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  <span>Sorted: Col {getColumnLetter(sortConfig.colIndex)} ({sortConfig.direction})</span>
                  <button 
                    onClick={() => setSortConfig({ colIndex: null, direction: null })}
                    className="hover:text-blue-900 font-bold ml-0.5"
                    title="Clear sort"
                  >
                    ×
                  </button>
                </span>
              </>
            )}
          </div>

          {/* Page size & Pagination navigation */}
          <div className="flex items-center gap-3">
            {/* Page size selector */}
            <div className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? 'all' : parseInt(val, 10));
                  setCurrentPage(1);
                }}
                className="text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* Pagination buttons */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
                  title="First page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <span className="px-2 font-mono font-medium text-slate-700 tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
                  title="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
                  title="Last page"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. RIGHT-CLICK ROW CONTEXT MENU POPUP (DE-HIGHLIGHTING RULES)              */}
      {/* ========================================================================= */}
      {rowContextMenu && (
        <div 
          className="fixed z-50 bg-white border border-slate-300 rounded-xl shadow-2xl py-1.5 w-84 text-xs animate-fade-in font-sans"
          style={{ left: `${rowContextMenu.x}px`, top: `${rowContextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800">
                Row {rowContextMenu.rowObj.excelRowNumber}
              </span>
              {rowContextMenu.rules.length > 0 ? (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  rowContextMenu.isError ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {rowContextMenu.rules.length} error {rowContextMenu.rules.length === 1 ? 'type' : 'types'}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                  No errors
                </span>
              )}
            </div>
            <button 
              onClick={() => setRowContextMenu(null)}
              className="text-slate-400 hover:text-slate-600 rounded p-0.5"
              title="Close menu"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* De-highlight / Disable Rules Section */}
          {rowContextMenu.rules.length > 0 && (
            <div className="p-2 space-y-1.5 border-b border-slate-200 bg-red-50/20">
              <div className="px-1 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Remove Red Highlight</span>
                <span className="text-slate-400 font-normal">Disables rule</span>
              </div>

              {rowContextMenu.rules.length === 1 ? (
                /* Single rule on row */
                <button
                  onClick={() => handleDehighlightRule(rowContextMenu.rules[0])}
                  className="w-full text-left p-2 rounded-lg bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors shadow-2xs group flex items-start gap-2"
                >
                  {rowContextMenu.rules[0].severity === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs text-red-900 group-hover:underline">
                        &rarr; De-highlight: {rowContextMenu.rules[0].name}
                      </span>
                      <span className="text-[9px] font-bold px-1 py-0.2 bg-red-100 text-red-700 rounded uppercase">
                        {rowContextMenu.rules[0].severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                      {rowContextMenu.rules[0].shortDesc}
                    </p>
                  </div>
                </button>
              ) : (
                /* Multiple rules on row - arrow selecting which one to de-highlight */
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-600 px-1">
                    Multiple error types found. Click an arrow below to de-highlight:
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {rowContextMenu.rules.map((rule) => (
                      <button
                        key={rule.id}
                        onClick={() => handleDehighlightRule(rule)}
                        className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50/80 transition-colors shadow-2xs group flex items-start gap-2"
                      >
                        <span className="text-blue-600 font-bold text-sm shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform">
                          &rarr;
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-red-900">
                              De-highlight: {rule.name}
                            </span>
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 uppercase ${
                              rule.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {rule.severity}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {rule.shortDesc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleDehighlightAllRules(rowContextMenu.rules)}
                    className="w-full mt-1.5 py-1.5 px-2 bg-red-100 hover:bg-red-200 text-red-900 border border-red-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <span>⚡ De-highlight all issues on this row ({rowContextMenu.rules.length})</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* General Actions */}
          <div className="py-1">
            <button
              onClick={() => {
                handleInspectRowByNumber(rowContextMenu.rowObj.excelRowNumber);
                setRowContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Inspect Row {rowContextMenu.rowObj.excelRowNumber}</span>
            </button>

            <button
              onClick={() => {
                const tsv = rowContextMenu.rowObj.data.join('\t');
                navigator.clipboard.writeText(tsv);
                showToast(`Copied Row ${rowContextMenu.rowObj.excelRowNumber} data to clipboard`);
                setRowContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700"
            >
              <CopyIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy Row Data (TSV)</span>
            </button>

            {onOpenInfoPanel && (
              <button
                onClick={() => {
                  onOpenInfoPanel();
                  setRowContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-blue-700 font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                <span>Configure Rules in Side Panel</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-3.5 py-2 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. ROW DETAIL MODAL (SIDE INSPECTOR FOR INDIVIDUAL RECORD)                 */}
      {/* ========================================================================= */}
      {inspectedRow && (
        <RowDetailModal
          isOpen={inspectedRowIndex !== null}
          onClose={() => setInspectedRowIndex(null)}
          currentRow={inspectedRow}
          columns={allColumns}
          visibleColumns={orderedVisibleColumns}
          totalRows={filteredRows.length}
          currentRowDisplayIndex={currentDisplayIndex}
          onPrevRow={() => {
            if (currentDisplayIndex > 0) {
              const prevRow = filteredRows[currentDisplayIndex - 1];
              handleInspectRowByNumber(prevRow.excelRowNumber);
            }
          }}
          onNextRow={() => {
            if (currentDisplayIndex < filteredRows.length - 1) {
              const nextRow = filteredRows[currentDisplayIndex + 1];
              handleInspectRowByNumber(nextRow.excelRowNumber);
            }
          }}
          hasPrev={currentDisplayIndex > 0}
          hasNext={currentDisplayIndex < filteredRows.length - 1}
          validationInfo={validationMap.get(inspectedRow.originalRowIndex)}
        />
      )}
    </div>
  );
};

// Helper for highlighting text match in search
const renderHighlightedText = (text: string, query: string) => {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 font-semibold px-0.5 rounded-2xs">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};
