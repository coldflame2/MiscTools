import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { ParentTitleLog, ParentCrossAuditSummary, ParentCrossMatchResult } from '../services/parentLogMatcher';
import { processExcelFile, ExcelProcessingError } from '../services/excelProcessor';
import { 
  FileSpreadsheet, Upload, Trash2, CheckCircle2, AlertTriangle, XCircle, 
  Search, ExternalLink, RefreshCw, FileText, Check, AlertCircle, GripVertical
} from 'lucide-react';

interface ParentTitleAuditViewProps {
  parentLogs: ParentTitleLog[];
  onAddParentLog: (log: ParentTitleLog) => void;
  onRemoveParentLog: (logId: string) => void;
  auditSummary: ParentCrossAuditSummary | null;
  onInspectChildRow?: (excelRowNumber: number) => void;
  childFileName?: string;
  onReaudit?: () => void;
}

export const ParentTitleAuditView: React.FC<ParentTitleAuditViewProps> = ({
  parentLogs,
  onAddParentLog,
  onRemoveParentLog,
  auditSummary,
  onInspectChildRow,
  childFileName,
  onReaudit,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedParentLogId, setSelectedParentLogId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'discrepancy' | 'unmatched'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<ParentCrossMatchResult | null>(null);

  // Resizable Inspector width state (persisted in localStorage)
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('parent_audit_inspector_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 220 && val <= 800) return val;
      }
    } catch (e) {}
    return 320;
  });

  const [isResizing, setIsResizing] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resize drag handlers
  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      // Clamp width between 240px and 700px (or 60% of container)
      const maxAllowed = Math.min(700, containerRect.width * 0.65);
      const clamped = Math.max(220, Math.min(newWidth, maxAllowed));
      setInspectorWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('parent_audit_inspector_width', String(Math.round(inspectorWidth)));
      } catch (e) {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, inspectorWidth]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const processed = await processExcelFile(file);
      const newParentLog: ParentTitleLog = {
        id: `parent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileName: file.name,
        title: processed.title || file.name.replace(/\.[^/.]+$/, ''),
        isbn: processed.isbn,
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rawData: processed.rawData,
        headerRowIndex: processed.headerRowIndex,
        columnIndices: processed.columnIndices,
        records: processed.records,
      };

      onAddParentLog(newParentLog);
    } catch (err: any) {
      if (err instanceof ExcelProcessingError) {
        setUploadError(`Failed to process parent log: ${err.message}`);
      } else {
        setUploadError(err.message || 'Error processing parent file');
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Filtered results
  const filteredResults = useMemo(() => {
    if (!auditSummary?.results) return [];
    return auditSummary.results.filter(res => {
      // Filter by parent log
      if (selectedParentLogId !== 'all') {
        if (res.parentLogId !== selectedParentLogId) return false;
      }

      // Filter by status
      if (statusFilter === 'verified' && !res.isVerified) return false;
      if (statusFilter === 'discrepancy' && (res.isVerified || res.matchConfidence === 'unmatched')) return false;
      if (statusFilter === 'unmatched' && res.matchConfidence !== 'unmatched') return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = 
          res.childPageNumber.toLowerCase().includes(q) ||
          res.childImageNo.toLowerCase().includes(q) ||
          res.childDescription.toLowerCase().includes(q) ||
          res.childSource.toLowerCase().includes(q) ||
          (res.parentImageNo && res.parentImageNo.toLowerCase().includes(q)) ||
          (res.parentSource && res.parentSource.toLowerCase().includes(q)) ||
          (res.parentTitle && res.parentTitle.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [auditSummary, selectedParentLogId, statusFilter, searchQuery]);

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-slate-100/70 gap-1.5 p-1.5 animate-fade-in text-xs select-none ${isResizing ? 'cursor-col-resize' : ''}`}>
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded px-2.5 py-1 text-[11px] text-red-800 flex items-center justify-between shrink-0">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">×</button>
        </div>
      )}

      {/* 1. Single Compact Toolbar: Filters, Parent Log Chips, Upload & Search */}
      <div className="bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs flex flex-wrap items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Status Filter Buttons */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-sm">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded transition-colors ${
                statusFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Pickups ({auditSummary?.results.length ?? 0})
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                statusFilter === 'verified' ? 'bg-white text-emerald-800 font-bold shadow-2xs' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Verified ({auditSummary?.perfectMatchesCount ?? 0})</span>
            </button>
            <button
              onClick={() => setStatusFilter('discrepancy')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                statusFilter === 'discrepancy' ? 'bg-white text-amber-800 font-bold shadow-2xs' : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Mismatches ({auditSummary?.discrepanciesCount ?? 0})</span>
            </button>
            <button
              onClick={() => setStatusFilter('unmatched')}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                statusFilter === 'unmatched' ? 'bg-white text-red-800 font-bold shadow-2xs' : 'text-slate-600 hover:text-red-700'
              }`}
            >
              <XCircle className="w-3 h-3 text-red-600" />
              <span>Unmatched ({auditSummary?.unmatchedCount ?? 0})</span>
            </button>
          </div>

          {/* Multi-parent selector if more than 1 parent log */}
          {parentLogs.length > 1 && (
            <select
              value={selectedParentLogId}
              onChange={(e) => setSelectedParentLogId(e.target.value)}
              className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 font-medium focus:outline-none"
            >
              <option value="all">All Parents</option>
              {parentLogs.map(p => (
                <option key={p.id} value={p.id}>{p.title || p.fileName}</option>
              ))}
            </select>
          )}

          {/* Parent Logs count / chips */}
          {parentLogs.length > 0 && (
            <div className="hidden xl:flex items-center gap-1 border-l border-slate-200 pl-2">
              {parentLogs.map(log => (
                <div 
                  key={log.id} 
                  className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]"
                >
                  <FileSpreadsheet className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                  <span className="font-semibold max-w-[120px] truncate" title={log.title || log.fileName}>
                    {log.title || log.fileName}
                  </span>
                  <button
                    onClick={() => onRemoveParentLog(log.id)}
                    title="Remove parent log"
                    className="text-slate-400 hover:text-red-600 ml-0.5"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Controls: Search, Upload & Re-audit */}
        <div className="flex items-center gap-1.5 shrink-0 text-sm">
          <div className="relative w-36 sm:w-48 text-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full text-sm border border-slate-200 rounded pl-5 pr-2 py-0.5 focus:outline-none focus:border-indigo-500 bg-white shadow-2xs"
            />
            <Search className="w-3 h-3 text-slate-400 absolute left-1.5 top-2 pointer-events-none" />
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs shrink-0"
          >
            <Upload className="w-3 h-3" />
            <span>{isUploading ? 'Parsing...' : 'Upload Parent'}</span>
          </button>

          {onReaudit && (
            <button
              onClick={onReaudit}
              title="Re-run matching rules"
              className="p-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded transition-colors shadow-2xs shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Split Screen with Draggable Resize Handle */}
      <div ref={splitContainerRef} className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left: Dense Table of Matching Records */}
        <div className="flex-1 min-w-[280px] bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-2xs">
          <div className="px-2.5 py-1 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-600 shrink-0">
            <span>Pickup Records ({filteredResults.length})</span>
            <span className="text-[10px] text-slate-400">Click row to view diff · Drag divider to resize</span>
          </div>

          <div className="flex-1 overflow-auto">
            {filteredResults.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-slate-400">
                {parentLogs.length === 0 
                  ? 'Please upload a parent title log to cross-verify pickup images.' 
                  : 'No matching pickup records found matching current filters.'}
              </div>
            ) : (
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-1 px-1 text-center font-mono" style={{ width: '32px', minWidth: '28px' }}>#</th>
                    <th className="py-1 px-1.5 w-12">Page</th>
                    <th className="py-1 px-2 w-24">Asset ID</th>
                    <th className="py-1 px-2 w-32">Source & Rights</th>
                    <th className="py-1 px-2 w-28">Match Status</th>
                    <th className="py-1 px-2">Discrepancy Details</th>
                    <th className="py-1 px-1.5 w-10 text-center">Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map(item => {
                    const isSelected = selectedResult?.childRowIndex === item.childRowIndex;
                    return (
                      <tr 
                        key={item.childRowIndex}
                        onClick={() => setSelectedResult(item)}
                        className={`cursor-pointer transition-colors leading-tight ${
                          isSelected 
                            ? 'bg-blue-50/90' 
                            : item.isVerified 
                              ? 'hover:bg-slate-50' 
                              : item.matchConfidence === 'unmatched'
                                ? 'bg-red-50/20 hover:bg-red-50/40'
                                : 'bg-amber-50/20 hover:bg-amber-50/40'
                        }`}
                      >
                        <td className="py-1 px-1 text-center font-mono text-[10px] font-semibold text-slate-500 whitespace-nowrap" style={{ width: '32px' }}>
                          {item.childExcelRow}
                        </td>
                        <td className="py-1 px-1.5 font-medium text-slate-800 whitespace-nowrap">
                          {item.childPageNumber || '—'}
                        </td>
                        <td className="py-1 px-2 font-mono text-[10px] text-slate-700 truncate max-w-[100px]" title={item.childImageNo}>
                          {item.childImageNo || <span className="text-slate-300 italic">None</span>}
                        </td>
                        <td className="py-1 px-2">
                          <div className="font-semibold text-slate-800 truncate max-w-[120px]">{item.childSource || '—'}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{item.childRights || 'No rights'}</div>
                        </td>
                        <td className="py-1 px-2 whitespace-nowrap">
                          {item.isVerified ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              Verified
                            </span>
                          ) : item.matchConfidence === 'unmatched' ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-800 bg-red-100 px-1.5 py-0.2 rounded">
                              <XCircle className="w-2.5 h-2.5 text-red-600" />
                              Unmatched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              Mismatch ({item.discrepancies.length})
                            </span>
                          )}
                          {item.parentExcelRow && (
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              Parent #{item.parentExcelRow}
                            </div>
                          )}
                        </td>
                        <td className="py-1 px-2">
                          {item.discrepancies.length > 0 ? (
                            <div className="text-[10px] text-amber-900 line-clamp-1" title={item.discrepancies.join('\n')}>
                              {item.discrepancies[0]}
                              {item.discrepancies.length > 1 && (
                                <span className="text-amber-700 font-semibold ml-1">+{item.discrepancies.length - 1} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-700">Attributes match</span>
                          )}
                        </td>
                        <td className="py-1 px-1.5 text-center">
                          {onInspectChildRow && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectChildRow(item.childExcelRow);
                              }}
                              className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                              title={`Jump to row #${item.childExcelRow} in Uploaded Log`}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 3. Draggable Split Divider Handle */}
        <div
          onMouseDown={handleMouseDownResize}
          className={`w-2.5 hover:w-2.5 -mx-0.5 z-20 cursor-col-resize flex items-center justify-center transition-colors group shrink-0 ${
            isResizing ? 'bg-indigo-300' : 'hover:bg-indigo-200/80'
          }`}
          title="Drag to resize side-by-side difference pane"
        >
          <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors flex items-center justify-center">
            <GripVertical className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100" />
          </div>
        </div>

        {/* 4. Right: Resizable Dense Side-by-Side Comparison Inspector Card */}
        <div 
          style={{ width: `${inspectorWidth}px` }} 
          className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-2xs shrink-0 select-text"
        >
          <div className="px-2.5 py-1 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 text-[11px]">
            <span className="font-bold text-slate-700">
              {selectedResult ? `Row #${selectedResult.childExcelRow} Diff` : 'Side-by-Side Diff'}
            </span>
            {selectedResult && (
              <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                selectedResult.isVerified 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : selectedResult.matchConfidence === 'unmatched'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
              }`}>
                {selectedResult.isVerified ? 'VERIFIED' : selectedResult.matchConfidence === 'unmatched' ? 'UNMATCHED' : 'MISMATCH'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {!selectedResult ? (
              <div className="text-center py-10 text-slate-400 text-[11px]">
                <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                Select any row on the left to inspect side-by-side differences against the parent log.
              </div>
            ) : (
              <>
                {/* Parent Match Reference Pill */}
                <div className="px-2 py-1 rounded bg-indigo-50/70 border border-indigo-100 text-[11px]">
                  <div className="flex items-center justify-between font-semibold text-indigo-900">
                    <span className="truncate" title={selectedResult.parentTitle}>{selectedResult.parentTitle || 'Parent Title'}</span>
                    {selectedResult.parentExcelRow && (
                      <span className="font-mono text-[10px] bg-white text-indigo-700 px-1 rounded border border-indigo-200 shrink-0 ml-1">
                        Row #{selectedResult.parentExcelRow}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-indigo-600 mt-0.5">
                    Match by: <strong>{selectedResult.matchConfidence}</strong>
                  </div>
                </div>

                {/* Discrepancy Warnings Box */}
                {selectedResult.discrepancies.length > 0 && (
                  <div className="p-1.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-900">
                    <div className="font-bold flex items-center gap-1 text-amber-950 mb-0.5">
                      <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Discrepancies ({selectedResult.discrepancies.length}):</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 leading-tight">
                      {selectedResult.discrepancies.map((disc, idx) => (
                        <li key={idx}>{disc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Side-by-Side Field Comparisons */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-0.5">Attribute Comparison</div>
                  {selectedResult.comparisons.map((c, i) => (
                    <div 
                      key={i} 
                      className={`px-1.5 py-1 rounded border text-[11px] ${
                        c.isMatch 
                          ? 'bg-slate-50/80 border-slate-200' 
                          : 'bg-amber-50/80 border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-700 text-[10px] mb-0.5">
                        <span>{c.label}</span>
                        {c.isMatch ? (
                          <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Match
                          </span>
                        ) : (
                          <span className="text-[9px] text-amber-800 font-bold flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" /> Mismatch
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                        <div className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          <span className="text-[8px] font-sans font-bold text-slate-400 block uppercase">Child</span>
                          <span className="text-slate-900 break-words">{c.childValue || <em className="text-slate-300">empty</em>}</span>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded border ${c.isMatch ? 'bg-white border-slate-200' : 'bg-amber-100 border-amber-300 font-bold text-amber-950'}`}>
                          <span className="text-[8px] font-sans font-bold text-slate-400 block uppercase">Parent</span>
                          <span className="break-words">{c.parentValue || <em className="text-slate-300">empty</em>}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Editorial Notes from Child Log */}
                {selectedResult.childNotes && (
                  <div className="p-1.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600">
                    <span className="font-bold text-slate-700 block mb-0.5">Child Row Notes:</span>
                    <p className="whitespace-pre-wrap">{selectedResult.childNotes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
