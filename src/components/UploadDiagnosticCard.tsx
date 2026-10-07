import React, { useState } from 'react';
import type { FileParseDiagnostic } from '../types';
import { 
  AlertCircle, 
  RefreshCw, 
  Clipboard, 
  Check, 
  HelpCircle, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  Info
} from 'lucide-react';

interface UploadDiagnosticCardProps {
  errorMessage: string;
  diagnostic?: FileParseDiagnostic;
  onReset: () => void;
  onPasteOption?: () => void;
}

export const UploadDiagnosticCard: React.FC<UploadDiagnosticCardProps> = ({
  errorMessage,
  diagnostic,
  onReset,
  onPasteOption
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(() => {
    return diagnostic?.sheetsChecked?.[0]?.sheetName || null;
  });

  const handleCopyDiagnostic = () => {
    const report = {
      errorMessage,
      diagnostic,
      timestamp: new Date().toISOString()
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-rose-100 overflow-hidden text-slate-800 animate-fadeIn max-w-3xl mx-auto my-4">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border-b border-rose-100 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-2xs border border-rose-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-rose-200/80 text-rose-800 rounded-md">
              Header Detection Failure
            </span>
            {diagnostic?.fileName && (
              <span className="text-xs font-medium text-slate-500 truncate">
                File: {diagnostic.fileName}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            Could Not Identify Required Log Headers
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
            {diagnostic?.generalMessage || errorMessage}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-5">
        {/* Required Headers Reference */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              The 7 Mandatory Log Column Headers
            </h4>
            <span className="text-[11px] text-slate-400">Must be present in one row</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-700">1. Usage Classification</div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-700">2. Description</div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-700">3. Library Image No</div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-700">4. Source</div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-700">5. Rights Type</div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-700">6. Acknowledgement</div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-medium text-slate-700">7. Page Number</div>
            <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-500 italic">+ Optional: Fees, Notes</div>
          </div>
        </div>

        {/* Sheet Tabs Inspection Diagnostic */}
        {diagnostic?.sheetsChecked && diagnostic.sheetsChecked.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-400" />
              Sheet-by-Sheet Diagnostic Inspection ({diagnostic.sheetsChecked.length} Tab{diagnostic.sheetsChecked.length > 1 ? 's' : ''})
            </h4>

            <div className="space-y-2.5">
              {diagnostic.sheetsChecked.map((sheet, sIdx) => {
                const isExpanded = expandedSheet === sheet.sheetName;
                return (
                  <div 
                    key={sIdx}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSheet(isExpanded ? null : sheet.sheetName)}
                      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        <span className="font-semibold text-xs sm:text-sm text-slate-800">Tab: "{sheet.sheetName}"</span>
                        <span className="text-[11px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full font-mono">
                          {sheet.rowCount} rows × {sheet.colCount} cols
                        </span>
                      </div>
                      <span className="text-xs font-medium text-rose-600">
                        {sheet.missingRequiredHeaders.length} missing header{sheet.missingRequiredHeaders.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="p-4 border-t border-slate-100 space-y-3 text-xs">
                        {/* Missing Required Headers */}
                        <div>
                          <div className="text-slate-500 font-semibold mb-1">Missing Required Columns:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {sheet.missingRequiredHeaders.map((m, mIdx) => (
                              <span 
                                key={mIdx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-medium"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Found Headers */}
                        {sheet.foundHeaders.length > 0 && (
                          <div>
                            <div className="text-slate-500 font-semibold mb-1">Recognized Columns Found:</div>
                            <div className="flex flex-wrap gap-1.5">
                              {sheet.foundHeaders.map((f, fIdx) => (
                                <span 
                                  key={fIdx}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Candidate Row Sample Values */}
                        {sheet.sampleRowValues && sheet.sampleRowValues.length > 0 && (
                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                            <div className="text-[11px] font-semibold text-slate-500 mb-1">
                              Best candidate header row (Row {(sheet.bestRowIndex ?? 0) + 1}) text:
                            </div>
                            <div className="flex flex-wrap gap-1 font-mono text-[11px] text-slate-700">
                              {sheet.sampleRowValues.map((v, vIdx) => (
                                <span key={vIdx} className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  "{v}"
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suggestions Checklist */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
          <h4 className="font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4" />
            Recommended Solutions
          </h4>
          <ul className="space-y-1 text-blue-950 list-disc list-inside leading-relaxed">
            <li>Ensure the column titles in your Excel sheet match the standard names (especially <code>Page Number</code>, <code>Library Image No</code>, <code>Usage Classification</code>, and <code>Rights Type</code>).</li>
            <li>If your sheet has two-row merged headers, unmerge them so each column name is on a single row.</li>
            <li>Alternatively, copy the table cells directly in Excel and use the <strong>Paste Raw TSV/CSV/Text</strong> option.</li>
          </ul>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleCopyDiagnostic}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors flex items-center justify-center gap-2"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Clipboard className="w-4 h-4 text-slate-500" />}
          <span>{copied ? 'Diagnostic Copied!' : 'Copy Diagnostic JSON'}</span>
        </button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onPasteOption && (
            <button
              type="button"
              onClick={onPasteOption}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Clipboard className="w-4 h-4 text-blue-600" />
              <span>Paste Raw Log Text</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Upload Another File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
