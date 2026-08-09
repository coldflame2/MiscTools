import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  FileCheck,
  Filter,
  Search,
  Download,
  Layers,
  ShieldCheck,
  ArrowRight,
  Trash2,
  Copy,
  Table,
  Check,
  AlertCircle,
  ClipboardPaste,
  MousePointerClick,
  ArrowLeftRight,
  RotateCcw,
  Sparkles,
  Globe,
  Link,
  ExternalLink,
  HardDrive,
  Save,
  Zap,
  FolderCheck,
  CheckSquare,
  Square
} from 'lucide-react';
import { MenuIcon } from './icons/MenuIcon';
import {
  validateBmsFile,
  performCrossValidation,
  BmsFileValidationResult,
  BmsCrossValidationResult,
  BmsIssue,
  EXPECTED_BMS_HEADERS,
  findBmsHeaderRow,
  getRowVal,
  analyzeNameLengths,
  normalizeHeaderKey
} from '../utils/bmsValidator';

interface BmsNavItemProps {
  icon: React.ReactNode;
  label: string;
  isExpanded: boolean;
  isActive?: boolean;
  onClick: () => void;
  badgeCount?: number;
  badgeColor?: string;
}

const BmsNavItem: React.FC<BmsNavItemProps> = ({
  icon,
  label,
  isExpanded,
  isActive,
  onClick,
  badgeCount,
  badgeColor = 'bg-red-500 text-white',
}) => {
  return (
    <li className="relative">
      <button
        onClick={onClick}
        className={`flex items-center w-full rounded-xl transition-colors duration-200 group ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 font-bold'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold'
        } ${!isExpanded ? 'justify-center p-1.5' : 'p-2.5'}`}
        title={isExpanded ? undefined : label}
      >
        {icon}
        <span
          className={`ml-3.5 font-bold text-xs transition-all duration-200 ease-in-out whitespace-nowrap overflow-hidden ${
            isExpanded ? 'opacity-100' : 'opacity-0 max-w-0'
          }`}
        >
          {label}
        </span>
      </button>
      {badgeCount !== undefined && badgeCount > 0 && !isExpanded && (
        <span className={`absolute top-1 right-1 block h-2.5 w-2.5 rounded-full ${badgeColor.includes('bg-') ? badgeColor.split(' ')[0] : 'bg-red-500'} ring-2 ring-white`}></span>
      )}
      {badgeCount !== undefined && badgeCount > 0 && isExpanded && (
        <span className={`absolute top-1/2 -translate-y-1/2 right-2.5 flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 text-[11px] font-bold rounded-full ${badgeColor}`}>
          {badgeCount}
        </span>
      )}
    </li>
  );
};

const LOCAL_STORAGE_ORIGINAL_KEY = 'bms_validation_original_data_v1';
const LOCAL_STORAGE_FINAL_KEY = 'bms_validation_final_data_v1';

// Resizable Issue Table for Original & Final Recoded Tabs
interface ColumnWidths {
  row: number;
  field: number;
  currentValue: number;
  issueExplanation: number;
}

interface ResizableIssueTableProps {
  issues: BmsIssue[];
  emptyMessage: string;
}

const ResizableIssueTable: React.FC<ResizableIssueTableProps> = ({ issues, emptyMessage }) => {
  const [colWidths, setColWidths] = useState<ColumnWidths>({
    row: 100,
    field: 200,
    currentValue: 240,
    issueExplanation: 480,
  });

  const totalWidth = useMemo(() => {
    return colWidths.row + colWidths.field + colWidths.currentValue + colWidths.issueExplanation;
  }, [colWidths]);

  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return issues;
    const term = searchTerm.toLowerCase();
    return issues.filter((issue) => {
      const rowStr = issue.rowIndex ? `row ${issue.rowIndex}` : issue.excelRow ? `row ${issue.excelRow}` : 'header';
      const matchRow = rowStr.toLowerCase().includes(term);
      const matchField = issue.field?.toLowerCase().includes(term);
      const matchVal = (issue.currentValue ?? '').toLowerCase().includes(term);
      const matchMsg = issue.message.toLowerCase().includes(term);
      return matchRow || matchField || matchVal || matchMsg;
    });
  }, [issues, searchTerm]);

  const handleMouseDown = (colKey: keyof ColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + delta),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="space-y-3">
      {/* Search Input & Info Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
        <div className="relative flex-grow max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search row, field, value, explanation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <div className="text-slate-500 font-medium text-xs">
          Count: <span className="font-bold text-slate-800">{filtered.length}</span>
          {filtered.length !== issues.length && ` (of ${issues.length})`}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 bg-emerald-50/50 rounded-xl border border-emerald-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h4 className="font-bold text-slate-800 text-sm">No Compliance Issues</h4>
          <p className="text-xs text-slate-500 mt-1">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs bg-white">
          <table
            className="table-fixed text-left text-xs text-slate-700 border-collapse"
            style={{ width: `${totalWidth}px` }}
          >
            <colgroup>
              <col style={{ width: `${colWidths.row}px` }} />
              <col style={{ width: `${colWidths.field}px` }} />
              <col style={{ width: `${colWidths.currentValue}px` }} />
              <col style={{ width: `${colWidths.issueExplanation}px` }} />
            </colgroup>
            <thead className="bg-slate-100 font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 select-none">
              <tr>
                {/* Header 1: Row */}
                <th
                  style={{ width: `${colWidths.row}px` }}
                  className="relative p-2.5 border-r border-slate-200 bg-slate-100 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Row</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('row', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/60 active:bg-indigo-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 2: Field */}
                <th
                  style={{ width: `${colWidths.field}px` }}
                  className="relative p-2.5 border-r border-slate-200 bg-slate-100 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Field</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('field', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/60 active:bg-indigo-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 3: Current Value */}
                <th
                  style={{ width: `${colWidths.currentValue}px` }}
                  className="relative p-2.5 border-r border-slate-200 bg-slate-100 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Current Value</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('currentValue', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/60 active:bg-indigo-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 4: Issue Explanation */}
                <th
                  style={{ width: `${colWidths.issueExplanation}px` }}
                  className="relative p-2.5 bg-slate-100 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Issue Explanation</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('issueExplanation', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/60 active:bg-indigo-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((issue, idx) => (
                <tr key={issue.id || idx} className="hover:bg-slate-50 transition-colors">
                  {/* Column 1: Row */}
                  <td className="p-2.5 font-mono font-semibold text-slate-800 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
                    {issue.rowIndex ? `Row ${issue.rowIndex}` : issue.excelRow ? `Row ${issue.excelRow}` : 'Header'}
                  </td>

                  {/* Column 2: Field */}
                  <td className="p-2.5 font-semibold text-indigo-900 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap" title={issue.field || 'General'}>
                    {issue.field || 'General'}
                  </td>

                  {/* Column 3: Current Value */}
                  <td className="p-2.5 font-mono text-[11px] text-slate-700 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap" title={issue.currentValue}>
                    {issue.currentValue !== undefined && issue.currentValue !== '' ? (
                      issue.currentValue
                    ) : (
                      <span className="text-red-400 italic">(blank)</span>
                    )}
                  </td>

                  {/* Column 4: Issue Explanation */}
                  <td className="p-2.5 text-slate-800 font-medium leading-relaxed">
                    {issue.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Resizable Issue Table for Cross-Matching Tab
interface CrossColumnWidths {
  origRow: number;
  finalRow: number;
  field: number;
  origValue: number;
  finalValue: number;
  issueExplanation: number;
}

interface ResizableCrossIssueTableProps {
  issues: BmsIssue[];
  emptyMessage: string;
}

const ResizableCrossIssueTable: React.FC<ResizableCrossIssueTableProps> = ({ issues, emptyMessage }) => {
  const [colWidths, setColWidths] = useState<CrossColumnWidths>({
    origRow: 95,
    finalRow: 95,
    field: 160,
    origValue: 190,
    finalValue: 190,
    issueExplanation: 450,
  });

  const totalWidth = useMemo(() => {
    return (
      colWidths.origRow +
      colWidths.finalRow +
      colWidths.field +
      colWidths.origValue +
      colWidths.finalValue +
      colWidths.issueExplanation
    );
  }, [colWidths]);

  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return issues;
    const term = searchTerm.toLowerCase();
    return issues.filter((issue) => {
      const matchOrigRow = String(issue.origRow ?? '').toLowerCase().includes(term);
      const matchFinalRow = String(issue.finalRow ?? '').toLowerCase().includes(term);
      const matchField = issue.field?.toLowerCase().includes(term);
      const matchOrigVal = (issue.origValue ?? '').toLowerCase().includes(term);
      const matchFinalVal = (issue.finalValue ?? '').toLowerCase().includes(term);
      const matchMsg = issue.message.toLowerCase().includes(term);
      const matchAsset = (issue.assetName ?? '').toLowerCase().includes(term);
      return matchOrigRow || matchFinalRow || matchField || matchOrigVal || matchFinalVal || matchMsg || matchAsset;
    });
  }, [issues, searchTerm]);

  const handleMouseDown = (colKey: keyof CrossColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(50, startWidth + delta),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="space-y-3">
      {/* Search Input & Info Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
        <div className="relative flex-grow max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search orig row, final row, field, value, asset..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <div className="text-slate-500 font-medium text-xs">
          Cross Mismatches: <span className="font-bold text-amber-700">{filtered.length}</span>
          {filtered.length !== issues.length && ` (of ${issues.length})`}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 bg-emerald-50/50 rounded-xl border border-emerald-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h4 className="font-bold text-slate-800 text-sm">No Cross-Matching Discrepancies</h4>
          <p className="text-xs text-slate-500 mt-1">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs bg-white">
          <table
            className="table-fixed text-left text-xs text-slate-700 border-collapse"
            style={{ width: `${totalWidth}px` }}
          >
            <colgroup>
              <col style={{ width: `${colWidths.origRow}px` }} />
              <col style={{ width: `${colWidths.finalRow}px` }} />
              <col style={{ width: `${colWidths.field}px` }} />
              <col style={{ width: `${colWidths.origValue}px` }} />
              <col style={{ width: `${colWidths.finalValue}px` }} />
              <col style={{ width: `${colWidths.issueExplanation}px` }} />
            </colgroup>
            <thead className="bg-amber-50/80 font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-amber-200 select-none">
              <tr>
                {/* Header 1: Orig Row */}
                <th
                  style={{ width: `${colWidths.origRow}px` }}
                  className="relative p-2.5 border-r border-amber-200 bg-amber-50/80 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Orig Row</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('origRow', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400/60 active:bg-amber-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 2: Final Row */}
                <th
                  style={{ width: `${colWidths.finalRow}px` }}
                  className="relative p-2.5 border-r border-amber-200 bg-amber-50/80 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Final Row</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('finalRow', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400/60 active:bg-amber-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 3: Field */}
                <th
                  style={{ width: `${colWidths.field}px` }}
                  className="relative p-2.5 border-r border-amber-200 bg-amber-50/80 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Field</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('field', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400/60 active:bg-amber-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 4: Original Value */}
                <th
                  style={{ width: `${colWidths.origValue}px` }}
                  className="relative p-2.5 border-r border-amber-200 bg-amber-50/80 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Original Value</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('origValue', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400/60 active:bg-amber-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 5: Final Value */}
                <th
                  style={{ width: `${colWidths.finalValue}px` }}
                  className="relative p-2.5 border-r border-amber-200 bg-amber-50/80 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Final Value</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('finalValue', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400/60 active:bg-amber-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>

                {/* Header 6: Issue Explanation */}
                <th
                  style={{ width: `${colWidths.issueExplanation}px` }}
                  className="relative p-2.5 bg-amber-50/80 overflow-hidden text-ellipsis whitespace-nowrap"
                >
                  <div className="flex items-center justify-between pr-2">
                    <span>Issue Explanation</span>
                    <div
                      onMouseDown={(e) => handleMouseDown('issueExplanation', e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400/60 active:bg-amber-600 transition-colors z-10"
                      title="Drag to resize column"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((issue, idx) => (
                <tr key={issue.id || idx} className="hover:bg-amber-50/30 transition-colors">
                  {/* Column 1: Orig Row */}
                  <td className="p-2.5 font-mono font-semibold text-indigo-900 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
                    {issue.origRow || (issue.rowIndex ? `Row ${issue.rowIndex}` : '—')}
                  </td>

                  {/* Column 2: Final Row */}
                  <td className="p-2.5 font-mono font-semibold text-purple-900 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
                    {issue.finalRow || '—'}
                  </td>

                  {/* Column 3: Field */}
                  <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap" title={issue.field || 'General'}>
                    {issue.field || 'General'}
                  </td>

                  {/* Column 4: Original Value */}
                  <td className="p-2.5 font-mono text-[11px] text-slate-700 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap" title={issue.origValue ?? issue.currentValue}>
                    {issue.origValue !== undefined && issue.origValue !== '' ? (
                      issue.origValue
                    ) : (
                      <span className="text-red-400 italic">(blank)</span>
                    )}
                  </td>

                  {/* Column 5: Final Value */}
                  <td className="p-2.5 font-mono text-[11px] text-slate-700 border-r border-slate-200 overflow-hidden text-ellipsis whitespace-nowrap" title={issue.finalValue}>
                    {issue.finalValue !== undefined && issue.finalValue !== '' ? (
                      issue.finalValue
                    ) : (
                      <span className="text-red-400 italic">(blank)</span>
                    )}
                  </td>

                  {/* Column 6: Issue Explanation */}
                  <td className="p-2.5 text-slate-800 font-medium leading-relaxed">
                    {issue.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface EditableSpreadsheetViewerProps {
  title: string;
  fileType: 'original' | 'final';
  fileData: {
    fileName: string;
    matrix: (string | number)[][];
    result: BmsFileValidationResult;
    sourceUrl?: string | null;
  };
  onUpdateMatrix: (newMatrix: (string | number)[][]) => void;
  onRefreshFromLink?: () => void;
  isRefreshing?: boolean;
}

const EditableSpreadsheetViewer: React.FC<EditableSpreadsheetViewerProps> = ({
  title,
  fileType,
  fileData,
  onUpdateMatrix,
  onRefreshFromLink,
  isRefreshing = false,
}) => {
  const [editingCell, setEditingCell] = useState<{ excelRow: string; headerKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set());

  // Direct Local File Two-Way Live Sync State
  const [localHandle, setLocalHandle] = useState<any>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [autoSyncLocal, setAutoSyncLocal] = useState<boolean>(true);
  const [lastSavedLocal, setLastSavedLocal] = useState<string | null>(null);
  const [isSavingLocal, setIsSavingLocal] = useState<boolean>(false);
  const [localSyncStatusMsg, setLocalSyncStatusMsg] = useState<string | null>(null);
  const [showIframeModal, setShowIframeModal] = useState<boolean>(false);

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const lastDiskModifiedRef = useRef<number>(0);
  const lastAppWriteTimeRef = useRef<number>(0);

  const { records, headerInfo } = fileData.result;

  const saveToLocalHandle = async (handle: any, matrixToSave: (string | number)[][]) => {
    if (!handle) return false;
    try {
      setIsSavingLocal(true);
      // @ts-ignore
      const XLSX = window.XLSX;
      if (!XLSX) return false;

      const worksheet = XLSX.utils.aoa_to_sheet(matrixToSave);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DataSheet');
      const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

      const writable = await handle.createWritable();
      await writable.write(arrayBuffer);
      await writable.close();

      try {
        const diskFile = await handle.getFile();
        lastDiskModifiedRef.current = diskFile.lastModified;
      } catch (e) {}
      lastAppWriteTimeRef.current = Date.now();

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedLocal(timeStr);
      setLocalSyncStatusMsg(`Saved directly to local disk file "${handle.name}" at ${timeStr}`);
      setTimeout(() => setLocalSyncStatusMsg(null), 3500);
      return true;
    } catch (err: any) {
      console.error('Error auto-saving to local file handle:', err);
      setLocalSyncStatusMsg(`Save to local disk failed: ${err?.message || err}`);
      setTimeout(() => setLocalSyncStatusMsg(null), 5000);
      return false;
    } finally {
      setIsSavingLocal(false);
    }
  };

  // Check local disk file for external edits (Local File -> App sync)
  const checkForDiskFileChanges = useCallback(async () => {
    if (!localHandle) return;
    try {
      const diskFile = await localHandle.getFile();
      const fileModTime = diskFile.lastModified;

      // If disk file was modified externally after our last write/read (+1.5s tolerance)
      if (
        lastDiskModifiedRef.current > 0 &&
        fileModTime > lastDiskModifiedRef.current + 1500 &&
        fileModTime > lastAppWriteTimeRef.current + 1500
      ) {
        // @ts-ignore
        const XLSX = window.XLSX;
        if (!XLSX) return;

        const arrayBuffer = await diskFile.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const newMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as (string | number)[][];

        if (newMatrix && newMatrix.length > 0) {
          lastDiskModifiedRef.current = fileModTime;
          onUpdateMatrix(newMatrix);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLocalSyncStatusMsg(`⚡ Re-synced external edits from local disk file "${localHandle.name}" at ${timeStr}`);
          setTimeout(() => setLocalSyncStatusMsg(null), 4000);
        }
      } else {
        lastDiskModifiedRef.current = Math.max(lastDiskModifiedRef.current, fileModTime);
      }
    } catch (err) {
      console.warn('Error checking local disk file:', err);
    }
  }, [localHandle, onUpdateMatrix]);

  // Two-way auto sync polling effect
  useEffect(() => {
    if (!localHandle || !autoSyncLocal) return;

    const intervalId = setInterval(() => {
      checkForDiskFileChanges();
    }, 2500);

    const handleFocus = () => {
      checkForDiskFileChanges();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [localHandle, autoSyncLocal, checkForDiskFileChanges]);

  const handleConnectLocalFile = async () => {
    if (isIframe) {
      setShowIframeModal(true);
      return;
    }

    if (!('showOpenFilePicker' in window) && !('showSaveFilePicker' in window)) {
      alert(
        'Direct Local File Sync requires the File System Access API (supported on Desktop Chrome, Edge, and Brave). Please open this app in Chrome/Edge/Brave to write directly to local files without downloading.'
      );
      return;
    }

    try {
      let handle: any = null;

      // Prefer showOpenFilePicker to pick existing file or fallback to showSaveFilePicker
      if ('showOpenFilePicker' in window) {
        try {
          const [pickerHandle] = await (window as any).showOpenFilePicker({
            types: [
              {
                description: 'Excel Spreadsheet (*.xlsx)',
                accept: {
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                },
              },
            ],
            multiple: false,
          });
          handle = pickerHandle;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }

      if (!handle && 'showSaveFilePicker' in window) {
        const suggested = fileData.fileName || (fileType === 'original' ? 'Original_HiRes_Log.xlsx' : 'Final_Recoded_Log.xlsx');
        handle = await (window as any).showSaveFilePicker({
          suggestedName: suggested,
          types: [
            {
              description: 'Excel Spreadsheet (*.xlsx)',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              },
            },
          ],
        });
      }

      if (handle) {
        setLocalHandle(handle);
        setLocalFileName(handle.name);
        try {
          const diskFile = await handle.getFile();
          lastDiskModifiedRef.current = diskFile.lastModified;
        } catch (e) {}

        await saveToLocalHandle(handle, fileData.matrix);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        if (err?.message?.includes('sub frame') || err?.message?.includes('Cross origin') || err?.name === 'SecurityError') {
          setShowIframeModal(true);
        } else {
          alert('Could not bind local file: ' + (err?.message || err));
        }
      }
    }
  };

  // Filter records based on search term
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((rec) => {
      return Object.entries(rec).some(([key, val]) => {
        if (key === '_excelRow') return String(val).includes(term);
        return String(val || '').toLowerCase().includes(term);
      });
    });
  }, [records, searchTerm]);

  const handleStartEdit = (excelRow: string, headerKey: string, currentVal: string) => {
    setEditingCell({ excelRow, headerKey });
    setEditValue(currentVal || '');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleCommitEdit = (excelRow: string, headerKey: string) => {
    if (editingCell?.excelRow !== excelRow || editingCell?.headerKey !== headerKey) return;

    const excelRowNumber = Number(excelRow); // 1-based row number in Excel
    if (isNaN(excelRowNumber) || excelRowNumber < 1) return;

    const matrixRowIdx = excelRowNumber - 1; // 0-based row index in matrix

    const normKey = normalizeHeaderKey(headerKey);
    let colIdx = headerInfo.colMap[normKey];

    // Clone matrix
    const newMatrix = fileData.matrix.map((row) => [...row]);

    // Ensure target row exists
    if (!newMatrix[matrixRowIdx]) {
      newMatrix[matrixRowIdx] = [];
    }

    if (colIdx === undefined) {
      // Search header row in matrix
      const headerRow = newMatrix[headerInfo.headerRowIndex] || [];
      const foundIdx = headerRow.findIndex(
        (cell) => normalizeHeaderKey(String(cell || '')) === normKey
      );
      if (foundIdx !== -1) {
        colIdx = foundIdx;
      } else {
        colIdx = headerRow.length;
        if (!newMatrix[headerInfo.headerRowIndex]) {
          newMatrix[headerInfo.headerRowIndex] = [];
        }
        newMatrix[headerInfo.headerRowIndex][colIdx] = headerKey;
      }
    }

    newMatrix[matrixRowIdx][colIdx] = editValue;

    // Track edited cell key
    setEditedCells((prev) => new Set(prev).add(`${excelRow}-${headerKey}`));

    onUpdateMatrix(newMatrix);
    setEditingCell(null);
    setEditValue('');

    // Instant local file auto-save on edit if file handle bound
    if (localHandle && autoSyncLocal) {
      saveToLocalHandle(localHandle, newMatrix);
    }
  };

  const handleExportSheet = () => {
    try {
      // @ts-ignore
      const XLSX = window.XLSX;
      if (!XLSX) {
        alert('SheetJS library is not ready.');
        return;
      }
      const worksheet = XLSX.utils.aoa_to_sheet(fileData.matrix);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DataSheet');

      const cleanFileName = fileData.fileName
        ? fileData.fileName.replace(/\.[^/.]+$/, '')
        : fileType === 'original'
        ? 'Original_HiRes'
        : 'Final_Recoded';
      XLSX.writeFile(workbook, `${cleanFileName}_Updated_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      console.error('Failed to export updated spreadsheet:', e);
      alert('Failed to export spreadsheet: ' + (e?.message || e));
    }
  };

  // Dropdown options for specific BMS columns
  const getDropdownOptions = (headerKey: string): string[] | null => {
    if (headerKey === 'BRAG Status') return ['Green', 'Amber', 'Red'];
    if (headerKey === 'Status (mandatory)') return ['Final', 'Draft'];
    if (headerKey === 'Type (read-only)') return ['Image', 'Audio', 'Video', 'Multimedia', 'Text'];
    if (headerKey === 'Metadata Complete') return ['TRUE', 'FALSE'];
    if (headerKey.includes('Type (mandatory)')) {
      if (headerKey.startsWith('Image')) return ['photo', 'illustration', 'illustration vector'];
      if (headerKey.startsWith('Audio')) return ['music', 'speech', 'sound effect'];
      if (headerKey.startsWith('Video')) return ['clip', 'animation', 'documentary'];
      if (headerKey.startsWith('Multimedia')) return ['interactive', 'game', 'presentation'];
      if (headerKey.startsWith('Text')) return ['article', 'book', 'transcript'];
    }
    return null;
  };

  return (
    <div className="p-4 space-y-3">
      {/* Header bar with title, search input, and Download button */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className={`w-5 h-5 ${fileType === 'original' ? 'text-indigo-600' : 'text-purple-600'}`} />
          <div>
            <h4 className="font-bold text-sm text-slate-800">{title}</h4>
            <p className="text-[11px] text-slate-500">
              {fileData.result.totalRows} Total Rows • {records.length} Records • Click any cell for in-line quick edit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in grid..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Direct Local File Two-Way Auto-Save Controls */}
          {localHandle ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-300 text-xs font-semibold shadow-2xs">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
              <span className="truncate max-w-[120px] text-emerald-950 font-bold" title={localFileName || ''}>
                {localFileName}
              </span>
              <button
                type="button"
                onClick={() => saveToLocalHandle(localHandle, fileData.matrix)}
                disabled={isSavingLocal}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                title="Save changes directly to local disk file now"
              >
                <Save className={`w-3 h-3 ${isSavingLocal ? 'animate-spin' : ''}`} />
                <span>{isSavingLocal ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={checkForDiskFileChanges}
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Check and re-sync changes made in local file"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sync Now</span>
              </button>
              <label className="flex items-center gap-1 text-[10px] text-emerald-900 font-bold cursor-pointer ml-0.5 select-none" title="Automatically sync changes two-way between app and local disk file">
                <input
                  type="checkbox"
                  checked={autoSyncLocal}
                  onChange={(e) => setAutoSyncLocal(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3 h-3 cursor-pointer"
                />
                <span>2-Way Live Sync</span>
              </label>
              <button
                onClick={() => {
                  setLocalHandle(null);
                  setLocalFileName(null);
                }}
                className="text-slate-400 hover:text-red-600 ml-1 font-bold text-xs p-0.5 cursor-pointer"
                title="Disconnect local file binding"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectLocalFile}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
              title="Bind a file on your local folder for instant 2-way live auto-sync without downloading"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bind Local File (2-Way Sync)</span>
            </button>
          )}

          {/* Refresh Data from OneDrive Link Button (if sourceUrl present) */}
          {fileData.sourceUrl && onRefreshFromLink && (
            <button
              onClick={onRefreshFromLink}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              title="Re-read and fetch the latest content from the connected OneDrive link"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh from Link'}</span>
            </button>
          )}

          {/* Download Updated Excel Button */}
          <button
            onClick={handleExportSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
            title="Download updated spreadsheet as XLSX file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Copy (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Direct Local File Auto-Sync Notification Toast */}
      {localSyncStatusMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600 animate-pulse" />
            <span>{localSyncStatusMsg}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100 px-2 py-0.5 rounded font-bold">
            0ms Live 2-Way Sync
          </span>
        </div>
      )}

      {/* Grid Container with Full Scrollability */}
      <div className="relative w-full border border-slate-200 rounded-xl overflow-auto max-h-[580px] bg-white shadow-2xs">
        <table className="table-auto min-w-max text-left text-xs text-slate-700 border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-100 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider text-slate-700 select-none shadow-xs">
            <tr>
              {/* Sticky Top-Left Corner Cell: Excel Row */}
              <th className="sticky top-0 left-0 z-30 p-2.5 bg-slate-200 border-r border-b border-slate-300 text-center w-16 min-w-[64px] font-mono text-slate-800 shadow-xs">
                Row #
              </th>

              {/* Header Columns */}
              {EXPECTED_BMS_HEADERS.map((h) => {
                const isMandatory = h.includes('(mandatory)');
                const isReadOnly = h.includes('(read-only)');
                return (
                  <th
                    key={h}
                    className={`p-2.5 border-r border-slate-300 whitespace-nowrap min-w-[140px] max-w-[280px] ${
                      fileType === 'original' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100/80 text-purple-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{h}</span>
                      {isMandatory && (
                        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold">req</span>
                      )}
                      {isReadOnly && (
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1 py-0.2 rounded font-normal">ro</span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={EXPECTED_BMS_HEADERS.length + 1} className="p-8 text-center text-slate-400 text-xs">
                  {searchTerm ? 'No cells match your search filter.' : 'No data records found.'}
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => {
                const rowNum = rec._excelRow; // Exact Excel row number (string)

                return (
                  <tr key={rowNum} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Sticky Row Number Column */}
                    <td className="sticky left-0 z-10 p-2 border-r border-slate-200 font-mono text-center font-bold text-slate-600 bg-slate-100 shadow-2xs group-hover:bg-slate-200/80 transition-colors">
                      {rowNum}
                    </td>

                    {/* Data Cells */}
                    {EXPECTED_BMS_HEADERS.map((h) => {
                      const val = rec[h] || '';
                      const isMandatoryCol = h.includes('(mandatory)');
                      const isMissingMandatory = isMandatoryCol && !val;
                      const isEditing = editingCell?.excelRow === rowNum && editingCell?.headerKey === h;
                      const isEdited = editedCells.has(`${rowNum}-${h}`);
                      const options = getDropdownOptions(h);

                      return (
                        <td
                          key={h}
                          onDoubleClick={() => handleStartEdit(rowNum, h, val)}
                          className={`p-1.5 border-r border-slate-200 min-w-[140px] max-w-[280px] text-xs relative ${
                            isMissingMandatory
                              ? 'bg-red-50 text-red-900 font-semibold'
                              : isEdited
                              ? 'bg-emerald-50/80 text-emerald-900 font-medium'
                              : ''
                          }`}
                          title={`Click to edit cell value (${h})`}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              {options ? (
                                <select
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => handleCommitEdit(rowNum, h)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCommitEdit(rowNum, h);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  className="w-full p-1 text-xs border border-indigo-500 rounded bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400 font-sans"
                                >
                                  <option value="">-- Select --</option>
                                  {options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => handleCommitEdit(rowNum, h)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCommitEdit(rowNum, h);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  className="w-full p-1 text-xs border border-indigo-500 rounded bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                />
                              )}
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleCommitEdit(rowNum, h);
                                }}
                                className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-[10px]"
                                title="Save edit"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleStartEdit(rowNum, h, val)}
                              className="cursor-pointer hover:bg-indigo-50/80 p-1 rounded transition-colors min-h-[24px] flex items-center justify-between group/cell"
                            >
                              <span className="truncate">
                                {val || <span className="text-slate-300 italic">-</span>}
                              </span>
                              <span className="opacity-0 group-hover/cell:opacity-100 text-[10px] text-indigo-500 font-sans ml-1 flex-shrink-0">
                                ✎
                              </span>
                            </div>
                          )}
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

      {/* Modal for Iframe Cross-Origin Restriction Notice */}
      {showIframeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4 mx-auto">
              <HardDrive className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Open App in New Tab for Local File Sync
            </h3>
            <p className="text-sm text-slate-600 text-center mb-5 leading-relaxed">
              Browsers block native disk file access inside embedded sub-frame windows for security.
              <br/><br/>
              To bind your local folder Excel file and enable <strong>instant 2-way live auto-sync</strong>, please open the application in a direct browser tab.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  setShowIframeModal(false);
                }}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open App in New Tab to Bind Local File</span>
              </button>
              <button
                type="button"
                onClick={() => setShowIframeModal(false)}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BmsValidation: React.FC = () => {
  // File state initialized from localStorage if present
  const [originalFile, setOriginalFile] = useState<{
    file: File | null;
    fileName: string;
    matrix: (string | number)[][];
    result: BmsFileValidationResult | null;
    sourceUrl?: string | null;
  }>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ORIGINAL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.fileName && Array.isArray(parsed.matrix) && parsed.matrix.length > 0) {
          const result = validateBmsFile(parsed.matrix, parsed.fileName, 'original');
          return {
            file: null,
            fileName: parsed.fileName,
            matrix: parsed.matrix,
            result,
            sourceUrl: parsed.sourceUrl || null,
          };
        }
      }
    } catch (e) {
      console.warn('Unable to load original file from localStorage:', e);
    }
    return { file: null, fileName: '', matrix: [], result: null, sourceUrl: null };
  });

  const [finalFile, setFinalFile] = useState<{
    file: File | null;
    fileName: string;
    matrix: (string | number)[][];
    result: BmsFileValidationResult | null;
    sourceUrl?: string | null;
  }>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_FINAL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.fileName && Array.isArray(parsed.matrix) && parsed.matrix.length > 0) {
          const result = validateBmsFile(parsed.matrix, parsed.fileName, 'final');
          return {
            file: null,
            fileName: parsed.fileName,
            matrix: parsed.matrix,
            result,
            sourceUrl: parsed.sourceUrl || null,
          };
        }
      }
    } catch (e) {
      console.warn('Unable to load final file from localStorage:', e);
    }
    return { file: null, fileName: '', matrix: [], result: null, sourceUrl: null };
  });

  // Sync state to localStorage on changes
  useEffect(() => {
    try {
      if (originalFile.matrix && originalFile.matrix.length > 0 && originalFile.fileName) {
        localStorage.setItem(
          LOCAL_STORAGE_ORIGINAL_KEY,
          JSON.stringify({
            fileName: originalFile.fileName,
            matrix: originalFile.matrix,
            sourceUrl: originalFile.sourceUrl || null,
          })
        );
      } else {
        localStorage.removeItem(LOCAL_STORAGE_ORIGINAL_KEY);
      }
    } catch (e) {
      console.warn('Unable to store original file to localStorage:', e);
    }
  }, [originalFile.fileName, originalFile.matrix, originalFile.sourceUrl]);

  useEffect(() => {
    try {
      if (finalFile.matrix && finalFile.matrix.length > 0 && finalFile.fileName) {
        localStorage.setItem(
          LOCAL_STORAGE_FINAL_KEY,
          JSON.stringify({
            fileName: finalFile.fileName,
            matrix: finalFile.matrix,
            sourceUrl: finalFile.sourceUrl || null,
          })
        );
      } else {
        localStorage.removeItem(LOCAL_STORAGE_FINAL_KEY);
      }
    } catch (e) {
      console.warn('Unable to store final file to localStorage:', e);
    }
  }, [finalFile.fileName, finalFile.matrix, finalFile.sourceUrl]);

  // Clear all uploaded data
  const handleClearAllData = useCallback(() => {
    setOriginalFile({ file: null, fileName: '', matrix: [], result: null });
    setFinalFile({ file: null, fileName: '', matrix: [], result: null });
    setBypassedFinalLength(false);
    setShowOutlierList(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_ORIGINAL_KEY);
      localStorage.removeItem(LOCAL_STORAGE_FINAL_KEY);
    } catch (e) {
      // ignore
    }
    setPasteNotification('All uploaded spreadsheet data cleared.');
    setTimeout(() => setPasteNotification(null), 3000);
  }, []);

  const [isProcessingOriginal, setIsProcessingOriginal] = useState(false);
  const [isProcessingFinal, setIsProcessingFinal] = useState(false);
  const [isDraggingOriginal, setIsDraggingOriginal] = useState(false);
  const [isDraggingFinal, setIsDraggingFinal] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [pasteNotification, setPasteNotification] = useState<string | null>(null);

  const originalInputRef = useRef<HTMLInputElement>(null);
  const finalInputRef = useRef<HTMLInputElement>(null);
  const dualInputRef = useRef<HTMLInputElement>(null);

  // OneDrive / Online Link State
  const [showOneDriveBox, setShowOneDriveBox] = useState<boolean>(false);
  const [originalUrlInput, setOriginalUrlInput] = useState<string>('');
  const [finalUrlInput, setFinalUrlInput] = useState<string>('');
  const [showAddLinkModal, setShowAddLinkModal] = useState<boolean>(false);

  // Handler to fetch or refresh Excel content from OneDrive / Online URL
  const handleFetchOnlineUrl = useCallback(
    async (url: string, targetRole: 'original' | 'final' | 'auto', isRefresh = false) => {
      const cleanUrl = url.trim();
      if (!cleanUrl) return;

      if (targetRole === 'original' || targetRole === 'auto') {
        setIsProcessingOriginal(true);
      }
      if (targetRole === 'final' || targetRole === 'auto') {
        setIsProcessingFinal(true);
      }

      try {
        const response = await fetch('/api/fetch-online-excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl, refresh: isRefresh }),
        });

        if (!response.ok) {
          let errText = `Failed to fetch online file (HTTP ${response.status})`;
          try {
            const errJson = await response.json();
            if (errJson?.error) errText = errJson.error;
          } catch (e) {}
          throw new Error(errText);
        }

        const arrayBuffer = await response.arrayBuffer();
        // @ts-ignore
        const XLSX = window.XLSX;
        if (!XLSX) {
          throw new Error('Sheet parser library (XLSX) is not ready.');
        }
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as (string | number)[][];

        if (!rawMatrix || rawMatrix.length === 0) {
          throw new Error('The fetched spreadsheet file appears to be empty.');
        }

        // Determine filename from header or default
        const disposition = response.headers.get('content-disposition');
        let extractedName = 'OneDrive_Log.xlsx';
        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename="?([^";]+)"?/);
          if (match && match[1]) extractedName = match[1];
        }

        if (targetRole === 'original') {
          const result = validateBmsFile(rawMatrix, extractedName, 'original');
          setOriginalFile({
            file: null,
            fileName: extractedName,
            matrix: rawMatrix,
            result,
            sourceUrl: cleanUrl,
          });
          setOriginalUrlInput(cleanUrl);
          setPasteNotification(isRefresh ? 'Refreshed Original Hi-Res log from OneDrive link.' : 'Loaded Original Hi-Res log from OneDrive link.');
        } else if (targetRole === 'final') {
          const result = validateBmsFile(rawMatrix, extractedName, 'final');
          setFinalFile({
            file: null,
            fileName: extractedName,
            matrix: rawMatrix,
            result,
            sourceUrl: cleanUrl,
          });
          setFinalUrlInput(cleanUrl);
          setPasteNotification(isRefresh ? 'Refreshed Final Recoded log from OneDrive link.' : 'Loaded Final Recoded log from OneDrive link.');
        } else {
          // Auto-detect role based on file name or default to original
          const isFinal = extractedName.toLowerCase().includes('final') || extractedName.toLowerCase().includes('recoded');
          const role = isFinal ? 'final' : 'original';
          const result = validateBmsFile(rawMatrix, extractedName, role);
          if (isFinal) {
            setFinalFile({
              file: null,
              fileName: extractedName,
              matrix: rawMatrix,
              result,
              sourceUrl: cleanUrl,
            });
            setFinalUrlInput(cleanUrl);
          } else {
            setOriginalFile({
              file: null,
              fileName: extractedName,
              matrix: rawMatrix,
              result,
              sourceUrl: cleanUrl,
            });
            setOriginalUrlInput(cleanUrl);
          }
          setPasteNotification(`Loaded ${isFinal ? 'Final Recoded' : 'Original Hi-Res'} log from OneDrive link.`);
        }
        setShowAddLinkModal(false);
        setTimeout(() => setPasteNotification(null), 4000);
      } catch (err: any) {
        alert(`Error fetching OneDrive link: ${err?.message || err}`);
      } finally {
        setIsProcessingOriginal(false);
        setIsProcessingFinal(false);
      }
    },
    []
  );

  // Name length validation interactive state
  const [bypassedFinalLength, setBypassedFinalLength] = useState<boolean>(false);
  const [showOutlierList, setShowOutlierList] = useState<boolean>(false);

  // Filters state
  const [activeFileFilter, setActiveFileFilter] = useState<'all' | 'original' | 'final' | 'cross'>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'mandatory' | 'type_value' | 'brag_metadata' | 'cross_discrepancy' | 'header_missing'>('all');
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'issues' | 'data_original' | 'data_final' | 'rules'>('issues');
  const [issuesSubTab, setIssuesSubTab] = useState<'original' | 'final' | 'cross'>('original');
  const [isNavExpanded, setIsNavExpanded] = useState<boolean>(true);

  // Parse excel/csv buffer using window.XLSX
  const parseFileToMatrix = useCallback(async (file: File): Promise<(string | number)[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // @ts-ignore
          const XLSX = window.XLSX;
          if (!XLSX) {
            throw new Error('Sheet parser library (XLSX) is not ready.');
          }
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as (string | number)[][];
          resolve(rawMatrix);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // Helper to parse pasted TSV / CSV text or spreadsheet cells
  const parseTextToMatrix = useCallback((text: string): (string | number)[][] => {
    if (!text || !text.trim()) return [];
    try {
      // @ts-ignore
      const XLSX = window.XLSX;
      if (XLSX) {
        const workbook = XLSX.read(text, { type: 'string' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as (string | number)[][];
        if (rawMatrix && rawMatrix.length > 0) return rawMatrix;
      }
    } catch (e) {
      // fallback below
    }

    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.map(line => {
      if (line.includes('\t')) {
        return line.split('\t').map(c => c.trim());
      } else {
        return line.split(',').map(c => c.trim());
      }
    });
  }, []);

  // Core processor for Original File
  const processOriginalFile = useCallback(async (file: File) => {
    setIsProcessingOriginal(true);
    try {
      const matrix = await parseFileToMatrix(file);
      const result = validateBmsFile(matrix, file.name, 'original');
      setOriginalFile({
        file,
        fileName: file.name,
        matrix,
        result,
      });
      setPasteNotification(`Loaded Original Hi-Res file "${file.name}"`);
      setTimeout(() => setPasteNotification(null), 3000);
    } catch (err: any) {
      alert(`Error parsing Original Hi-Res file: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessingOriginal(false);
    }
  }, [parseFileToMatrix]);

  // Core processor for Final File
  const processFinalFile = useCallback(async (file: File) => {
    setIsProcessingFinal(true);
    try {
      const matrix = await parseFileToMatrix(file);
      const result = validateBmsFile(matrix, file.name, 'final');
      setFinalFile({
        file,
        fileName: file.name,
        matrix,
        result,
      });
      setPasteNotification(`Loaded Final Recoded file "${file.name}"`);
      setTimeout(() => setPasteNotification(null), 3000);
    } catch (err: any) {
      alert(`Error parsing Final Recoded file: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessingFinal(false);
    }
  }, [parseFileToMatrix]);

  // Calculate Name column consistency score to distinguish Original vs Final Recoded
  const computeNameConsistencyScore = useCallback((matrix: (string | number)[][], fileName: string) => {
    const headerInfo = findBmsHeaderRow(matrix);
    const records: Record<string, string>[] = [];
    const dataRows = matrix.slice(headerInfo.headerRowIndex + 1);
    dataRows.forEach((row, idx) => {
      const isRowEmpty = !row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '');
      if (isRowEmpty) return;
      const rowNumInSheet = headerInfo.headerRowIndex + 2 + idx;
      const recordObj: Record<string, string> = { _excelRow: String(rowNumInSheet) };
      EXPECTED_BMS_HEADERS.forEach(h => {
        recordObj[h] = getRowVal(row, headerInfo.colMap, h);
      });
      records.push(recordObj);
    });

    const analysis = analyzeNameLengths(records);

    let consistencyRatio = 0;
    if (analysis.totalCount > 0 && analysis.commonLength !== null) {
      const modeCount = analysis.lengthCounts[analysis.commonLength] || 0;
      consistencyRatio = modeCount / analysis.totalCount;
    }

    // Strict uniformity bonus for Final Recoded logs
    if (analysis.isUniformLength && analysis.totalCount > 0) {
      consistencyRatio += 0.5;
    }

    // Filename keyphrases adjustment
    const lowerName = fileName.toLowerCase();
    if (
      lowerName.includes('final') ||
      lowerName.includes('recode') ||
      lowerName.includes('recoded') ||
      lowerName.includes('clean') ||
      lowerName.includes('bms_final')
    ) {
      consistencyRatio += 0.3;
    }
    if (
      lowerName.includes('orig') ||
      lowerName.includes('original') ||
      lowerName.includes('hires') ||
      lowerName.includes('hi-res') ||
      lowerName.includes('raw')
    ) {
      consistencyRatio -= 0.3;
    }

    return {
      analysis,
      consistencyRatio,
      recordsCount: records.length,
    };
  }, []);

  // Classify 2 files automatically based on Name column length consistency
  const classifyAndStoreTwoFiles = useCallback(
    async (
      fileAData: { name: string; file?: File | null; matrix: (string | number)[][] },
      fileBData: { name: string; file?: File | null; matrix: (string | number)[][] }
    ) => {
      setIsProcessingOriginal(true);
      setIsProcessingFinal(true);

      try {
        const scoreA = computeNameConsistencyScore(fileAData.matrix, fileAData.name);
        const scoreB = computeNameConsistencyScore(fileBData.matrix, fileBData.name);

        let recodedData = fileAData;
        let originalData = fileBData;
        let recodedScore = scoreA;

        // The file with higher Name consistency is assigned as Final Recoded
        if (scoreB.consistencyRatio > scoreA.consistencyRatio) {
          recodedData = fileBData;
          originalData = fileAData;
          recodedScore = scoreB;
        }

        const origResult = validateBmsFile(originalData.matrix, originalData.name, 'original');
        const finalResult = validateBmsFile(recodedData.matrix, recodedData.name, 'final');

        setOriginalFile({
          file: originalData.file || null,
          fileName: originalData.name,
          matrix: originalData.matrix,
          result: origResult,
        });

        setFinalFile({
          file: recodedData.file || null,
          fileName: recodedData.name,
          matrix: recodedData.matrix,
          result: finalResult,
        });

        const isRecodedUniform = recodedScore.analysis.isUniformLength;
        const commonLen = recodedScore.analysis.commonLength;
        const msg = `⚡ Auto-classified: "${recodedData.name}" as Final Recoded (${
          isRecodedUniform && commonLen ? `uniform ${commonLen}-char Name codes` : 'consistent Name values'
        }) & "${originalData.name}" as Original Hi-Res.`;

        setPasteNotification(msg);
        setTimeout(() => setPasteNotification(null), 6000);
      } catch (err: any) {
        alert(`Error processing files: ${err?.message || 'Unknown error'}`);
      } finally {
        setIsProcessingOriginal(false);
        setIsProcessingFinal(false);
      }
    },
    [computeNameConsistencyScore]
  );

  // Handle upload of multiple or single files
  const handleMultipleOrSingleUpload = useCallback(
    async (filesList: FileList | File[], targetPreference?: 'original' | 'final') => {
      const fileArray = Array.from(filesList);
      if (fileArray.length >= 2) {
        const f1 = fileArray[0];
        const f2 = fileArray[1];
        setIsProcessingOriginal(true);
        setIsProcessingFinal(true);
        try {
          const [m1, m2] = await Promise.all([parseFileToMatrix(f1), parseFileToMatrix(f2)]);
          await classifyAndStoreTwoFiles(
            { name: f1.name, file: f1, matrix: m1 },
            { name: f2.name, file: f2, matrix: m2 }
          );
        } catch (err: any) {
          alert(`Error parsing uploaded files: ${err?.message || 'Unknown error'}`);
          setIsProcessingOriginal(false);
          setIsProcessingFinal(false);
        }
      } else if (fileArray.length === 1) {
        const singleFile = fileArray[0];
        if (targetPreference === 'original') {
          processOriginalFile(singleFile);
        } else if (targetPreference === 'final') {
          processFinalFile(singleFile);
        } else {
          if (!originalFile.result) {
            processOriginalFile(singleFile);
          } else {
            processFinalFile(singleFile);
          }
        }
      }
    },
    [parseFileToMatrix, classifyAndStoreTwoFiles, processOriginalFile, processFinalFile, originalFile.result]
  );

  // Handle Original File Upload via input
  const handleOriginalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleMultipleOrSingleUpload(e.target.files, 'original');
    }
  };

  // Handle Final File Upload via input
  const handleFinalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleMultipleOrSingleUpload(e.target.files, 'final');
    }
  };

  // Dual file input handler
  const handleDualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleMultipleOrSingleUpload(e.target.files);
    }
  };

  // Drag and drop event handlers
  const handleDragOverOriginal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOriginal(true);
  };

  const handleDragLeaveOriginal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOriginal(false);
  };

  const handleDropOriginal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOriginal(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleOrSingleUpload(e.dataTransfer.files, 'original');
    }
  };

  const handleDragOverFinal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFinal(true);
  };

  const handleDragLeaveFinal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFinal(false);
  };

  const handleDropFinal = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFinal(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleOrSingleUpload(e.dataTransfer.files, 'final');
    }
  };

  // Clipboard Paste handler for buttons or global shortcuts
  const handlePasteClipboardData = useCallback(async (targetType?: 'original' | 'final') => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const matrix = parseTextToMatrix(text);
          if (matrix.length > 0) {
            // Check if pasted text contains two separate tables
            const dualTables = checkForTwoMatricesInText(matrix);
            if (dualTables) {
              await classifyAndStoreTwoFiles(
                { name: `Pasted_Table_1_${new Date().toLocaleTimeString().replace(/:/g, '')}.csv`, matrix: dualTables.matrixA },
                { name: `Pasted_Table_2_${new Date().toLocaleTimeString().replace(/:/g, '')}.csv`, matrix: dualTables.matrixB }
              );
              return;
            }

            const fileType = targetType || (!originalFile.result ? 'original' : 'final');
            const fileName = `Pasted_${fileType === 'original' ? 'Original' : 'Final'}_Log_${new Date().toLocaleTimeString().replace(/:/g, '')}.csv`;
            const result = validateBmsFile(matrix, fileName, fileType);

            if (fileType === 'original') {
              setOriginalFile({ file: null, fileName, matrix, result });
            } else {
              setFinalFile({ file: null, fileName, matrix, result });
            }
            setPasteNotification(`Pasted spreadsheet data into ${fileType === 'original' ? 'Original Hi-Res' : 'Final Recoded'} log!`);
            setTimeout(() => setPasteNotification(null), 3000);
            return;
          }
        }
      }
    } catch (e) {
      // Ignore security block, fallback to keyboard event or manual paste prompt
    }
  }, [originalFile.result, parseTextToMatrix, classifyAndStoreTwoFiles]);

  // Helper to detect if matrix contains two distinct table blocks
  function checkForTwoMatricesInText(fullMatrix: (string | number)[][]) {
    if (fullMatrix.length < 4) return null;
    const headerIndices: number[] = [];
    fullMatrix.forEach((row, rIdx) => {
      if (!row) return;
      const rowStr = row.map(cell => String(cell ?? '').toLowerCase()).join(' ');
      if (rowStr.includes('thumbnail') || rowStr.includes('name (mandatory)') || rowStr.includes('brag status')) {
        headerIndices.push(rIdx);
      }
    });

    if (headerIndices.length >= 2) {
      const idx1 = headerIndices[0];
      const idx2 = headerIndices[1];
      if (idx2 > idx1 + 1) {
        const matrixA = fullMatrix.slice(idx1, idx2);
        const matrixB = fullMatrix.slice(idx2);
        return { matrixA, matrixB };
      }
    }
    return null;
  }

  // Global window Paste event listener
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Check for pasted file(s)
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        if (e.clipboardData.files.length >= 2) {
          handleMultipleOrSingleUpload(e.clipboardData.files);
        } else {
          const file = e.clipboardData.files[0];
          if (!originalFile.result) {
            processOriginalFile(file);
          } else {
            processFinalFile(file);
          }
        }
        return;
      }

      // Check for pasted tabular text
      if (e.clipboardData && e.clipboardData.getData) {
        const text = e.clipboardData.getData('text');
        if (text && text.trim()) {
          const matrix = parseTextToMatrix(text);
          if (matrix.length > 0) {
            const dualTables = checkForTwoMatricesInText(matrix);
            if (dualTables) {
              classifyAndStoreTwoFiles(
                { name: `Pasted_Table_1_${new Date().toLocaleTimeString().replace(/:/g, '')}.csv`, matrix: dualTables.matrixA },
                { name: `Pasted_Table_2_${new Date().toLocaleTimeString().replace(/:/g, '')}.csv`, matrix: dualTables.matrixB }
              );
              return;
            }

            const fileType = !originalFile.result ? 'original' : 'final';
            const fileName = `Pasted_${fileType === 'original' ? 'Original' : 'Final'}_Log_${new Date().toLocaleTimeString().replace(/:/g, '')}.csv`;
            const result = validateBmsFile(matrix, fileName, fileType);

            if (fileType === 'original') {
              setOriginalFile({ file: null, fileName, matrix, result });
            } else {
              setFinalFile({ file: null, fileName, matrix, result });
            }
            setPasteNotification(`Pasted spreadsheet content into ${fileType === 'original' ? 'Original Hi-Res' : 'Final Recoded'} slot!`);
            setTimeout(() => setPasteNotification(null), 3000);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [originalFile.result, processOriginalFile, processFinalFile, parseTextToMatrix, handleMultipleOrSingleUpload, classifyAndStoreTwoFiles]);

  // Cross-file validation result when both files are loaded
  const crossResult: BmsCrossValidationResult | null = useMemo(() => {
    if (originalFile.result && finalFile.result) {
      return performCrossValidation(originalFile.result, finalFile.result);
    }
    return null;
  }, [originalFile.result, finalFile.result]);

  // Combined issues list
  const allIssues: BmsIssue[] = useMemo(() => {
    const list: BmsIssue[] = [];
    if (originalFile.result) {
      list.push(...originalFile.result.issues);
    }
    if (finalFile.result) {
      list.push(...finalFile.result.issues);
    }
    if (crossResult) {
      list.push(...crossResult.issues);
    }
    return list;
  }, [originalFile.result, finalFile.result, crossResult]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    return allIssues.filter(issue => {
      if (activeFileFilter !== 'all' && issue.fileType !== activeFileFilter) return false;
      if (activeCategoryFilter !== 'all' && issue.category !== activeCategoryFilter) return false;
      if (activeSeverityFilter !== 'all' && issue.severity !== activeSeverityFilter) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = issue.assetName?.toLowerCase().includes(term);
        const matchField = issue.field?.toLowerCase().includes(term);
        const matchMsg = issue.message.toLowerCase().includes(term);
        const matchVal = issue.currentValue?.toLowerCase().includes(term);
        const matchFile = issue.fileName.toLowerCase().includes(term);
        if (!matchName && !matchField && !matchMsg && !matchVal && !matchFile) {
          return false;
        }
      }
      return true;
    });
  }, [allIssues, activeFileFilter, activeCategoryFilter, activeSeverityFilter, searchTerm]);

  // Compute validation health scores
  const getHealthScore = (res: BmsFileValidationResult | null) => {
    if (!res || res.totalRows === 0) return 0;
    const errorsCount = res.issues.filter(i => i.severity === 'error').length;
    const totalPossible = res.totalRows * 5; // ~5 primary check points per row
    const penalty = Math.min(totalPossible, errorsCount);
    return Math.max(0, Math.round(((totalPossible - penalty) / totalPossible) * 100));
  };

  const origScore = getHealthScore(originalFile.result);
  const finalScore = getHealthScore(finalFile.result);

  // Active validation mode text
  const currentMode = useMemo(() => {
    if (originalFile.result && finalFile.result) {
      return {
        type: 'both',
        label: 'Dual-File Cross-Validation Mode',
        desc: 'Validating Original Hi-Res & Final Recoded logs + Cross-matching assets.',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    } else if (originalFile.result) {
      return {
        type: 'original',
        label: 'Original Hi-Res Mode',
        desc: 'Validating single Original Hi-Res log file. You can upload the Final Recoded file anytime.',
        color: 'bg-blue-100 text-blue-800 border-blue-300',
      };
    } else if (finalFile.result) {
      return {
        type: 'final',
        label: 'Final Recoded Mode',
        desc: 'Validating single Final Recoded log file. You can upload the Original Hi-Res file anytime.',
        color: 'bg-purple-100 text-purple-800 border-purple-300',
      };
    }
    return null;
  }, [originalFile.result, finalFile.result]);

  // Export BMS validation report as Excel workbook matching the interface tabs & columns exactly
  const handleExportValidationReport = () => {
    try {
      // @ts-ignore
      const XLSX = window.XLSX;
      if (!XLSX) return;

      const workbook = XLSX.utils.book_new();
      let hasAddedSheet = false;

      // 1. Original Hi-Res Issues Sheet (matches UI Original tab)
      if (originalFile.result) {
        const origRows = [
          ['Row', 'Field', 'Current Value', 'Issue Explanation'],
          ...originalFile.result.issues.map(i => [
            i.rowIndex ? `Row ${i.rowIndex}` : i.excelRow ? `Row ${i.excelRow}` : 'Header',
            i.field || 'General',
            i.currentValue !== undefined && i.currentValue !== '' ? i.currentValue : '(blank)',
            i.message,
          ])
        ];
        const origWs = XLSX.utils.aoa_to_sheet(origRows);
        origWs['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 75 }];
        XLSX.utils.book_append_sheet(workbook, origWs, 'Original Hi-Res Issues');
        hasAddedSheet = true;
      }

      // 2. Final Recoded Issues Sheet (matches UI Final Recoded tab)
      if (finalFile.result) {
        const finalRows = [
          ['Row', 'Field', 'Current Value', 'Issue Explanation'],
          ...finalFile.result.issues.map(i => [
            i.rowIndex ? `Row ${i.rowIndex}` : i.excelRow ? `Row ${i.excelRow}` : 'Header',
            i.field || 'General',
            i.currentValue !== undefined && i.currentValue !== '' ? i.currentValue : '(blank)',
            i.message,
          ])
        ];
        const finalWs = XLSX.utils.aoa_to_sheet(finalRows);
        finalWs['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 75 }];
        XLSX.utils.book_append_sheet(workbook, finalWs, 'Final Recoded Issues');
        hasAddedSheet = true;
      }

      // 3. Cross-Matching Discrepancies Sheet (matches UI Cross-Matching tab)
      if (crossResult) {
        const crossRows = [
          ['Orig Row', 'Final Row', 'Field', 'Original Value', 'Final Value', 'Issue Explanation'],
          ...crossResult.issues.map(i => [
            i.origRow || (i.rowIndex ? `Row ${i.rowIndex}` : '—'),
            i.finalRow || '—',
            i.field || 'General',
            i.origValue !== undefined && i.origValue !== '' ? i.origValue : i.currentValue || '(blank)',
            i.finalValue !== undefined && i.finalValue !== '' ? i.finalValue : '(blank)',
            i.message,
          ])
        ];
        const crossWs = XLSX.utils.aoa_to_sheet(crossRows);
        crossWs['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 75 }];
        XLSX.utils.book_append_sheet(workbook, crossWs, 'Cross-Matching Discrepancies');
        hasAddedSheet = true;
      }

      if (!hasAddedSheet) {
        alert('No validation data or issues available to export.');
        return;
      }

      XLSX.writeFile(workbook, `BMS_Validation_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error('Failed to export report:', e);
      alert('Failed to generate Excel report.');
    }
  };

  // Copy issues summary to clipboard
  const handleCopyIssuesSummary = () => {
    if (allIssues.length === 0) return;
    const summaryText = filteredIssues.map(i => 
      `[${i.severity.toUpperCase()}] Row ${i.rowIndex || 'N/A'} | ${i.assetName || 'N/A'} | ${i.field || 'General'}: ${i.message}`
    ).join('\n');

    navigator.clipboard.writeText(summaryText);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Handler to switch Original -> Final slot
  const handleSwitchOriginalToFinal = useCallback(() => {
    if (!originalFile.matrix || originalFile.matrix.length === 0) return;
    const newFinalResult = validateBmsFile(originalFile.matrix, originalFile.fileName, 'final');
    setFinalFile({
      file: originalFile.file,
      fileName: originalFile.fileName,
      matrix: originalFile.matrix,
      result: newFinalResult,
    });
    setOriginalFile({ file: null, fileName: '', matrix: [], result: null });
    setBypassedFinalLength(false);
    setPasteNotification(`Switched "${originalFile.fileName}" to Final Recoded slot.`);
    setTimeout(() => setPasteNotification(null), 3000);
  }, [originalFile]);

  // Handler to switch Final -> Original slot
  const handleSwitchFinalToOriginal = useCallback(() => {
    if (!finalFile.matrix || finalFile.matrix.length === 0) return;
    const newOrigResult = validateBmsFile(finalFile.matrix, finalFile.fileName, 'original');
    setOriginalFile({
      file: finalFile.file,
      fileName: finalFile.fileName,
      matrix: finalFile.matrix,
      result: newOrigResult,
    });
    setFinalFile({ file: null, fileName: '', matrix: [], result: null });
    setBypassedFinalLength(false);
    setPasteNotification(`Switched "${finalFile.fileName}" to Original Hi-Res slot.`);
    setTimeout(() => setPasteNotification(null), 3000);
  }, [finalFile]);

  // Handler to swap Original <-> Final slots
  const handleSwapFiles = useCallback(() => {
    if (!originalFile.matrix.length || !finalFile.matrix.length) return;
    const newOrigResult = validateBmsFile(finalFile.matrix, finalFile.fileName, 'original');
    const newFinalResult = validateBmsFile(originalFile.matrix, originalFile.fileName, 'final');

    setOriginalFile({
      file: finalFile.file,
      fileName: finalFile.fileName,
      matrix: finalFile.matrix,
      result: newOrigResult,
    });
    setFinalFile({
      file: originalFile.file,
      fileName: originalFile.fileName,
      matrix: originalFile.matrix,
      result: newFinalResult,
    });
    setBypassedFinalLength(false);
    setPasteNotification(`Swapped Original Hi-Res and Final Recoded slots!`);
    setTimeout(() => setPasteNotification(null), 3000);
  }, [originalFile, finalFile]);

  // Render Name Length Check Notification Banner
  const renderNameLengthCheckBanner = () => {
    const hasOrig = !!originalFile.result;
    const hasFinal = !!finalFile.result;

    if (!hasOrig && !hasFinal) return null;

    const origAnalysis = originalFile.result?.nameLengthAnalysis;
    const finalAnalysis = finalFile.result?.nameLengthAnalysis;

    // 1. Only Original loaded
    if (hasOrig && !hasFinal && origAnalysis) {
      if (origAnalysis.isUniformLength && origAnalysis.totalCount > 0) {
        return (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-amber-900 text-sm">File Placement Warning: Likely Final Recoded Log</h4>
                  <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px]">
                    All Names LEN = {origAnalysis.commonLength}
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-1 max-w-2xl leading-relaxed">
                  All {origAnalysis.totalCount} asset names in this Original Hi-Res slot have an identical character length ({origAnalysis.commonLength} chars). Fixed-length asset codes (e.g. <code>HU3WB148a.jpg</code>) are standard in <strong>Final Recoded</strong> logs! Would you like to switch this file to the Final Recoded slot?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={handleSwitchOriginalToFinal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Switch to Final Recoded Slot</span>
              </button>
            </div>
          </div>
        );
      }
    }

    // 2. Only Final loaded
    if (!hasOrig && hasFinal && finalAnalysis) {
      if (!finalAnalysis.isUniformLength && !bypassedFinalLength && finalAnalysis.totalCount > 0) {
        return (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm animate-fade-in space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-rose-900 text-sm">Validation Check: Name Character Lengths Must Be Uniform</h4>
                    <span className="bg-rose-200 text-rose-900 font-semibold px-2 py-0.5 rounded text-[11px]">
                      {finalAnalysis.outliers.length} Non-Standard Length(s)
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-1 max-w-2xl leading-relaxed">
                    In Final Recoded logs, all asset codes in <strong>Name (mandatory)</strong> must have identical character length. Expected standard length: <strong>{finalAnalysis.commonLength} chars</strong>. Found <strong>{finalAnalysis.outliers.length}</strong> row(s) with different character lengths.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => setShowOutlierList(!showOutlierList)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 font-semibold text-xs rounded-xl border border-rose-300 transition-colors"
                >
                  {showOutlierList ? 'Hide Non-Matching Rows' : `View ${finalAnalysis.outliers.length} Differing Rows`}
                </button>
                <button
                  onClick={handleSwitchFinalToOriginal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Switch to Original Slot</span>
                </button>
                <button
                  onClick={() => setBypassedFinalLength(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                >
                  Continue Anyway
                </button>
              </div>
            </div>

            {showOutlierList && (
              <div className="bg-white rounded-xl border border-rose-200 p-3 text-xs max-h-48 overflow-y-auto space-y-1.5">
                <div className="font-bold text-slate-700 pb-1 border-b border-slate-100 flex justify-between">
                  <span>Non-Matching Rows in Final Recoded Log (Expected LEN: {finalAnalysis.commonLength})</span>
                  <span className="text-slate-400">Total: {finalAnalysis.outliers.length}</span>
                </div>
                {finalAnalysis.outliers.map((out, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-rose-50/50 text-slate-700">
                    <span className="font-medium">Row {out.rowIndex}: <code className="bg-white px-1.5 py-0.5 rounded border border-rose-200 text-rose-800 font-mono">{out.value}</code></span>
                    <span className="font-semibold text-rose-700">LEN: {out.length} (Expected {finalAnalysis.commonLength})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
    }

    // 3. Both files loaded
    if (hasOrig && hasFinal && origAnalysis && finalAnalysis) {
      // Swapped check: Original is uniform, Final is NOT
      const isSwapped = origAnalysis.isUniformLength && !finalAnalysis.isUniformLength;

      if (isSwapped) {
        return (
          <div className="bg-indigo-50 border-2 border-indigo-400 rounded-2xl p-4 shadow-sm animate-fade-in flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-700 shrink-0">
                <ArrowLeftRight className="w-6 h-6 animate-pulse text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-indigo-950 text-sm">Detected Swapped Files!</h4>
                  <span className="bg-indigo-200 text-indigo-900 font-bold px-2 py-0.5 rounded text-[11px]">
                    Confirmation Requested
                  </span>
                </div>
                <p className="text-xs text-indigo-900 mt-1 max-w-2xl leading-relaxed">
                  The file in <strong>Original Hi-Res</strong> has uniform asset code lengths (LEN: {origAnalysis.commonLength}), while the <strong>Final Recoded</strong> file has variable length names. Whichever BMS has uniform character lengths must be Final Recoded!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={handleSwapFiles}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all hover:scale-[1.02]"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Swap Original &amp; Final Files</span>
              </button>
            </div>
          </div>
        );
      }

      // Check if Final has non-uniform lengths and not bypassed
      if (!finalAnalysis.isUniformLength && !bypassedFinalLength) {
        return (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm animate-fade-in space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-rose-900 text-sm">Final Recoded Name Length Check Failed</h4>
                    <span className="bg-rose-200 text-rose-900 font-semibold px-2 py-0.5 rounded text-[11px]">
                      {finalAnalysis.outliers.length} Non-Matching Rows
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-1 max-w-2xl leading-relaxed">
                    Final Recoded asset codes must all be of uniform character length (expected LEN: <strong>{finalAnalysis.commonLength}</strong>). Found {finalAnalysis.outliers.length} row(s) with varying lengths.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => setShowOutlierList(!showOutlierList)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 font-semibold text-xs rounded-xl border border-rose-300 transition-colors"
                >
                  {showOutlierList ? 'Hide Rows' : `View ${finalAnalysis.outliers.length} Differing Rows`}
                </button>
                <button
                  onClick={handleSwapFiles}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Swap Files</span>
                </button>
                <button
                  onClick={() => setBypassedFinalLength(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
                >
                  Continue Anyway
                </button>
              </div>
            </div>

            {showOutlierList && (
              <div className="bg-white rounded-xl border border-rose-200 p-3 text-xs max-h-48 overflow-y-auto space-y-1.5">
                <div className="font-bold text-slate-700 pb-1 border-b border-slate-100 flex justify-between">
                  <span>Non-Matching Rows in Final Recoded Log (Expected LEN: {finalAnalysis.commonLength})</span>
                  <span className="text-slate-400">Total: {finalAnalysis.outliers.length}</span>
                </div>
                {finalAnalysis.outliers.map((out, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-rose-50/50 text-slate-700">
                    <span className="font-medium">Row {out.rowIndex}: <code className="bg-white px-1.5 py-0.5 rounded border border-rose-200 text-rose-800 font-mono">{out.value}</code></span>
                    <span className="font-semibold text-rose-700">LEN: {out.length} (Expected {finalAnalysis.commonLength})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
    }

    return null;
  };

  const hasAnyFileUploaded =
    (originalFile.matrix && originalFile.matrix.length > 0) ||
    (finalFile.matrix && finalFile.matrix.length > 0) ||
    !!originalFile.fileName ||
    !!finalFile.fileName ||
    !!originalFile.result ||
    !!finalFile.result;

  const renderThinHeader = () => (
    <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-2 flex items-center justify-between shadow-2xs text-xs mb-3 flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <ShieldCheck className="w-4 h-4 text-indigo-600" />
        <span className="font-bold text-slate-800 text-xs sm:text-sm">BMS Log Validation Engine</span>
        {hasAnyFileUploaded && (
          <span className="hidden sm:inline-flex bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold text-[11px] border border-indigo-100">
            {[originalFile.result ? 'Original Hi-Res' : null, finalFile.result ? 'Final Recoded' : null].filter(Boolean).join(' + ')} Loaded
          </span>
        )}

        {/* OneDrive Connected Indicators & Refresh Buttons */}
        {originalFile.sourceUrl && (
          <div className="inline-flex items-center gap-1.5 bg-blue-50/90 text-blue-800 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border border-blue-200 shadow-2xs">
            <Globe className="w-3 h-3 text-blue-600" />
            <span>Original: OneDrive</span>
            <button
              onClick={() => handleFetchOnlineUrl(originalFile.sourceUrl!, 'original', true)}
              disabled={isProcessingOriginal}
              className="ml-1 flex items-center gap-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
              title="Re-read & refresh Original Hi-Res file from OneDrive link"
            >
              <RefreshCw className={`w-3 h-3 ${isProcessingOriginal ? 'animate-spin' : ''}`} />
              <span>{isProcessingOriginal ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        )}

        {finalFile.sourceUrl && (
          <div className="inline-flex items-center gap-1.5 bg-purple-50/90 text-purple-800 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border border-purple-200 shadow-2xs">
            <Globe className="w-3 h-3 text-purple-600" />
            <span>Final: OneDrive</span>
            <button
              onClick={() => handleFetchOnlineUrl(finalFile.sourceUrl!, 'final', true)}
              disabled={isProcessingFinal}
              className="ml-1 flex items-center gap-1 text-[10px] font-bold bg-purple-600 hover:bg-purple-700 text-white px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
              title="Re-read & refresh Final Recoded file from OneDrive link"
            >
              <RefreshCw className={`w-3 h-3 ${isProcessingFinal ? 'animate-spin' : ''}`} />
              <span>{isProcessingFinal ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAddLinkModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-300 shadow-2xs cursor-pointer"
          title="Add or update OneDrive Excel link"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>OneDrive Link</span>
        </button>

        <button
          onClick={handleClearAllData}
          disabled={!hasAnyFileUploaded}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors border shadow-2xs ${
            hasAnyFileUploaded
              ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 cursor-pointer'
              : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
          }`}
          title={hasAnyFileUploaded ? 'Clear all loaded spreadsheet data and reset validator' : 'No data loaded to clear'}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );

  const renderAddLinkModal = () => {
    if (!showAddLinkModal) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-base">OneDrive / Online Excel Link</h3>
            </div>
            <button
              onClick={() => setShowAddLinkModal(false)}
              className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Connect OneDrive or online Excel links for automatic data fetching and single-click <strong>Refresh</strong> capabilities.
          </p>

          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex justify-between">
                <span>Original Hi-Res File Link</span>
                {originalFile.sourceUrl && <span className="text-emerald-600 font-semibold text-[10px]">Connected</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={originalUrlInput}
                  onChange={(e) => setOriginalUrlInput(e.target.value)}
                  placeholder="https://1drv.ms/x/..."
                  className="flex-1 text-xs p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                />
                <button
                  type="button"
                  disabled={!originalUrlInput.trim() || isProcessingOriginal}
                  onClick={() => handleFetchOnlineUrl(originalUrlInput, 'original')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {isProcessingOriginal ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  <span>Fetch</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex justify-between">
                <span>Final Recoded File Link</span>
                {finalFile.sourceUrl && <span className="text-emerald-600 font-semibold text-[10px]">Connected</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={finalUrlInput}
                  onChange={(e) => setFinalUrlInput(e.target.value)}
                  placeholder="https://1drv.ms/x/..."
                  className="flex-1 text-xs p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 font-mono bg-white"
                />
                <button
                  type="button"
                  disabled={!finalUrlInput.trim() || isProcessingFinal}
                  onClick={() => handleFetchOnlineUrl(finalUrlInput, 'final')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {isProcessingFinal ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  <span>Fetch</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowAddLinkModal(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!hasAnyFileUploaded) {
    return (
      <div className="space-y-4 pb-12">
        {renderThinHeader()}

        {/* Paste Notification Banner */}
        {pasteNotification && (
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-fade-in max-w-2xl mx-auto">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardPaste className="w-5 h-5 text-indigo-200" />
              <span>{pasteNotification}</span>
            </div>
            <button
              onClick={() => setPasteNotification(null)}
              className="text-xs bg-indigo-700 hover:bg-indigo-800 px-2 py-1 rounded-md transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Contact Sheets style Upload Initial Workspace */}
        <div className="flex-grow flex flex-col items-center justify-center p-1 max-w-2xl mx-auto text-center mt-6 mb-12">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 border border-blue-100 shadow-2xs">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">Upload</h3>
          <p className="text-slate-600 text-sm mt-1 max-w-md">
            Import Original Hi-Res and Final Recoded asset spreadsheets (.xlsx, .csv) for automated BMS compliance validation.
          </p>

          <div className="mt-6 w-full max-w-lg">
            {/* Smart Dual-File Upload / Drop Zone */}
            <div
              onClick={() => dualInputRef.current?.click()}
              onDragOver={handleDragOverOriginal}
              onDragLeave={handleDragLeaveOriginal}
              onDrop={handleDropOriginal}
              className="w-full bg-gradient-to-r from-indigo-50/80 via-purple-50/80 to-blue-50/80 border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-xl p-3.5 mb-3 text-center cursor-pointer transition-all hover:shadow-sm group"
            >
              <input
                type="file"
                ref={dualInputRef}
                className="hidden"
                multiple
                accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                onChange={handleDualUpload}
                disabled={isProcessingOriginal || isProcessingFinal}
              />
              <div className="flex items-center justify-center gap-2 text-indigo-700 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                <span>Upload, Drop, or Paste 2 Files Together</span>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                  Auto-Detects Roles
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Select or drag both spreadsheets at once — automatically classified based on asset <strong className="text-slate-700 font-semibold">Name</strong> consistency.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center w-full">
              {/* Slot 1: Original Hi-Res File */}
              <div
                onClick={() => originalInputRef.current?.click()}
                onDragOver={handleDragOverOriginal}
                onDragLeave={handleDragLeaveOriginal}
                onDrop={handleDropOriginal}
                className={`flex-1 cursor-pointer p-4 border border-dashed ${
                  isDraggingOriginal
                    ? 'border-blue-600 bg-blue-50/80 ring-4 ring-blue-100 scale-[1.01]'
                    : 'border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50'
                } rounded-xl transition-all text-center flex flex-col items-center justify-center group shadow-2xs`}
              >
                <input
                  type="file"
                  ref={originalInputRef}
                  className="hidden"
                  multiple
                  accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                  onChange={handleOriginalUpload}
                  disabled={isProcessingOriginal}
                />
                <FileSpreadsheet className="w-7 h-7 text-slate-400 group-hover:text-blue-500 mb-1.5 transition-colors" />
                <span className="font-semibold text-xs text-slate-700 group-hover:text-blue-700">Original Hi-Res File</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Upload original log</span>
                {isProcessingOriginal && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing...</span>
                  </div>
                )}
              </div>

              {/* Slot 2: Final Recoded File */}
              <div
                onClick={() => finalInputRef.current?.click()}
                onDragOver={handleDragOverFinal}
                onDragLeave={handleDragLeaveFinal}
                onDrop={handleDropFinal}
                className={`flex-1 cursor-pointer p-4 border border-dashed ${
                  isDraggingFinal
                    ? 'border-purple-600 bg-purple-50/80 ring-4 ring-purple-100 scale-[1.01]'
                    : 'border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50'
                } rounded-xl transition-all text-center flex flex-col items-center justify-center group shadow-2xs`}
              >
                <input
                  type="file"
                  ref={finalInputRef}
                  className="hidden"
                  multiple
                  accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                  onChange={handleFinalUpload}
                  disabled={isProcessingFinal}
                />
                <FileSpreadsheet className="w-7 h-7 text-slate-400 group-hover:text-blue-500 mb-1.5 transition-colors" />
                <span className="font-semibold text-xs text-slate-700 group-hover:text-blue-700">Final Recoded File</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Upload recoded log</span>
                {isProcessingFinal && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-600 font-semibold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 w-full max-w-lg">
            {/* OneDrive / Online Excel Link Expandable Box */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs text-left">
              <button
                type="button"
                onClick={() => setShowOneDriveBox(!showOneDriveBox)}
                className="flex items-center justify-between w-full font-medium text-xs text-slate-700 hover:text-indigo-600 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold text-slate-800">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span>Add OneDrive / Online Excel Link</span>
                </span>
                <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {showOneDriveBox ? 'Hide' : '+ Add Link'}
                </span>
              </button>

              {showOneDriveBox && (
                <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Paste your OneDrive, SharePoint, or Google Sheets link below. The tool reads the live content, and you can click <strong>Refresh</strong> anytime to update the data.
                  </p>

                  <div className="space-y-3">
                    {/* Original Hi-Res OneDrive Link */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Original Hi-Res Link</span>
                        <span className="text-[10px] text-blue-600 font-medium bg-blue-100/70 px-1.5 py-0.2 rounded">Slot 1</span>
                      </label>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <Link className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="url"
                            value={originalUrlInput}
                            onChange={(e) => setOriginalUrlInput(e.target.value)}
                            placeholder="https://1drv.ms/x/... or SharePoint link"
                            className="w-full text-xs p-1.5 pl-8 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!originalUrlInput.trim() || isProcessingOriginal}
                          onClick={() => handleFetchOnlineUrl(originalUrlInput, 'original')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-xs disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {isProcessingOriginal ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Globe className="w-3.5 h-3.5" />
                          )}
                          <span>Fetch</span>
                        </button>
                      </div>
                    </div>

                    {/* Final Recoded OneDrive Link */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Final Recoded Link</span>
                        <span className="text-[10px] text-purple-600 font-medium bg-purple-100/70 px-1.5 py-0.2 rounded">Slot 2</span>
                      </label>
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <Link className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="url"
                            value={finalUrlInput}
                            onChange={(e) => setFinalUrlInput(e.target.value)}
                            placeholder="https://1drv.ms/x/... or SharePoint link"
                            className="w-full text-xs p-1.5 pl-8 border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!finalUrlInput.trim() || isProcessingFinal}
                          onClick={() => handleFetchOnlineUrl(finalUrlInput, 'final')}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md text-xs disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          {isProcessingFinal ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Globe className="w-3.5 h-3.5" />
                          )}
                          <span>Fetch</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={() => handlePasteClipboardData('original')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 mx-auto"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Or click to paste copied spreadsheet table data (Ctrl+V)</span>
            </button>
          </div>
        </div>

        {renderAddLinkModal()}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {renderThinHeader()}

      {/* Paste Notification Banner */}
      {pasteNotification && (
        <div className="bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardPaste className="w-5 h-5 text-indigo-200" />
            <span>{pasteNotification}</span>
          </div>
          <button
            onClick={() => setPasteNotification(null)}
            className="text-xs bg-indigo-700 hover:bg-indigo-800 px-2 py-1 rounded-md transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Smart Name Length Check Banner */}
      {renderNameLengthCheckBanner()}

      {/* Main LR-Style Interface Container with Left Sidebar */}
      <div className="bg-white rounded-2xl shadow-lg p-2 sm:p-3 border border-slate-200 flex gap-2 transition-all duration-300">
        {/* Left Navigation Rail / Sidebar */}
        <aside className={`flex-shrink-0 border-r border-slate-200 transition-all duration-300 ease-in-out ${isNavExpanded ? 'w-56' : 'w-[35px]'}`}>
          <nav
            className="flex flex-col h-full py-1 pr-1 space-y-2 pl-[4px]"
            style={{ width: isNavExpanded ? undefined : '35px', paddingLeft: '4px' }}
          >
            {/* Collapse/Expand Toggle Button */}
            <div className="mb-2 border-b border-slate-200 pb-2 flex justify-center">
              <button
                onClick={() => setIsNavExpanded(!isNavExpanded)}
                className="w-full flex justify-center items-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors pb-2"
                style={{ paddingLeft: '0px', paddingRight: '3px', paddingTop: '8px' }}
                aria-label={isNavExpanded ? "Collapse navigation" : "Expand navigation"}
                title={isNavExpanded ? "Collapse sidebar" : "Expand sidebar"}
              >
                <MenuIcon className="w-6 h-6 text-slate-700" />
              </button>
            </div>

            {/* Sidebar Navigation Options */}
            <ul className="space-y-1.5 flex-1">
              {/* Option 1: Issues and Flags (First option in sidebar) */}
              <BmsNavItem
                icon={<AlertTriangle className={`w-5 h-5 flex-shrink-0 ${activeTab === 'issues' ? 'text-indigo-600' : 'text-amber-500'}`} />}
                label="Issues & Flags"
                isExpanded={isNavExpanded}
                isActive={activeTab === 'issues'}
                onClick={() => setActiveTab('issues')}
                badgeCount={allIssues.length}
                badgeColor="bg-red-500 text-white"
              />

              {/* Option 2: Original Hi-Res Sheet */}
              <BmsNavItem
                icon={<Table className={`w-5 h-5 flex-shrink-0 ${activeTab === 'data_original' ? 'text-indigo-600' : 'text-indigo-500'}`} />}
                label="Original Hi-Res Sheet"
                isExpanded={isNavExpanded}
                isActive={activeTab === 'data_original'}
                onClick={() => setActiveTab('data_original')}
                badgeCount={originalFile.result?.totalRows}
                badgeColor="bg-indigo-100 text-indigo-800"
              />

              {/* Option 3: Final Recoded Sheet */}
              <BmsNavItem
                icon={<Table className={`w-5 h-5 flex-shrink-0 ${activeTab === 'data_final' ? 'text-purple-600' : 'text-purple-500'}`} />}
                label="Final Recoded Sheet"
                isExpanded={isNavExpanded}
                isActive={activeTab === 'data_final'}
                onClick={() => setActiveTab('data_final')}
                badgeCount={finalFile.result?.totalRows}
                badgeColor="bg-purple-100 text-purple-800"
              />

              {/* Option 4: Validation Rulebook */}
              <BmsNavItem
                icon={<Info className={`w-5 h-5 flex-shrink-0 ${activeTab === 'rules' ? 'text-slate-800' : 'text-slate-500'}`} />}
                label="Validation Rulebook"
                isExpanded={isNavExpanded}
                isActive={activeTab === 'rules'}
                onClick={() => setActiveTab('rules')}
              />
            </ul>
          </nav>
        </aside>

        {/* Right Main Content View */}
        <div className="flex-grow min-w-0 space-y-5 p-2">
          {/* Upload Dropzones Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Upload Slot 1: Original Hi-Res */}
            <div
              onDragOver={handleDragOverOriginal}
              onDragLeave={handleDragLeaveOriginal}
              onDrop={handleDropOriginal}
              className={`bg-white rounded-xl border transition-all p-3 shadow-2xs ${
                isDraggingOriginal
                  ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-100'
                  : originalFile.result
                  ? 'border-indigo-200 bg-indigo-50/10'
                  : 'border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[11px] flex-shrink-0">
                    1
                  </span>
                  <h3 className="font-bold text-slate-800 text-xs truncate">Original Hi-Res File</h3>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {originalFile.result && (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      origScore >= 90 ? 'bg-emerald-100 text-emerald-800' : origScore >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {origScore}% Health
                    </span>
                  )}
                  {!originalFile.result ? (
                    <button
                      type="button"
                      onClick={() => handlePasteClipboardData('original')}
                      className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[11px] font-semibold transition-colors border border-indigo-200"
                      title="Paste copied file or Excel table data"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>Paste</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setOriginalFile({ file: null, fileName: '', matrix: [], result: null })}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      title="Remove Original File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {!originalFile.result ? (
                <label className={`border border-dashed ${
                  isDraggingOriginal ? 'border-indigo-600 bg-indigo-100/40' : 'border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/30'
                } rounded-lg p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all`}>
                  <FileSpreadsheet className={`w-4 h-4 ${isDraggingOriginal ? 'text-indigo-600 animate-bounce' : 'text-indigo-500'}`} />
                  <span className="text-xs text-slate-700 font-medium truncate">
                    {isDraggingOriginal ? 'Drop file here' : 'Drag & drop or browse (.xlsx, .csv)'}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                    onChange={handleOriginalUpload}
                    disabled={isProcessingOriginal}
                    className="hidden"
                  />
                  {isProcessingOriginal && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 ml-1" />
                  )}
                </label>
              ) : (
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="font-bold text-slate-800 truncate max-w-[140px]" title={originalFile.fileName}>
                      {originalFile.fileName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 flex-shrink-0">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                      Header #{originalFile.result.headerInfo.headerRowIndex + 1}
                    </span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">
                      Rows: {originalFile.result.totalRows}
                    </span>
                    <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold text-emerald-700">
                      Valid: {originalFile.result.validRowsCount}
                    </span>
                    <span className="bg-red-50 px-1.5 py-0.5 rounded border border-red-200 font-semibold text-red-700">
                      Issues: {originalFile.result.issues.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Slot 2: Final Recoded */}
            <div
              onDragOver={handleDragOverFinal}
              onDragLeave={handleDragLeaveFinal}
              onDrop={handleDropFinal}
              className={`bg-white rounded-xl border transition-all p-3 shadow-2xs ${
                isDraggingFinal
                  ? 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-100'
                  : finalFile.result
                  ? 'border-purple-200 bg-purple-50/10'
                  : 'border-slate-200 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-5 h-5 rounded bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[11px] flex-shrink-0">
                    2
                  </span>
                  <h3 className="font-bold text-slate-800 text-xs truncate">Final Recoded File</h3>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {finalFile.result && (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      finalScore >= 90 ? 'bg-emerald-100 text-emerald-800' : finalScore >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {finalScore}% Health
                    </span>
                  )}
                  {!finalFile.result ? (
                    <button
                      type="button"
                      onClick={() => handlePasteClipboardData('final')}
                      className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-[11px] font-semibold transition-colors border border-purple-200"
                      title="Paste copied file or Excel table data"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>Paste</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setFinalFile({ file: null, fileName: '', matrix: [], result: null })}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                      title="Remove Final File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {!finalFile.result ? (
                <label className={`border border-dashed ${
                  isDraggingFinal ? 'border-purple-600 bg-purple-100/40' : 'border-slate-300 hover:border-purple-500 bg-slate-50 hover:bg-purple-50/30'
                } rounded-lg p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all`}>
                  <FileSpreadsheet className={`w-4 h-4 ${isDraggingFinal ? 'text-purple-600 animate-bounce' : 'text-purple-500'}`} />
                  <span className="text-xs text-slate-700 font-medium truncate">
                    {isDraggingFinal ? 'Drop file here' : 'Drag & drop or browse (.xlsx, .csv)'}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.xlsm,.xlsb,.csv"
                    onChange={handleFinalUpload}
                    disabled={isProcessingFinal}
                    className="hidden"
                  />
                  {isProcessingFinal && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600 ml-1" />
                  )}
                </label>
              ) : (
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span className="font-bold text-slate-800 truncate max-w-[140px]" title={finalFile.fileName}>
                      {finalFile.fileName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 flex-shrink-0">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                      Header #{finalFile.result.headerInfo.headerRowIndex + 1}
                    </span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">
                      Rows: {finalFile.result.totalRows}
                    </span>
                    <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold text-emerald-700">
                      Valid: {finalFile.result.validRowsCount}
                    </span>
                    <span className="bg-red-50 px-1.5 py-0.5 rounded border border-red-200 font-semibold text-red-700">
                      Issues: {finalFile.result.issues.length}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* Active View Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* TAB 1: Issues View */}
          {activeTab === 'issues' && (
            <div className="p-4 space-y-4">
              {/* Three Main Sub-Tabs & Action Buttons in same row */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Tab 1: Original */}
                  <button
                    onClick={() => setIssuesSubTab('original')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      issuesSubTab === 'original'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Original</span>
                    {originalFile.result && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          issuesSubTab === 'original' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {originalFile.result.issues.length}
                      </span>
                    )}
                  </button>

                  {/* Tab 2: Final Recoded */}
                  <button
                    onClick={() => setIssuesSubTab('final')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      issuesSubTab === 'final'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Final Recoded</span>
                    {finalFile.result && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          issuesSubTab === 'final' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {finalFile.result.issues.length}
                      </span>
                    )}
                  </button>

                  {/* Tab 3: Cross-Matching */}
                  <button
                    onClick={() => setIssuesSubTab('cross')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      issuesSubTab === 'cross'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>Cross-Matching</span>
                    {crossResult && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          issuesSubTab === 'cross' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {crossResult.issues.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Copy Summary and Export Report buttons in same row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyIssuesSummary}
                    disabled={allIssues.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSuccess ? 'Copied!' : 'Copy Summary'}</span>
                  </button>

                  <button
                    onClick={handleExportValidationReport}
                    disabled={allIssues.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report (.XLSX)</span>
                  </button>
                </div>
              </div>

              {/* Sub-Tab 1 Content: Original */}
              {issuesSubTab === 'original' && (
                <div>
                  {!originalFile.result ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                      No Original Hi-Res file uploaded yet. Upload or paste an Original Hi-Res file to view its self-contained issues.
                    </div>
                  ) : (
                    <ResizableIssueTable
                      issues={originalFile.result.issues}
                      emptyMessage="All compliance rules passed cleanly for the Original Hi-Res file!"
                    />
                  )}
                </div>
              )}

              {/* Sub-Tab 2 Content: Final Recoded */}
              {issuesSubTab === 'final' && (
                <div>
                  {!finalFile.result ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                      No Final Recoded file uploaded yet. Upload or paste a Final Recoded file to view its self-contained issues.
                    </div>
                  ) : (
                    <ResizableIssueTable
                      issues={finalFile.result.issues}
                      emptyMessage="All compliance rules passed cleanly for the Final Recoded file!"
                    />
                  )}
                </div>
              )}

              {/* Sub-Tab 3 Content: Cross-Matching */}
              {issuesSubTab === 'cross' && (
                <div>
                  {!crossResult ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                      Please upload both Original Hi-Res and Final Recoded logs to perform Cross-Matching.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ResizableCrossIssueTable
                        issues={crossResult.issues}
                        emptyMessage="No cross-matching discrepancies found between both logs!"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Original Data Sheet Preview */}
          {activeTab === 'data_original' && originalFile.result && (
            <EditableSpreadsheetViewer
              title="Original Hi-Res Spreadsheet Data"
              fileType="original"
              fileData={{
                fileName: originalFile.fileName,
                matrix: originalFile.matrix,
                result: originalFile.result,
                sourceUrl: originalFile.sourceUrl,
              }}
              onUpdateMatrix={(newMatrix) => {
                const newResult = validateBmsFile(newMatrix, originalFile.fileName, 'original');
                setOriginalFile((prev) => ({
                  ...prev,
                  matrix: newMatrix,
                  result: newResult,
                }));
              }}
              onRefreshFromLink={() => originalFile.sourceUrl && handleFetchOnlineUrl(originalFile.sourceUrl, 'original', true)}
              isRefreshing={isProcessingOriginal}
            />
          )}

          {/* TAB 3: Final Data Sheet Preview */}
          {activeTab === 'data_final' && finalFile.result && (
            <EditableSpreadsheetViewer
              title="Final Recoded Spreadsheet Data"
              fileType="final"
              fileData={{
                fileName: finalFile.fileName,
                matrix: finalFile.matrix,
                result: finalFile.result,
                sourceUrl: finalFile.sourceUrl,
              }}
              onUpdateMatrix={(newMatrix) => {
                const newResult = validateBmsFile(newMatrix, finalFile.fileName, 'final');
                setFinalFile((prev) => ({
                  ...prev,
                  matrix: newMatrix,
                  result: newResult,
                }));
              }}
              onRefreshFromLink={() => finalFile.sourceUrl && handleFetchOnlineUrl(finalFile.sourceUrl, 'final', true)}
              isRefreshing={isProcessingFinal}
            />
          )}

          {/* TAB 4: Validation Rulebook Reference */}
          {activeTab === 'rules' && (
            <div className="p-5 text-xs text-slate-700 space-y-4">
              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>BMS Validation Rules Specification</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <h5 className="font-bold text-slate-800 text-sm">Universal Sheet Structure</h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>Header row location is determined dynamically by finding the row containing cell <strong>"Thumbnail"</strong>.</li>
                    <li>Row index can begin anywhere (e.g. row 3, row 1), ignoring pre-header metadata or empty cells.</li>
                    <li>Data records start immediately below the header row.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <h5 className="font-bold text-slate-800 text-sm">Mandatory &amp; Read-Only Rules</h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>Title</strong> &amp; <strong>Supplier Asset ID</strong> must always be identical (ignoring scientific notation differences like <code>3.06228422E8</code> vs <code>306228422</code>).</li>
                    <li><strong>Name (mandatory)</strong> &amp; <strong>Supplier Name (mandatory)</strong> must never be blank.</li>
                    <li><strong>Original Creator</strong> is strictly enforced as mandatory.</li>
                    <li><strong>Status (mandatory)</strong> must equal <strong>"Final"</strong>.</li>
                    <li><strong>Type (read-only)</strong> can never be "general" and is expected to be "Image" in 99.99% of cases.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <h5 className="font-bold text-slate-800 text-sm">Cross-File Comparison Rules</h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>In the Final Recoded file, <strong>Name (mandatory)</strong> changes to an assigned asset code (e.g. <code>Getty-1490436783.jpg</code> becomes <code>HU3WB148a.jpg</code>).</li>
                    <li>Except for <strong>Name (mandatory)</strong>, literally <strong>every other value across all columns</strong> must match the Original Hi-Res file.</li>
                    <li>Scientific notation numbers in asset IDs or numeric fields are normalized during comparison.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <h5 className="font-bold text-slate-800 text-sm">Media Type Conditional Rule</h5>
                  <p className="text-slate-600">
                    Only ONE media type header applies based on the <strong>Type (read-only)</strong> column:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>If Type = Image: <strong>Image Type (mandatory)</strong> must be <em>photo</em>, <em>illustration</em>, or <em>illustration vector</em>.</li>
                    <li>If Type = Audio: <strong>Audio Type (mandatory)</strong> is required.</li>
                    <li>If Type = Video: <strong>Video Type (mandatory)</strong> is required.</li>
                    <li>If Type = Multimedia: <strong>Multimedia Type (mandatory)</strong> is required.</li>
                    <li>If Type = Text: <strong>Text Type (mandatory)</strong> is required.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <h5 className="font-bold text-slate-800 text-sm">BRAG &amp; Metadata Status</h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>BRAG Status</strong> must be <em>Amber</em>, <em>Red</em>, or <em>Green</em>. It can <strong>NEVER be Black</strong>.</li>
                    <li><strong>Metadata Complete</strong> should be <em>TRUE</em>.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {renderAddLinkModal()}
    </div>
  );
};
