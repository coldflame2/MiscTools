import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { HeaderIndices, AIFlaggedRecord } from '../types';
import { ErrorIcon } from './icons/ErrorIcon';
import { CopyIcon } from './icons/CopyIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CloseIcon } from './icons/CloseIcon';
import { EditIcon } from './icons/EditIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { Globe, Plus, Trash2, Check, Cloud, Save } from 'lucide-react';

interface UploadedLogViewProps {
  rawData: (string | number)[][];
  headerRowIndex: number;
  columnIndices: HeaderIndices | null;
  dataValidationFlags?: AIFlaggedRecord[];
  fileName?: string;
  sourceUrl?: string | null;
  unsavedChangesCount?: number;
  lastSyncedAt?: string | null;
  onRawDataChange?: (newRawData: (string | number)[][]) => void;
  onOpenSyncModal?: () => void;
}

export interface ColumnMeta {
  index: number;
  letter: string;
  headerName: string;
  isDefault: boolean;
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

// Default header keywords fallback
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

export const UploadedLogView: React.FC<UploadedLogViewProps> = ({
  rawData,
  headerRowIndex,
  columnIndices,
  dataValidationFlags = [],
  fileName,
  sourceUrl,
  unsavedChangesCount = 0,
  lastSyncedAt,
  onRawDataChange,
  onOpenSyncModal
}) => {
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const selectorRef = useRef<HTMLDivElement>(null);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsColumnSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute column metadata for all columns in rawData
  const allColumns = useMemo<ColumnMeta[]>(() => {
    if (!rawData || rawData.length === 0) return [];

    const effectiveHeaderIdx = headerRowIndex >= 0 ? headerRowIndex : 0;
    const headerRow = rawData[effectiveHeaderIdx] || [];

    // Determine max columns across header and data rows
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

      columns.push({
        index: c,
        letter,
        headerName,
        isDefault: isDefaultByLetter || isDefaultByName
      });
    }

    return columns;
  }, [rawData, headerRowIndex]);

  // Initial default visible column indices
  const defaultColIndices = useMemo(() => {
    const set = new Set<number>();
    allColumns.forEach(col => {
      if (col.isDefault) set.add(col.index);
    });
    // Fallback: if no defaults match, enable first 8 columns
    if (set.size === 0 && allColumns.length > 0) {
      allColumns.slice(0, 8).forEach(col => set.add(col.index));
    }
    return set;
  }, [allColumns]);

  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(() => new Set(defaultColIndices));

  // Reset to default columns whenever new file is loaded
  useEffect(() => {
    setVisibleIndices(new Set(defaultColIndices));
  }, [defaultColIndices]);

  // Map validation flags by originalRowIndex
  const validationMap = useMemo(() => {
    const map = new Map<number, string>();
    dataValidationFlags.forEach(flag => {
      map.set(flag.originalRowIndex, flag.reason);
    });
    return map;
  }, [dataValidationFlags]);

  // Extract data rows (preserving exact uploaded order)
  const dataRows = useMemo(() => {
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

  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return dataRows;
    const query = searchQuery.toLowerCase();
    return dataRows.filter(rowObj => {
      return rowObj.data.some((cell, colIdx) => {
        if (!visibleIndices.has(colIdx)) return false;
        if (cell === null || cell === undefined) return false;
        return String(cell).toLowerCase().includes(query);
      });
    });
  }, [dataRows, searchQuery, visibleIndices]);

  const visibleColumnsList = useMemo(() => {
    return allColumns.filter(col => visibleIndices.has(col.index));
  }, [allColumns, visibleIndices]);

  // Column toggle handlers
  const toggleColumn = (colIndex: number) => {
    setVisibleIndices(prev => {
      const next = new Set(prev);
      if (next.has(colIndex)) {
        if (next.size > 1) { // keep at least 1 column
          next.delete(colIndex);
        }
      } else {
        next.add(colIndex);
      }
      return next;
    });
  };

  const handleSelectDefault = () => {
    setVisibleIndices(new Set(defaultColIndices));
  };

  const handleSelectAll = () => {
    const all = new Set<number>();
    allColumns.forEach(c => all.add(c.index));
    setVisibleIndices(all);
  };

  const handleDeselectAll = () => {
    if (allColumns.length > 0) {
      setVisibleIndices(new Set([allColumns[0].index]));
    }
  };

  // --- CELL EDITING LOGIC ---
  const handleStartCellEdit = (originalRowIndex: number, colIndex: number, currentVal: any) => {
    setEditingCell({ rowIndex: originalRowIndex, colIndex });
    setEditValue(currentVal !== undefined && currentVal !== null ? String(currentVal) : '');
  };

  const handleSaveCellEdit = () => {
    if (!editingCell || !onRawDataChange) {
      setEditingCell(null);
      return;
    }

    const { rowIndex, colIndex } = editingCell;
    const updatedRaw = rawData.map((rowArr, rIdx) => {
      if (rIdx === rowIndex) {
        const newRow = [...rowArr];
        // Ensure array length covers colIndex
        while (newRow.length <= colIndex) {
          newRow.push('');
        }
        newRow[colIndex] = editValue;
        return newRow;
      }
      return rowArr;
    });

    onRawDataChange(updatedRaw);
    setEditingCell(null);
  };

  const handleKeyDownEdit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveCellEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // --- ROW ADDITION & DELETION LOGIC ---
  const handleAddRow = () => {
    if (!onRawDataChange) return;
    const maxCols = allColumns.length || 20;
    const newEmptyRow = new Array(maxCols).fill('');
    const updatedRaw = [...rawData, newEmptyRow];
    onRawDataChange(updatedRaw);

    // Start editing first visible cell of new row
    const newRowIdx = updatedRaw.length - 1;
    const firstColIdx = visibleColumnsList.length > 0 ? visibleColumnsList[0].index : 0;
    handleStartCellEdit(newRowIdx, firstColIdx, '');
  };

  const handleDeleteRow = (originalRowIndex: number) => {
    if (!onRawDataChange) return;
    if (window.confirm(`Are you sure you want to delete row #${originalRowIndex + 1}?`)) {
      const updatedRaw = rawData.filter((_, idx) => idx !== originalRowIndex);
      onRawDataChange(updatedRaw);
    }
  };

  // Copy visible data as TSV
  const handleCopyTSV = () => {
    const headerLine = visibleColumnsList.map(c => `${c.letter}: ${c.headerName}`).join('\t');
    const rowLines = filteredRows.map(rObj => {
      return visibleColumnsList.map(c => String(rObj.data[c.index] ?? '').trim()).join('\t');
    });
    const content = [headerLine, ...rowLines].join('\n');

    navigator.clipboard.writeText(content).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // Download visible data as Excel
  const handleDownloadExcel = () => {
    try {
      // @ts-ignore
      const XLSX = window.XLSX;
      if (!XLSX) return;

      const headers = visibleColumnsList.map(c => `${c.letter}: ${c.headerName}`);
      const rows = filteredRows.map(rObj => {
        return visibleColumnsList.map(c => String(rObj.data[c.index] ?? '').trim());
      });

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Uploaded Log");

      const outName = fileName ? `Uploaded_Log_${fileName.replace(/\.[^/.]+$/, "")}.xlsx` : "Uploaded_Log_Original_Order.xlsx";
      XLSX.writeFile(workbook, outName);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      {/* Sync Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/30 text-blue-400 p-2.5 rounded-xl border border-blue-500/30">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                Uploaded Log Editor & Online Sync
              </h2>
              {unsavedChangesCount > 0 ? (
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  {unsavedChangesCount} Unsaved Local Edit(s)
                </span>
              ) : (
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Synced with Online Source
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Double-click any cell to edit &bull; Edits sync across all views (Credits Creator &amp; Contact Sheets) &bull; Export Excel or Copy TSV to save back to Excel Online
            </p>
          </div>
        </div>

        {/* Sync & Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenSyncModal && (
            <button
              onClick={onOpenSyncModal}
              className={`flex items-center gap-2 px-3.5 py-2 font-bold text-xs rounded-xl shadow-md transition-all ${
                unsavedChangesCount > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              <RefreshIcon className="w-4 h-4" />
              <span>{unsavedChangesCount > 0 ? 'Sync Changes to Online File' : 'Sync Manager'}</span>
            </button>
          )}

          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
            title="Add a new row to the original log"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Top Controls Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredRows.length}</strong> of <strong className="text-slate-800">{dataRows.length}</strong> rows
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search uploaded rows..."
              className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Column Visibility Selector Dropdown */}
          <div className="relative" ref={selectorRef}>
            <button
              onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span>Columns ({visibleIndices.size}/{allColumns.length})</span>
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isColumnSelectorOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Selector Popover */}
            {isColumnSelectorOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-3 animate-fade-in-fast">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Customize Visible Columns</span>
                  <button
                    onClick={() => setIsColumnSelectorOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Selection Presets */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <button
                    onClick={handleSelectDefault}
                    className="text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                    title="Shows B, C, D, E, F, G, H, Q"
                  >
                    Default (B,C,D,E,F,G,H,Q)
                  </button>
                  <button
                    onClick={handleSelectAll}
                    className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                  >
                    Reset
                  </button>
                </div>

                {/* Column Checkboxes List */}
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 text-xs">
                  {allColumns.map(col => {
                    const isChecked = visibleIndices.has(col.index);
                    return (
                      <label
                        key={col.index}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${isChecked ? 'bg-blue-50 text-slate-900' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumn(col.index)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${col.isDefault ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                            {col.letter}
                          </span>
                          <span className="truncate text-xs font-medium" title={col.headerName}>
                            {col.headerName}
                          </span>
                        </div>
                        {col.isDefault && (
                          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider flex-shrink-0">
                            Default
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyTSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-sm transition-colors"
            title="Copy visible columns to clipboard"
          >
            <CopyIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>{copyStatus === 'copied' ? 'Copied!' : 'Copy TSV'}</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm transition-colors"
            title="Download visible columns as Excel"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="w-full bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
              <tr>
                {/* Row Number Column */}
                <th scope="col" className="w-12 px-2 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 bg-slate-100">
                  #
                </th>

                {/* Visible Dynamic Columns */}
                {visibleColumnsList.map(col => {
                  return (
                    <th
                      key={col.index}
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap bg-slate-100"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-bold">
                          {col.letter}
                        </span>
                        <span>{col.headerName}</span>
                      </div>
                    </th>
                  );
                })}

                {/* Actions Column */}
                <th scope="col" className="w-12 px-2 py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnsList.length + 2} className="py-8 text-center text-slate-500">
                    No rows match your search filter or visible columns.
                  </td>
                </tr>
              ) : (
                filteredRows.map((rowObj) => {
                  const validationReason = validationMap.get(rowObj.originalRowIndex);
                  const isFlagged = !!validationReason;

                  return (
                    <tr
                      key={rowObj.originalRowIndex}
                      className={`transition-colors align-top ${
                        isFlagged ? 'bg-red-50/70 hover:bg-red-100/70' : 'odd:bg-white even:bg-slate-50/50 hover:bg-blue-50/60'
                      }`}
                    >
                      {/* Row Index Cell */}
                      <td className="px-2 py-2 text-center text-[11px] font-mono text-slate-400 border-r border-slate-200 whitespace-nowrap bg-slate-50/50">
                        <div className="flex items-center justify-center gap-1">
                          {isFlagged && (
                            <span title={validationReason} className="text-red-500">
                              <ErrorIcon className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span>{rowObj.excelRowNumber}</span>
                        </div>
                      </td>

                      {/* Data Cells */}
                      {visibleColumnsList.map(col => {
                        const cellVal = rowObj.data[col.index];
                        const displayStr = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';
                        const isEditingThis = editingCell?.rowIndex === rowObj.originalRowIndex && editingCell?.colIndex === col.index;

                        return (
                          <td
                            key={col.index}
                            onDoubleClick={() => handleStartCellEdit(rowObj.originalRowIndex, col.index, cellVal)}
                            className="px-3 py-2 text-slate-700 border-r border-slate-100 whitespace-pre-wrap max-w-xs break-words relative group cursor-pointer hover:bg-blue-100/40 transition-colors"
                            title="Double-click to edit cell"
                          >
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <textarea
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDownEdit}
                                  rows={2}
                                  className="w-full text-xs p-1 border-2 border-blue-500 rounded focus:outline-none bg-white font-sans text-slate-900 shadow-inner"
                                />
                                <button
                                  onClick={handleSaveCellEdit}
                                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
                                  title="Save edit"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-1 group">
                                <span className={!displayStr ? 'text-slate-300 italic' : ''}>
                                  {displayStr || '(empty)'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartCellEdit(rowObj.originalRowIndex, col.index, cellVal);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 transition-opacity"
                                  title="Edit cell"
                                >
                                  <EditIcon className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Action Cell */}
                      <td className="px-2 py-2 text-center text-slate-400">
                        <button
                          onClick={() => handleDeleteRow(rowObj.originalRowIndex)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{filteredRows.length}</span> rows preserve uploaded order.
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Default Columns: <strong className="text-slate-700">B, C, D, E, F, G, H, Q</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
