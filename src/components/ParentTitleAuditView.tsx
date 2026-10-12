import React, { useState, useMemo, useRef } from 'react';
import type { ParentTitleLog, ParentCrossAuditSummary, ParentCrossMatchResult } from '../services/parentLogMatcher';
import { processExcelFile, ExcelProcessingError } from '../services/excelProcessor';
import { 
  FileSpreadsheet, Upload, Trash2, CheckCircle2, AlertTriangle, XCircle, 
  Search, ArrowRight, ExternalLink, RefreshCw, FileText, Check, Copy, 
  ChevronRight, Filter, Eye, Layers, BookOpen, AlertCircle
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
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 1500);
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
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 gap-3 p-3 animate-fade-in">
      {/* 1. Header Banner & Parent Log Manager */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Parent Title Cross-Matching & Audit
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {parentLogs.length} Parent Log{parentLogs.length === 1 ? '' : 's'} Uploaded
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically matches and cross-verifies images sourced or picked up from parent book titles against their original photologs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Parsing Log...' : 'Upload Parent Log (.xlsx)'}</span>
          </button>

          {onReaudit && (
            <button
              onClick={onReaudit}
              title="Re-run matching rules"
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-2xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">×</button>
        </div>
      )}

      {/* 2. Uploaded Parent Title Badges */}
      {parentLogs.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide px-1">Active Parent Titles:</span>
          {parentLogs.map(log => (
            <div 
              key={log.id} 
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-300/80 px-2.5 py-1 rounded-lg text-xs text-slate-800 transition-colors shadow-2xs group"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-semibold max-w-[200px] truncate" title={log.title || log.fileName}>
                {log.title || log.fileName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">({log.records.length} rows)</span>
              <button
                onClick={() => onRemoveParentLog(log.id)}
                title="Remove parent log"
                className="opacity-60 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-0.5 ml-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-center shrink-0">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-2">
            <Upload className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-amber-900">No Parent Title Logs Uploaded Yet</h3>
          <p className="text-xs text-amber-700/90 max-w-lg mx-auto mt-1 mb-3">
            Upload the spreadsheet log of the parent book title/s above. The system will cross-verify each pickup image against the parent log to confirm source agencies, rights types, creator credits, and license requirements.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
          >
            Upload First Parent Log
          </button>
        </div>
      )}

      {/* 3. Summary Metrics Bar */}
      {auditSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup Images Found</div>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5 tabular-nums">
              {auditSummary.pickupRowsCount}
              <span className="text-[11px] font-normal text-slate-400 ml-1">in child log</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Matched in Parent</div>
            <div className="text-lg font-extrabold text-blue-700 mt-0.5 tabular-nums">
              {auditSummary.matchedCount}
              <span className="text-[11px] font-normal text-slate-400 ml-1">
                ({auditSummary.pickupRowsCount > 0 ? Math.round((auditSummary.matchedCount / auditSummary.pickupRowsCount) * 100) : 0}%)
              </span>
            </div>
          </div>

          <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Verified Match (100%)</div>
            <div className="text-lg font-extrabold text-emerald-700 mt-0.5 tabular-nums">
              {auditSummary.perfectMatchesCount}
            </div>
          </div>

          <div className="bg-white border border-amber-200 bg-amber-50/20 rounded-xl p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Discrepancies / Mismatches</div>
            <div className="text-lg font-extrabold text-amber-700 mt-0.5 tabular-nums">
              {auditSummary.discrepanciesCount}
            </div>
          </div>

          <div className="bg-white border border-red-200 bg-red-50/20 rounded-xl p-2.5 shadow-2xs">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Unmatched in Parent</div>
            <div className="text-lg font-extrabold text-red-700 mt-0.5 tabular-nums">
              {auditSummary.unmatchedCount}
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter & Search Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Segments */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Pickups ({auditSummary?.results.length ?? 0})
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'verified' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified ({auditSummary?.perfectMatchesCount ?? 0})</span>
            </button>
            <button
              onClick={() => setStatusFilter('discrepancy')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'discrepancy' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Discrepancies ({auditSummary?.discrepanciesCount ?? 0})</span>
            </button>
            <button
              onClick={() => setStatusFilter('unmatched')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                statusFilter === 'unmatched' ? 'bg-white text-red-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-red-700'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Unmatched ({auditSummary?.unmatchedCount ?? 0})</span>
            </button>
          </div>

          {/* Parent Log Filter Dropdown (if multiple parent logs) */}
          {parentLogs.length > 1 && (
            <select
              value={selectedParentLogId}
              onChange={(e) => setSelectedParentLogId(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Parent Title Logs</option>
              {parentLogs.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title || p.fileName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search page, asset ID, agency..."
            className="w-full text-xs border border-slate-300 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-2xs"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* 5. Main Split Screen: Cross-Comparison Table & Detail Inspector */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {/* Left: Table of Matching Records */}
        <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-2xs">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 shrink-0">
            <span>Pickup Records ({filteredResults.length})</span>
            <span className="text-[11px] text-slate-400">Click any row to view full side-by-side comparison</span>
          </div>

          <div className="flex-1 overflow-auto">
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching pickup records found matching current filters.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 sticky top-0 z-10 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2.5 w-16">Row #</th>
                    <th className="py-2 px-2.5 w-20">Page</th>
                    <th className="py-2 px-2.5 w-28">Asset ID</th>
                    <th className="py-2 px-2.5">Source & Rights</th>
                    <th className="py-2 px-2.5">Parent Match Status</th>
                    <th className="py-2 px-2.5">Discrepancy Details</th>
                    <th className="py-2 px-2.5 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map(item => {
                    const isSelected = selectedResult?.childRowIndex === item.childRowIndex;
                    return (
                      <tr 
                        key={item.childRowIndex}
                        onClick={() => setSelectedResult(item)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50/80' 
                            : item.isVerified 
                              ? 'hover:bg-slate-50' 
                              : item.matchConfidence === 'unmatched'
                                ? 'bg-red-50/20 hover:bg-red-50/40'
                                : 'bg-amber-50/20 hover:bg-amber-50/40'
                        }`}
                      >
                        <td className="py-2 px-2.5 font-mono font-semibold text-slate-600">
                          #{item.childExcelRow}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-800">
                          {item.childPageNumber || '—'}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700 truncate max-w-[120px]" title={item.childImageNo}>
                          {item.childImageNo || <span className="text-slate-300 italic">None</span>}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-semibold text-slate-900 truncate max-w-[140px]">{item.childSource || '—'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.childRights || 'No rights'}</div>
                        </td>
                        <td className="py-2 px-2.5">
                          {item.isVerified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Verified
                            </span>
                          ) : item.matchConfidence === 'unmatched' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-800 bg-red-100/90 px-2 py-0.5 rounded">
                              <XCircle className="w-3 h-3 text-red-600" />
                              Unmatched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Discrepancy ({item.discrepancies.length})
                            </span>
                          )}
                          {item.parentTitle && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5" title={item.parentTitle}>
                              Parent: {item.parentTitle} (Row #{item.parentExcelRow})
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {item.discrepancies.length > 0 ? (
                            <ul className="text-[11px] text-amber-900 space-y-0.5 list-disc list-inside line-clamp-2" title={item.discrepancies.join('\n')}>
                              {item.discrepancies.slice(0, 2).map((d, i) => (
                                <li key={i} className="truncate">{d}</li>
                              ))}
                              {item.discrepancies.length > 2 && (
                                <li className="text-[10px] text-amber-700 italic">+{item.discrepancies.length - 2} more...</li>
                              )}
                            </ul>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-medium">All parent attributes identical</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          {onInspectChildRow && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectChildRow(item.childExcelRow);
                              }}
                              className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                              title={`Inspect row #${item.childExcelRow} in full log`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
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

        {/* Right: Side-by-Side Comparison Inspector Card */}
        <div className="w-80 lg:w-96 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-2xs shrink-0">
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-800">
              {selectedResult ? `Comparison: Row #${selectedResult.childExcelRow}` : 'Field Comparison'}
            </span>
            {selectedResult && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                selectedResult.isVerified 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : selectedResult.matchConfidence === 'unmatched'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
              }`}>
                {selectedResult.isVerified ? 'VERIFIED' : selectedResult.matchConfidence === 'unmatched' ? 'UNMATCHED' : 'DISCREPANCY'}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {!selectedResult ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Select any row on the left to view full side-by-side comparison between the current log and parent log.
              </div>
            ) : (
              <>
                {/* Parent Match Reference */}
                <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs">
                  <div className="font-bold text-indigo-900 flex items-center justify-between">
                    <span>Parent Title Source:</span>
                    <span className="font-mono text-[10px] bg-white text-indigo-800 px-1.5 py-0.2 rounded border border-indigo-200">
                      Row #{selectedResult.parentExcelRow || '—'}
                    </span>
                  </div>
                  <p className="text-indigo-800 font-medium mt-0.5">
                    {selectedResult.parentTitle || 'Parent title not identified in log'}
                  </p>
                  <div className="text-[10px] text-indigo-600 mt-1 flex items-center gap-2">
                    <span>Match type: <strong>{selectedResult.matchConfidence}</strong></span>
                  </div>
                </div>

                {/* Discrepancy Warnings Box */}
                {selectedResult.discrepancies.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <div className="font-bold flex items-center gap-1.5 text-amber-950 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Discrepancies Detected ({selectedResult.discrepancies.length}):</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[11px]">
                      {selectedResult.discrepancies.map((disc, idx) => (
                        <li key={idx} className="leading-tight">{disc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Side-by-Side Field Comparisons */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Field Diff Comparison</div>
                  {selectedResult.comparisons.map((c, i) => (
                    <div 
                      key={i} 
                      className={`p-2 rounded-lg border text-xs ${
                        c.isMatch 
                          ? 'bg-slate-50 border-slate-200' 
                          : 'bg-amber-50/60 border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-700 mb-1">
                        <span>{c.label}</span>
                        {c.isMatch ? (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Match
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-800 font-bold flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" /> Mismatch
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-[9px] font-sans font-bold text-slate-400 block uppercase">Child Log:</span>
                          <span className="text-slate-900 break-words">{c.childValue || <em className="text-slate-300">empty</em>}</span>
                        </div>
                        <div className={`p-1.5 rounded border ${c.isMatch ? 'bg-white border-slate-200' : 'bg-amber-100/60 border-amber-300 font-bold text-amber-950'}`}>
                          <span className="text-[9px] font-sans font-bold text-slate-400 block uppercase">Parent Log:</span>
                          <span className="break-words">{c.parentValue || <em className="text-slate-300">empty</em>}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Editorial Notes from Child Log */}
                {selectedResult.childNotes && (
                  <div className="p-2.5 rounded-lg bg-slate-100 text-xs text-slate-700">
                    <span className="font-bold text-slate-800 block mb-0.5">Child Row Notes:</span>
                    <p className="text-[11px] font-sans whitespace-pre-wrap">{selectedResult.childNotes}</p>
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
