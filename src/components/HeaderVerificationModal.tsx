import React from 'react';
import type { HeaderDetectionMeta } from '../types';
import { AlertTriangle, CheckCircle2, ArrowRight, X, Sparkles, RefreshCw, Layers } from 'lucide-react';

interface HeaderVerificationModalProps {
  isOpen: boolean;
  meta: HeaderDetectionMeta;
  fileName?: string;
  onProceed: () => void;
  onCancel: () => void;
}

export const HeaderVerificationModal: React.FC<HeaderVerificationModalProps> = ({
  isOpen,
  meta,
  fileName,
  onProceed,
  onCancel
}) => {
  if (!isOpen || !meta) return null;

  const getConfidenceBadge = () => {
    switch (meta.confidence) {
      case 'high':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">High Confidence</span>;
      case 'medium':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Medium Confidence</span>;
      case 'low':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Caution / Ambiguous</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 shadow-2xs border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Header Verification Required</h2>
                {getConfidenceBadge()}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {fileName ? `File: ${fileName}` : 'Uploaded Spreadsheet'} · Header identified at <span className="font-semibold text-slate-700">Row {meta.headerRowIndex + 1}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
          {/* Warning Banner */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-amber-900 leading-relaxed">
            <p className="font-medium">
              Some column labels were matched using fuzzy aliases, partial text, or merged headers. Please confirm the mapped columns below before loading the log into review mode.
            </p>
          </div>

          {/* Specific Warnings */}
          {meta.warnings.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Detection Notes
              </h4>
              <ul className="space-y-1 text-xs text-slate-600">
                {meta.warnings.map((w, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alternate Candidates Note */}
          {meta.alternateCandidateRows && meta.alternateCandidateRows.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Other Candidate Header Rows Detected
              </h4>
              <p className="text-xs text-blue-900 leading-normal">
                Row {meta.alternateCandidateRows.map(c => c.rowIndex + 1).join(', ')} also contains column headers. If the current mapping looks incorrect, choose <strong>Upload Another File</strong> or adjust your Excel headers.
              </p>
            </div>
          )}

          {/* Detected Column Mapping Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Detected Column Header Mapping
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Required Log Field</th>
                    <th className="py-2.5 px-3 font-semibold">Matched Header in Sheet</th>
                    <th className="py-2.5 px-3 font-semibold">Column</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {meta.matchedColumns.map((col, idx) => {
                    let statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Exact
                      </span>
                    );
                    if (col.matchType === 'alias') {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          Alias
                        </span>
                      );
                    } else if (col.matchType === 'substring' || col.matchType === 'merged') {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Fuzzy
                        </span>
                      );
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-900">{col.fieldLabel}</td>
                        <td className="py-2 px-3 text-slate-700 font-mono bg-slate-50/50 rounded">
                          "{col.detectedHeader || '—'}"
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-600">
                          Col {col.colLetter}
                        </td>
                        <td className="py-2 px-3">
                          {statusBadge}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Upload Another File / Re-upload
          </button>

          <button
            type="button"
            onClick={onProceed}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>Proceed Anyway</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
