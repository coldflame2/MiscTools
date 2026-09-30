import React, { useState, useMemo } from 'react';
import type { AIFlaggedRecord, AIAnalysisStatus } from '../types';
import { ErrorIcon } from './icons/ErrorIcon';
import { SuccessIcon } from './icons/SuccessIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { CopyIcon } from './icons/CopyIcon';
import { FileSheetIcon } from './icons/FileSheetIcon';
import { Check, Search } from 'lucide-react';

interface GroupedValidation {
  groupedReasons: Map<string, AIFlaggedRecord[]>;
  individualReasons: { item: AIFlaggedRecord; reasons: string[] }[];
}

const groupValidationFlags = (flags: AIFlaggedRecord[]): GroupedValidation => {
  const groupablePrefixes = [
    "Image Used Too Many Times:",
    "Ambiguous Pair",
    "Inconsistent Pair"
  ];

  const isGroupableReason = (reason: string): boolean => {
    return groupablePrefixes.some(prefix => reason.startsWith(prefix));
  };

  const groupedReasons = new Map<string, AIFlaggedRecord[]>();
  const individualReasonsByRow = new Map<number, { item: AIFlaggedRecord; reasons: string[] }>();

  flags.forEach(flag => {
    const reasons = flag.reason ? flag.reason.split('|||') : [];
    const individualForRow: string[] = [];

    reasons.forEach(reason => {
      if (isGroupableReason(reason)) {
        const existingFlags = groupedReasons.get(reason) || [];
        if (!existingFlags.some(f => f.originalRowIndex === flag.originalRowIndex)) {
          existingFlags.push(flag);
          groupedReasons.set(reason, existingFlags);
        }
      } else {
        individualForRow.push(reason);
      }
    });

    if (individualForRow.length > 0) {
      if (!individualReasonsByRow.has(flag.originalRowIndex)) {
        individualReasonsByRow.set(flag.originalRowIndex, { item: flag, reasons: [] });
      }
      const existingReasons = individualReasonsByRow.get(flag.originalRowIndex)!.reasons;
      individualForRow.forEach(r => {
        if (!existingReasons.includes(r)) {
          existingReasons.push(r);
        }
      });
    }
  });

  const individualReasons = Array.from(individualReasonsByRow.values());
  return { groupedReasons, individualReasons };
};

export interface DataHealthViewProps {
  dataValidationFlags: AIFlaggedRecord[];
  aiAnalysisStatus: AIAnalysisStatus;
  aiFlags: AIFlaggedRecord[];
  onRunAiAnalysis: () => void;
  originalRecordCount: number;
  onNavigateToLog?: () => void;
}

export const DataHealthView: React.FC<DataHealthViewProps> = ({
  dataValidationFlags,
  aiAnalysisStatus,
  aiFlags,
  onRunAiAnalysis,
  originalRecordCount,
  onNavigateToLog,
}) => {
  const [copyValidationStatus, setCopyValidationStatus] = useState<'idle' | 'copied'>('idle');
  const [activeFilter, setActiveFilter] = useState<'all' | 'errors' | 'warnings' | 'ai'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Partition flags into strict errors vs warnings
  const { errorFlags, warningFlags } = useMemo(() => {
    const errors: AIFlaggedRecord[] = [];
    const warnings: AIFlaggedRecord[] = [];

    dataValidationFlags.forEach(flag => {
      const reasons = flag.reason ? flag.reason.split('|||') : [];
      const hasStrictError = reasons.some(r => !r.startsWith('[WARNING]'));
      if (hasStrictError) {
        errors.push(flag);
      } else {
        warnings.push(flag);
      }
    });

    return { errorFlags: errors, warningFlags: warnings };
  }, [dataValidationFlags]);

  // Filter based on search query
  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  const filteredErrorFlags = useMemo(() => {
    if (!searchQuery.trim()) return errorFlags;
    return errorFlags.filter(f => 
      matchesSearch(f.reason) ||
      matchesSearch(`row ${f.originalRowIndex + 1}`) ||
      matchesSearch(f.source || '') ||
      matchesSearch(f.acknowledgement || '') ||
      matchesSearch(f.pageNumber || '')
    );
  }, [errorFlags, searchQuery]);

  const filteredWarningFlags = useMemo(() => {
    if (!searchQuery.trim()) return warningFlags;
    return warningFlags.filter(f => 
      matchesSearch(f.reason) ||
      matchesSearch(`row ${f.originalRowIndex + 1}`) ||
      matchesSearch(f.source || '') ||
      matchesSearch(f.acknowledgement || '') ||
      matchesSearch(f.pageNumber || '')
    );
  }, [warningFlags, searchQuery]);

  const handleCopyValidationIssues = () => {
    if (dataValidationFlags.length === 0) return;

    const { groupedReasons, individualReasons } = groupValidationFlags(dataValidationFlags);
    let textToCopy = "Data Validation Issues & Warnings:\n\n";

    groupedReasons.forEach((flags, reason) => {
      const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
      const prefix = reason.startsWith('[WARNING]') ? "[WARNING] " : "";
      textToCopy += `${prefix}${cleanReason}\n\n`;
    });

    individualReasons.forEach(({ item, reasons }) => {
      textToCopy += `Row ${item.originalRowIndex + 1} (Page: ${item.pageNumber || 'N/A'})\n`;
      reasons.forEach(reason => {
        const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
        const prefix = reason.startsWith('[WARNING]') ? "- [WARNING] " : "- ";
        textToCopy += `${prefix}${cleanReason}\n`;
      });
      textToCopy += '\n';
    });

    navigator.clipboard.writeText(textToCopy.trim()).then(() => {
      setCopyValidationStatus('copied');
      setTimeout(() => setCopyValidationStatus('idle'), 2000);
    }).catch(err => {
      console.error('Failed to copy validation issues: ', err);
    });
  };

  const renderIssueList = (flagsList: AIFlaggedRecord[], isWarning: boolean) => {
    if (flagsList.length === 0) return null;
    const { groupedReasons, individualReasons } = groupValidationFlags(flagsList);

    const borderClass = isWarning ? 'border-amber-200 bg-amber-50/30' : 'border-red-200 bg-red-50/30';
    const cardBgClass = isWarning ? 'bg-white border-amber-200/90' : 'bg-white border-red-200/90';
    const reasonTextClass = isWarning ? 'text-amber-900' : 'text-red-900';

    return (
      <div className={`rounded-lg border ${borderClass} p-2.5 space-y-2`}>
        {/* Section Title Pill */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
          <div className="flex items-center gap-1.5">
            {isWarning ? (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                !
              </span>
            ) : (
              <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
                <ErrorIcon className="w-3 h-3" />
              </span>
            )}
            <span className={`text-xs font-bold ${isWarning ? 'text-amber-900' : 'text-red-900'}`}>
              {isWarning ? 'Warnings & Inconsistencies' : 'Strict Validation Errors'}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              isWarning ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
            }`}>
              {flagsList.length}
            </span>
          </div>
        </div>

        {/* Grouped Issues */}
        {groupedReasons.size > 0 && (
          <div className="space-y-1.5">
            {Array.from(groupedReasons.entries()).map(([reason, affectedFlags], idx) => {
              const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
              return (
                <div key={idx} className={`p-2 rounded border ${cardBgClass} flex flex-col sm:flex-row sm:items-center justify-between gap-1.5`}>
                  <p className={`font-semibold text-xs ${reasonTextClass}`}>
                    {cleanReason}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap shrink-0">
                    {affectedFlags.map((flag, fIdx) => (
                      <span 
                        key={fIdx} 
                        className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-medium"
                      >
                        R{flag.originalRowIndex + 1}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Individual Row Issues */}
        {individualReasons.length > 0 && (
          <div className="space-y-1.5">
            {individualReasons.map(({ item, reasons }, idx) => (
              <div 
                key={idx} 
                className={`p-2 rounded border ${cardBgClass} text-xs hover:border-slate-300 transition-colors space-y-1`}
              >
                {/* Compact Row Header Bar */}
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 bg-slate-800 text-white rounded text-[11px] font-mono font-bold">
                      Row {item.originalRowIndex + 1}
                    </span>
                    {item.pageNumber && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                        p. {item.pageNumber}
                      </span>
                    )}
                    {item.usageClassification && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium border border-blue-200">
                        {item.usageClassification}
                      </span>
                    )}
                    {item.rightsType && (
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-medium border border-purple-200">
                        {item.rightsType}
                      </span>
                    )}
                    {item.source && (
                      <span className="text-[11px] text-slate-700 font-semibold truncate max-w-[180px]">
                        {item.source}
                      </span>
                    )}
                    {item.acknowledgement && (
                      <span className="text-[11px] text-slate-500 truncate max-w-[260px]" title={item.acknowledgement}>
                        — {item.acknowledgement}
                      </span>
                    )}
                  </div>

                  {onNavigateToLog && (
                    <button
                      onClick={onNavigateToLog}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0 ml-auto hover:underline"
                      title="View row in sheet"
                    >
                      <FileSheetIcon className="w-3 h-3" />
                      <span>Sheet</span>
                    </button>
                  )}
                </div>

                {/* Specific Violations List */}
                <ul className="space-y-0.5 pl-2 border-l border-slate-200 mt-1">
                  {reasons.map((reason, rIdx) => {
                    const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
                    return (
                      <li key={rIdx} className="flex items-start gap-1.5 text-xs">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isWarning ? 'bg-amber-500' : 'bg-red-500'}`} />
                        <span className={`font-medium ${reasonTextClass}`}>
                          {cleanReason}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAiAnalysisSection = () => {
    switch (aiAnalysisStatus) {
      case 'running':
        return (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3 animate-pulse text-xs">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
            <div>
              <span className="font-bold text-blue-900">AI Quality Check Running...</span>
              <span className="text-blue-700 ml-2">Analyzing log entries for subtle inconsistencies and typos.</span>
            </div>
          </div>
        );
      case 'completed':
        if (aiFlags.length > 0) {
          return (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-orange-900 flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-orange-600" />
                  <span>AI Flagged Potential Anomalies ({aiFlags.length})</span>
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {aiFlags.map((item, i) => (
                  <div key={i} className="p-2 bg-white rounded border border-orange-200 text-xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>Row {item.originalRowIndex + 1} {item.pageNumber ? `(p. ${item.pageNumber})` : ''} — {item.source}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] truncate">{item.acknowledgement}</p>
                    <p className="text-orange-700 font-medium text-[11px] pt-0.5">
                      &rarr; {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-xs">
            <SuccessIcon className="w-4 h-4 text-green-600 shrink-0" />
            <span className="font-semibold text-green-900">AI Quality Check Complete: No anomalies detected.</span>
          </div>
        );
      case 'idle':
      case 'skipped':
        return (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <SparklesIcon className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-slate-700 font-medium truncate">
                AI Data Quality Check scans for subtle formatting inconsistencies and typos.
              </span>
            </div>
            <button
              onClick={onRunAiAnalysis}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded transition-colors shrink-0"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Run AI Check</span>
            </button>
          </div>
        );
      case 'error':
        return (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs">
            <ErrorIcon className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-bold text-red-900">AI Quality Check Failed.</span>
          </div>
        );
      default:
        return null;
    }
  };

  const hasNoIssues = dataValidationFlags.length === 0;

  return (
    <div className="animate-fade-in flex flex-col gap-2 p-1 flex-1 min-h-0">
      {/* Compact Top Filter & Metrics Action Bar */}
      <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs flex-shrink-0">
        {/* Left: Filter Buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors shrink-0 ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({dataValidationFlags.length})
          </button>
          <button
            onClick={() => setActiveFilter('errors')}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0 flex items-center gap-1 ${
              activeFilter === 'errors'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <span>Strict Errors</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'errors' ? 'bg-red-700 text-white' : 'bg-red-100 text-red-700'}`}>
              {errorFlags.length}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter('warnings')}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0 flex items-center gap-1 ${
              activeFilter === 'warnings'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            <span>Warnings</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'warnings' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
              {warningFlags.length}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter('ai')}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors shrink-0 flex items-center gap-1 ${
              activeFilter === 'ai'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <SparklesIcon className="w-3 h-3" />
            <span>AI Check</span>
          </button>
        </div>

        {/* Right: Small Metric Badges, Search & Actions */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Small Metric Badges directly next to filters */}
          <div className="flex items-center gap-1 text-xs font-mono">
            {/* Total Records */}
            <span 
              title="Total Records Analyzed" 
              className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold flex items-center gap-1"
            >
              <span className="text-[10px] text-slate-400 font-sans uppercase">Rows</span>
              <span>{originalRecordCount}</span>
            </span>

            {/* Strict Errors Badge */}
            <span 
              title="Strict Validation Errors" 
              className={`px-2 py-0.5 border rounded font-semibold flex items-center gap-1 ${
                errorFlags.length > 0 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              <ErrorIcon className="w-3 h-3 text-red-500" />
              <span>{errorFlags.length}</span>
            </span>

            {/* Warnings Badge */}
            <span 
              title="Warnings & Inconsistencies" 
              className={`px-2 py-0.5 border rounded font-semibold flex items-center gap-1 ${
                warningFlags.length > 0 
                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">!</span>
              <span>{warningFlags.length}</span>
            </span>

            {/* Overall Health Status Indicator */}
            {hasNoIssues ? (
              <span 
                title="All Validation Rules Passed" 
                className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded font-semibold flex items-center gap-1 font-sans text-xs"
              >
                <Check className="w-3 h-3 text-green-600" />
                <span>Healthy</span>
              </span>
            ) : (
              <span 
                title="Validation Issues Found" 
                className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-semibold flex items-center gap-1 font-sans text-xs"
              >
                <span>{dataValidationFlags.length} Issues</span>
              </span>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[150px] sm:min-w-[180px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search row, reason..."
              className="w-full text-xs pl-6 pr-5 py-1 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50"
            />
            <Search className="w-3 h-3 text-slate-400 absolute left-1.5 top-2 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                &times;
              </button>
            )}
          </div>

          {/* Actions: Copy All & Sheet View */}
          {dataValidationFlags.length > 0 && (
            <button
              onClick={handleCopyValidationIssues}
              title="Copy all issues to clipboard"
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-2xs"
            >
              {copyValidationStatus === 'copied' ? (
                <>
                  <SuccessIcon className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-700 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}

          {onNavigateToLog && (
            <button
              onClick={onNavigateToLog}
              title="Switch to Uploaded Log spreadsheet"
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors shadow-2xs"
            >
              <FileSheetIcon className="w-3.5 h-3.5" />
              <span>Sheet</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Validation Content - Immediate Focus on Issues */}
      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
        {hasNoIssues ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <SuccessIcon className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-green-900">Validation Passed</p>
              <p className="text-[11px] text-green-700 mt-0.5">
                All {originalRecordCount} records strictly conform to column relationship, source/rights, cost, and notes rules.
              </p>
            </div>
          </div>
        ) : (
          <>
            {(activeFilter === 'all' || activeFilter === 'errors') && (
              renderIssueList(filteredErrorFlags, false)
            )}

            {(activeFilter === 'all' || activeFilter === 'warnings') && (
              renderIssueList(filteredWarningFlags, true)
            )}
          </>
        )}

        {/* AI Check Section */}
        {(activeFilter === 'all' || activeFilter === 'ai') && (
          <div className="pt-1">
            {renderAiAnalysisSection()}
          </div>
        )}
      </div>
    </div>
  );
};
