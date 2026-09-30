import React, { useState, useEffect, useCallback } from 'react';
import type { AcknowledgementRecord, AIFlaggedRecord } from '../types';
import { VALIDATION_RULES, getRulesForReasons, type ValidationRuleDef } from '../services/validationRules';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ErrorIcon } from './icons/ErrorIcon';
import { CloseIcon } from './icons/CloseIcon';
import { AlertTriangle, XCircle, Check } from 'lucide-react';

interface ResultsTableProps {
  coverData: AcknowledgementRecord[];
  nonCoverData: AcknowledgementRecord[];
  dataValidationFlags: AIFlaggedRecord[];
  onDisableRule?: (ruleId: string) => void;
  onDisableRules?: (ruleIds: string[]) => void;
  onToggleRule?: (ruleId: string) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ 
  coverData, 
  nonCoverData, 
  dataValidationFlags,
  onDisableRule,
  onDisableRules,
  onToggleRule,
}) => {
  const [isCoverExpanded, setIsCoverExpanded] = useState(true);
  const [isMainExpanded, setIsMainExpanded] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rules: ValidationRuleDef[];
    item: AcknowledgementRecord;
  } | null>(null);

  const validationFlagsMap = new Map<number, string>(
    dataValidationFlags.map(flag => [flag.originalRowIndex, flag.reason])
  );

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => prev === msg ? null : prev);
    }, 3000);
  }, []);

  const handleRowContextMenu = (e: React.MouseEvent, item: AcknowledgementRecord) => {
    const reasonStr = validationFlagsMap.get(item.originalRowIndex);
    if (!reasonStr) return;

    e.preventDefault();
    e.stopPropagation();

    const reasons = reasonStr.split('|||');
    const rules = getRulesForReasons(reasons);
    if (rules.length === 0) return;

    const x = Math.min(e.clientX, window.innerWidth - 300);
    const y = Math.min(e.clientY, window.innerHeight - 260);

    setContextMenu({
      x: Math.max(10, x),
      y: Math.max(10, y),
      rules,
      item
    });
  };

  const handleDehighlightRule = (rule: ValidationRuleDef) => {
    if (onDisableRule) {
      onDisableRule(rule.id);
    } else if (onToggleRule) {
      onToggleRule(rule.id);
    }
    showToast(`De-highlighted: "${rule.name}". Red highlight removed.`);
    setContextMenu(null);
  };

  const handleDehighlightAll = (rules: ValidationRuleDef[]) => {
    const ids = rules.map(r => r.id);
    if (onDisableRules) {
      onDisableRules(ids);
    } else if (onDisableRule) {
      ids.forEach(id => onDisableRule(id));
    }
    showToast(`De-highlighted ${rules.length} error type(s).`);
    setContextMenu(null);
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const renderRows = (data: AcknowledgementRecord[]) => (
    <>
      {data.map((item) => {
        const validationReason = validationFlagsMap.get(item.originalRowIndex);
        const reasons = validationReason ? validationReason.split('|||') : [];
        const hasErrors = reasons.some(r => !r.startsWith('[WARNING]'));
        const hasWarnings = reasons.some(r => r.startsWith('[WARNING]'));
        const isFlagged = hasErrors || hasWarnings;

        let rowClass = 'odd:bg-white even:bg-slate-50 hover:bg-blue-50';
        let borderClass = 'border-red-300';
        if (hasErrors) {
          rowClass = 'bg-red-50 hover:bg-red-100';
          borderClass = 'border-red-300';
        } else if (hasWarnings) {
          rowClass = 'bg-amber-50/60 hover:bg-amber-100/80';
          borderClass = 'border-amber-300';
        }

        return (
          <tr 
            key={item.originalRowIndex} 
            onContextMenu={(e) => handleRowContextMenu(e, item)}
            className={`transition-colors align-top ${rowClass} ${isFlagged ? 'cursor-context-menu' : ''}`}
            title={isFlagged ? 'Right-click to de-highlight specific error types' : undefined}
          >
            <td className="px-2 py-1.5 whitespace-nowrap text-sm font-medium text-slate-800">{item.source}</td>
            <td className="px-2 py-1.5 whitespace-normal text-sm text-slate-600">
              <span>{item.acknowledgement}</span>
              {isFlagged && (
                <div className={`mt-1 space-y-1 border-l-2 ${borderClass} pl-2`}>
                  {reasons.map((reason, index) => {
                    const isWarning = reason.startsWith('[WARNING]');
                    const cleanReason = isWarning ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
                    return (
                      <div key={index} className={`flex items-start gap-1 ${isWarning ? 'text-amber-800' : 'text-red-800'}`}>
                        {isWarning ? (
                          <div className="w-3.5 h-3.5 mt-0.5 rounded-full bg-amber-500 flex items-center justify-center text-white text-[9px] font-bold shrink-0">!</div>
                        ) : (
                          <ErrorIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                        )}
                        <span className="text-xs font-semibold">{cleanReason}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </td>
            <td className="px-2 py-1.5 whitespace-nowrap text-sm text-slate-600 text-center">{item.pageNumber}</td>
          </tr>
        );
      })}
    </>
  );
    
  return (
    <div className="animate-fade-in flex flex-col gap-1 relative">
      <div className="w-full">
        <div className="overflow-auto max-h-[80vh] border border-slate-200 rounded-lg shadow-inner">
          <table className="min-w-full divide-y divide-slate-300">
            <thead className="bg-slate-50 sticky top-0 z-20">
              <tr>
                <th scope="col" className="w-1/4 px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" className="w-2/4 px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Acknowledgement
                </th>
                <th scope="col" className="px-2 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Page
                </th>
              </tr>
            </thead>
            {coverData.length > 0 && (
              <tbody className="bg-white divide-y divide-slate-200">
                <tr>
                  <td colSpan={3} className="px-2 py-1 bg-slate-100 sticky top-[33px] z-10">
                    <button
                      onClick={() => setIsCoverExpanded(!isCoverExpanded)}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 text-black text-sm rounded-md hover:bg-slate-300 transition-colors shadow-sm"
                    >
                      <span>Cover Credits</span>
                      <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isCoverExpanded ? '' : '-rotate-90'}`} />
                    </button>
                  </td>
                </tr>
                {isCoverExpanded && renderRows(coverData)}
              </tbody>
            )}

            {nonCoverData.length > 0 && (
              <tbody className="bg-white divide-y divide-slate-200">
                <tr>
                  <td colSpan={3} className="px-2 py-1 bg-slate-100 sticky top-[33px] z-10">
                    <button
                      onClick={() => setIsMainExpanded(!isMainExpanded)}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 text-black text-sm rounded-md hover:bg-slate-300 transition-colors shadow-sm"
                    >
                      <span>Main Credits</span>
                      <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isMainExpanded ? '' : '-rotate-90'}`} />
                    </button>
                  </td>
                </tr>
                {isMainExpanded && renderRows(nonCoverData)}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* Right-Click Context Menu for De-highlighting in Results Table */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-white border border-slate-300 rounded-xl shadow-2xl py-1.5 w-80 text-xs animate-fade-in font-sans"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <span className="font-bold text-slate-800">
              Row {contextMenu.item.originalRowIndex + 1} Issues
            </span>
            <button 
              onClick={() => setContextMenu(null)}
              className="text-slate-400 hover:text-slate-600 rounded p-0.5"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 space-y-1.5 bg-red-50/20">
            <div className="px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Remove Red / De-highlight Rule
            </div>

            {contextMenu.rules.map(rule => (
              <button
                key={rule.id}
                onClick={() => handleDehighlightRule(rule)}
                className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-colors shadow-2xs group flex items-start gap-2"
              >
                {rule.severity === 'error' ? (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-900 group-hover:text-red-900">
                      &rarr; De-highlight: {rule.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                    {rule.shortDesc}
                  </p>
                </div>
              </button>
            ))}

            {contextMenu.rules.length > 1 && (
              <button
                onClick={() => handleDehighlightAll(contextMenu.rules)}
                className="w-full mt-1 py-1.5 px-2 bg-red-100 hover:bg-red-200 text-red-900 border border-red-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <span>⚡ De-highlight all ({contextMenu.rules.length}) error types</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-3.5 py-2 rounded-lg shadow-xl border border-slate-700 flex items-center gap-2 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
