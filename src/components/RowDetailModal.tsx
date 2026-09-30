import React, { useEffect } from 'react';
import type { ColumnMeta } from './UploadedLogView';
import { CopyIcon } from './icons/CopyIcon';
import { ErrorIcon } from './icons/ErrorIcon';
import { CloseIcon } from './icons/CloseIcon';
import { ChevronLeft, ChevronRight, Check, AlertTriangle, XCircle, FileSpreadsheet } from 'lucide-react';

interface RowDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRow: {
    originalRowIndex: number;
    excelRowNumber: number;
    data: (string | number)[];
  } | null;
  columns: ColumnMeta[];
  visibleColumns: ColumnMeta[];
  totalRows: number;
  currentRowDisplayIndex: number;
  onPrevRow: () => void;
  onNextRow: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  validationInfo?: {
    isError: boolean;
    isWarning: boolean;
    reasons: string[];
  };
}

export const RowDetailModal: React.FC<RowDetailModalProps> = ({
  isOpen,
  onClose,
  currentRow,
  columns,
  totalRows,
  currentRowDisplayIndex,
  onPrevRow,
  onNextRow,
  hasPrev,
  hasNext,
  validationInfo
}) => {
  const [copiedColIndex, setCopiedColIndex] = React.useState<number | null>(null);
  const [copiedAll, setCopiedAll] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (hasPrev) onPrevRow();
      } else if (e.key === 'ArrowRight') {
        if (hasNext) onNextRow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onPrevRow, onNextRow, onClose]);

  if (!isOpen || !currentRow) return null;

  const handleCopyField = (val: string, colIndex: number) => {
    navigator.clipboard.writeText(val);
    setCopiedColIndex(colIndex);
    setTimeout(() => setCopiedColIndex(null), 1500);
  };

  const handleCopyEntireRow = () => {
    const text = columns
      .map(col => `${col.letter} (${col.headerName}): ${String(currentRow.data[col.index] ?? '').trim()}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const isError = validationInfo?.isError ?? false;
  const isWarning = validationInfo?.isWarning ?? false;
  const reasons = validationInfo?.reasons ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="row-detail-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="row-detail-title" className="text-base font-bold text-slate-900">
                  Row #{currentRow.excelRowNumber} Details
                </h3>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  Index {currentRowDisplayIndex + 1} of {totalRows}
                </span>
                {isError && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    Validation Issue
                  </span>
                )}
                {!isError && isWarning && (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Warning
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect all columns and values for this record. Use arrow keys to navigate between rows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Prev / Next Nav */}
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={onPrevRow}
                disabled={!hasPrev}
                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Previous row (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-medium text-slate-500 px-1.5 select-none">
                {currentRowDisplayIndex + 1}/{totalRows}
              </span>
              <button
                onClick={onNextRow}
                disabled={!hasNext}
                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Next row (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleCopyEntireRow}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-2xs transition-colors"
              title="Copy all columns of this row"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedAll ? 'Copied All' : 'Copy Row'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title="Close modal (Esc)"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Validation Issues Banner if present */}
        {(isError || isWarning) && (
          <div className={`px-5 py-2.5 border-b text-xs flex items-start gap-2.5 ${
            isError ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            {isError ? (
              <ErrorIcon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-bold">Row Validation Diagnostics:</span>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {reasons.map((r, idx) => (
                  <li key={idx} className="font-medium">
                    {r.replace('[WARNING] ', '').replace('[WARNING]', '')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Field List */}
        <div className="overflow-y-auto p-5 space-y-2.5 flex-1 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {columns.map(col => {
              const rawVal = currentRow.data[col.index];
              const valStr = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
              const isCopied = copiedColIndex === col.index;
              const isEmpty = !valStr;

              return (
                <div
                  key={col.index}
                  className="bg-white border border-slate-200 rounded-lg p-2.5 hover:border-slate-300 transition-all flex flex-col justify-between group shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        col.isDefault ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        Col {col.letter}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate" title={col.headerName}>
                        {col.headerName}
                      </span>
                    </div>

                    {!isEmpty && (
                      <button
                        onClick={() => handleCopyField(valStr, col.index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="Copy value"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-slate-800 break-words whitespace-pre-wrap font-sans bg-slate-50/70 p-2 rounded border border-slate-100 select-text min-h-[34px]">
                    {valStr ? valStr : <span className="text-slate-300 italic">None / Empty</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>Tip: Click any field to select text, or use</span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono text-slate-700">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono text-slate-700">→</kbd>
            <span>to navigate rows</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
