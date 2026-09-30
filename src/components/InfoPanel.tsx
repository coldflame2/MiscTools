import React, { useState, useMemo } from 'react';
import type { AcknowledgementRecord, AIFlaggedRecord, ActiveView } from '../types';
import { DetailsIcon } from './icons/DetailsIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { 
  VALIDATION_RULES, 
  calculateRuleViolationCounts,
  type ValidationRuleDef 
} from '../services/validationRules';
import { 
  SlidersHorizontal, 
  Check, 
  X, 
  RotateCcw, 
  Search, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  Info, 
  FileText,
  Copy,
  Layers,
  CheckCheck,
  Ban,
  ChevronDown
} from 'lucide-react';

interface InfoPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  fileName: string;
  originalRecordCount: number;
  totalSources: number;
  coverCreditsCount: number;
  mainCreditsCount: number;
  removedDuplicates: AcknowledgementRecord[];
  crossCategoryDuplicates: AcknowledgementRecord[];
  activeView?: ActiveView;
  rawValidationFlags?: AIFlaggedRecord[];
  enabledRuleIds?: Set<string>;
  onToggleRule?: (ruleId: string) => void;
  onEnableAllRules?: () => void;
  onDisableAllRules?: () => void;
  onResetRules?: () => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  isOpen,
  onToggle,
  fileName,
  originalRecordCount,
  totalSources,
  coverCreditsCount,
  mainCreditsCount,
  removedDuplicates,
  crossCategoryDuplicates,
  activeView = 'dataHealth',
  rawValidationFlags = [],
  enabledRuleIds = new Set(VALIDATION_RULES.map(r => r.id)),
  onToggleRule,
  onEnableAllRules,
  onDisableAllRules,
  onResetRules,
}) => {
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'rules' | 'details'>('rules');

  // Calculate live violation counts per rule
  const ruleViolationCounts = useMemo(() => {
    return calculateRuleViolationCounts(rawValidationFlags);
  }, [rawValidationFlags]);

  // Total violations across all raw rules
  const totalRawViolations = useMemo(() => {
    return Object.values(ruleViolationCounts).reduce((acc, count) => acc + count, 0);
  }, [ruleViolationCounts]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    VALIDATION_RULES.forEach(r => cats.add(r.category));
    return ['All', ...Array.from(cats)];
  }, []);

  // Filtered rules based on search & category
  const filteredRules = useMemo(() => {
    return VALIDATION_RULES.filter(rule => {
      const matchesSearch = 
        !ruleSearchQuery.trim() ||
        rule.name.toLowerCase().includes(ruleSearchQuery.toLowerCase()) ||
        rule.shortDesc.toLowerCase().includes(ruleSearchQuery.toLowerCase()) ||
        rule.category.toLowerCase().includes(ruleSearchQuery.toLowerCase());

      const matchesCat = 
        selectedCategory === 'All' || rule.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [ruleSearchQuery, selectedCategory]);

  const enabledCount = enabledRuleIds.size;
  const totalRules = VALIDATION_RULES.length;
  const isAllEnabled = enabledCount === totalRules;
  const isNoneEnabled = enabledCount === 0;

  if (!isOpen) {
    return (
      <aside className="relative flex-shrink-0 w-11 transition-all duration-300">
        <div className="h-full bg-white rounded-xl shadow-md border border-slate-200 flex flex-col items-center py-4 select-none">
          <button 
            onClick={onToggle} 
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors shadow-2xs"
            aria-label="Expand Rules & Details panel"
            title="Expand Rules & Details panel"
          >
            <ChevronRightIcon className="w-4 h-4 rotate-180 transform" />
          </button>
          
          <button 
            onClick={onToggle}
            className="mt-6 flex flex-col items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors group"
            title="Click to expand Rules & Details panel"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <span 
              className="font-bold text-[11px] tracking-wider uppercase text-slate-500 group-hover:text-blue-600"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              Rules & Details
            </span>
          </button>
        </div>
      </aside>
    );
  }
  
  return (
    <aside className="relative transition-all duration-300 flex-shrink-0 w-88 lg:w-96 flex flex-col h-full overflow-hidden">
      <div className="h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Main Panel Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg border border-blue-200 shadow-2xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                Rules & Details
              </h2>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block w-2 h-2 rounded-full ${enabledCount === totalRules ? 'bg-emerald-500' : enabledCount === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span>{enabledCount} of {totalRules} rules active</span>
                {enabledCount < totalRules && (
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-1.5 py-0.2 rounded">
                    Filter Active
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button 
              onClick={onToggle} 
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs"
              aria-label="Collapse panel"
              title="Collapse panel"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs between Rules (Top) and Details (Moved Down) */}
        <div className="flex items-center border-b border-slate-200 bg-slate-100/80 px-2.5 py-1.5 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-white text-blue-700 shadow-2xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Validation Rules</span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
              enabledCount < totalRules ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {enabledCount}/{totalRules}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'details'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <DetailsIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>File Details</span>
          </button>
        </div>

        {/* Content Container */}
        <div className="p-3 h-full overflow-y-auto space-y-3.5 flex-1">
          
          {/* ========================================================================= */}
          {/* SECTION 1: VALIDATION RULES MANAGER (Top Feature)                         */}
          {/* ========================================================================= */}
          {activeTab === 'rules' && (
            <div className="space-y-3">
              {/* Rules Description & Preset Actions */}
              <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200/90 rounded-xl p-3 space-y-2 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <h3 className="text-xs font-bold text-blue-950">Active Rules Enforcement</h3>
                      <p className="text-[11px] text-blue-800/90 leading-tight">
                        Toggle rules off to temporarily suppress specific errors and warnings in the report.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Presets Bar */}
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-blue-200/60 flex-wrap">
                  <button
                    onClick={onEnableAllRules}
                    disabled={isAllEnabled}
                    className="px-2 py-1 text-[11px] font-semibold bg-white text-emerald-700 border border-emerald-300/80 rounded-md hover:bg-emerald-50 disabled:opacity-40 transition-colors shadow-2xs flex items-center gap-1"
                    title="Enable all validation checks"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Enable All ({totalRules})</span>
                  </button>
                  <button
                    onClick={onDisableAllRules}
                    disabled={isNoneEnabled}
                    className="px-2 py-1 text-[11px] font-semibold bg-white text-red-700 border border-red-300/80 rounded-md hover:bg-red-50 disabled:opacity-40 transition-colors shadow-2xs flex items-center gap-1"
                    title="Disable all validation checks"
                  >
                    <Ban className="w-3.5 h-3.5 text-red-500" />
                    <span>Disable All</span>
                  </button>
                  <button
                    onClick={onResetRules}
                    className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 border border-slate-300 rounded-md hover:bg-slate-100 transition-colors shadow-2xs ml-auto flex items-center gap-1"
                    title="Reset to default active rules"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter */}
              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    type="text"
                    value={ruleSearchQuery}
                    onChange={(e) => setRuleSearchQuery(e.target.value)}
                    placeholder="Search rules by name, keyword..."
                    className="w-full text-xs pl-7 pr-6 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-blue-500 bg-slate-50 placeholder:text-slate-400"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                  {ruleSearchQuery && (
                    <button
                      onClick={() => setRuleSearchQuery('')}
                      className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      title="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Categories Horizontal Scroll */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full scrollbar-none">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rules List */}
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
                {filteredRules.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No rules match "{ruleSearchQuery}".
                  </div>
                ) : (
                  filteredRules.map(rule => {
                    const isEnabled = enabledRuleIds.has(rule.id);
                    const issueCount = ruleViolationCounts[rule.id] || 0;

                    return (
                      <div
                        key={rule.id}
                        onClick={() => onToggleRule && onToggleRule(rule.id)}
                        className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer select-none ${
                          isEnabled
                            ? 'bg-white border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs'
                            : 'bg-slate-50/80 border-slate-200/60 opacity-60 hover:opacity-85'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {/* Switch Toggle */}
                            <div className="mt-0.5 shrink-0">
                              <div className={`w-7 h-4 flex items-center rounded-full p-0.5 duration-200 cursor-pointer ${
                                isEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                              }`}>
                                <div className="bg-white w-3 h-3 rounded-full shadow-md transform transition-transform" />
                              </div>
                            </div>
                            
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold text-xs ${isEnabled ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                                  {rule.name}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {rule.category}
                                </span>
                                <span className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded ${
                                  rule.severity === 'error' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50'
                                }`}>
                                  {rule.severity}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                {rule.shortDesc}
                              </p>
                            </div>
                          </div>

                          {/* Live Issue Count Badge */}
                          <div className="shrink-0 flex items-center">
                            {issueCount > 0 ? (
                              <span 
                                title={`${issueCount} issue(s) detected in uploaded data by this rule`}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                                  !isEnabled
                                    ? 'bg-slate-100 text-slate-400 line-through'
                                    : rule.severity === 'error'
                                    ? 'bg-red-50 text-red-700 border border-red-200 shadow-2xs'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs'
                                }`}
                              >
                                {rule.severity === 'error' ? (
                                  <XCircle className="w-3 h-3 text-red-500" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                )}
                                <span>{issueCount}</span>
                              </span>
                            ) : (
                              <span 
                                title="0 issues detected for this rule"
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100"
                              >
                                0
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Details Preview Moved Below Rules */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-200/80">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span>Quick Details & Counts</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('details')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                    >
                      Full Details &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-2 text-[11px] text-slate-600">
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Total Entries:</span>
                      <strong className="text-slate-800 font-mono text-xs">{originalRecordCount}</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Total Sources:</span>
                      <strong className="text-slate-800 font-mono text-xs">{totalSources}</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Cover Credits:</span>
                      <strong className="text-slate-800 font-mono text-xs">{coverCreditsCount}</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Main Credits:</span>
                      <strong className="text-slate-800 font-mono text-xs">{mainCreditsCount}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: MOVED DOWN DETAILS (File Info, Summary, Duplicates)             */}
          {/* ========================================================================= */}
          {activeTab === 'details' && (
            <div className="space-y-3.5 animate-fade-in">
              {/* Back to Rules Button */}
              <button
                onClick={() => setActiveTab('rules')}
                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors shadow-2xs"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Configure Validation Rules ({enabledCount}/{totalRules})</span>
                </span>
                <ChevronRightIcon className="w-4 h-4 text-blue-500" />
              </button>

              {/* Process Results Section */}
              <section className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Process Results</span>
                </h3>
                <div className="text-xs space-y-1 text-slate-600 pt-1">
                  <p><strong>File:</strong> <span className="font-medium text-slate-800 break-all">{fileName || 'None loaded'}</span></p>
                </div>
              </section>

              {/* Summary Section */}
              <section className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Summary Statistics</span>
                </h3>
                <ul className="text-xs space-y-1.5 text-slate-600 pt-1">
                  <li className="flex justify-between items-center">
                    <span>Total Sources:</span> 
                    <span className="font-mono font-semibold bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded">{totalSources}</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>Cover Credits:</span> 
                    <span className="font-mono font-semibold bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded">{coverCreditsCount}</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>Main Credits:</span> 
                    <span className="font-mono font-semibold bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded">{mainCreditsCount}</span>
                  </li>
                  <li className="pt-1.5 border-t border-slate-200/80 flex justify-between items-center">
                    <strong>Total Entries:</strong> 
                    <span className="font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">{originalRecordCount}</span>
                  </li>
                </ul>
              </section>
              
              {/* Duplicates Details Accordion */}
              {(removedDuplicates.length > 0 || crossCategoryDuplicates.length > 0) ? (
                <section>
                  <details className="group bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-200 shadow-2xs">
                    <summary className="p-3 cursor-pointer flex justify-between items-center font-semibold text-xs text-slate-700 hover:bg-slate-100 list-none">
                      <span className="flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Duplicate Details ({removedDuplicates.length + crossCategoryDuplicates.length})</span>
                      </span>
                      <ChevronRightIcon className="w-4 h-4 transition-transform duration-200 group-open:rotate-90 text-slate-400" />
                    </summary>
                    <div className="p-3 border-t border-slate-200 space-y-3 text-xs bg-white">
                      {removedDuplicates.length > 0 && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                          <h4 className="font-bold text-amber-900 text-xs">Removed Duplicates ({removedDuplicates.length})</h4>
                          <p className="text-amber-700 text-[11px] mt-0.5">Duplicates found within sections and merged:</p>
                          <ul className="list-disc list-inside mt-1.5 text-amber-800 max-h-32 overflow-y-auto space-y-0.5 text-[11px]">
                            {removedDuplicates.map((item, i) => (
                              <li key={i} className="truncate"><strong>{item.source}:</strong> {item.acknowledgement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {crossCategoryDuplicates.length > 0 && (
                        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-bold text-blue-900 text-xs">Cover and Main Duplicates ({crossCategoryDuplicates.length})</h4>
                          <p className="text-blue-700 text-[11px] mt-0.5">Acknowledgements appearing in both sections (both retained):</p>
                          <ul className="list-disc list-inside mt-1.5 text-blue-800 max-h-32 overflow-y-auto space-y-0.5 text-[11px]">
                            {crossCategoryDuplicates.map((item, i) => (
                              <li key={i} className="truncate"><strong>{item.source}:</strong> {item.acknowledgement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                </section>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                  No duplicate records found in loaded sheet.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>{totalRawViolations} raw issue(s) in log</span>
          <span className="font-mono text-slate-400">Rules Engine v2</span>
        </div>
      </div>
    </aside>
  );
};
