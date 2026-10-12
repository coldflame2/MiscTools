import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  ChevronDown,
  HelpCircle,
  BookOpen
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
  const [selectedRuleForModal, setSelectedRuleForModal] = useState<ValidationRuleDef | null>(null);

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

  // 1. Dynamic window width detection to adapt width smartly based on viewport screen size
  const [windowWidth, setWindowWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1280;
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Calculate smart responsive width based on window screen size:
  // - < 640px (Mobile): Compact, bounded by screen width (max 310px)
  // - 640px - 1023px (Tablets / split windows): 280px - 320px (preserves maximum space for log spreadsheet)
  // - 1024px - 1279px (Compact laptops): 325px - 355px
  // - 1280px - 1535px (Standard 1080p laptop/desktop): 365px - 395px
  // - 1536px - 1919px (Large desktop monitors): 405px - 440px
  // - >= 1920px (Ultrawide / 4K): 440px - 480px
  const smartWidth = useMemo(() => {
    if (windowWidth < 640) {
      return Math.min(windowWidth - 24, 310);
    }
    if (windowWidth < 1024) {
      return Math.round(Math.min(Math.max(windowWidth * 0.30, 280), 320));
    }
    if (windowWidth < 1280) {
      return Math.round(Math.min(Math.max(windowWidth * 0.27, 325), 355));
    }
    if (windowWidth < 1536) {
      return Math.round(Math.min(Math.max(windowWidth * 0.25, 360), 395));
    }
    if (windowWidth < 1920) {
      return Math.round(Math.min(Math.max(windowWidth * 0.23, 400), 440));
    }
    return Math.round(Math.min(Math.max(windowWidth * 0.22, 440), 480));
  }, [windowWidth]);

  // Optional manual drag override (null = auto-calculated smart width)
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  // Active panel width clamped within safe boundaries for current screen
  const activeWidth = useMemo(() => {
    const minW = Math.min(270, windowWidth - 24);
    const maxW = Math.max(320, Math.min(620, Math.round(windowWidth * 0.46)));
    if (customWidth !== null) {
      return Math.min(Math.max(customWidth, minW), maxW);
    }
    return Math.min(Math.max(smartWidth, minW), maxW);
  }, [customWidth, smartWidth, windowWidth]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = activeWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeWidth]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = dragStartXRef.current - e.clientX;
    const newWidth = dragStartWidthRef.current + deltaX;
    const minW = Math.min(270, windowWidth - 24);
    const maxW = Math.max(320, Math.min(620, Math.round(windowWidth * 0.46)));
    setCustomWidth(Math.min(Math.max(newWidth, minW), maxW));
  }, [windowWidth]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  }, []);

  const handleResetToAutoWidth = useCallback(() => {
    setCustomWidth(null);
  }, []);

  if (!isOpen) {
    return (
      <aside className="relative flex-shrink-0 w-11 transition-all duration-300">
        <div className="h-full bg-white rounded-xl shadow-md border border-slate-200 flex flex-col items-center py-4 select-none">
          <button 
            onClick={onToggle} 
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer"
            aria-label="Expand Rules & Details panel"
            title="Expand Rules & Details panel"
          >
            <ChevronRightIcon className="w-4 h-4 rotate-180 transform" />
          </button>
          
          {/* Active filter badge in collapsed state */}
          {enabledCount < totalRules && (
            <div 
              className="mt-3 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs"
              title={`${totalRules - enabledCount} rule(s) disabled / filtered (${enabledCount} active)`}
            >
              {enabledCount}
            </div>
          )}

          <button 
            onClick={onToggle}
            className="mt-5 flex flex-col items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors group cursor-pointer"
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
    <aside 
      style={{ width: `${activeWidth}px` }}
      className={`relative transition-[width] duration-150 flex-shrink-0 flex flex-col h-full max-w-[calc(100vw-1.5rem)] select-text ${
        isDragging ? 'select-none' : ''
      }`}
    >
      {/* Draggable left edge resize handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleResetToAutoWidth}
        title="Drag left/right to resize width · Double-click to reset to smart window width"
        className={`absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-20 flex items-center justify-center group ${
          isDragging ? 'bg-blue-400/30' : 'hover:bg-blue-300/20'
        }`}
      >
        <div className={`w-1 h-8 rounded-full transition-colors ${
          isDragging ? 'bg-blue-600 shadow-sm' : 'bg-slate-300 group-hover:bg-blue-500'
        }`} />
      </div>

      <div className="h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Main Panel Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg border border-blue-200 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900 leading-tight truncate">
                  Rules & Details
                </h2>
                {/* Smart width indicator */}
                <span 
                  onClick={customWidth !== null ? handleResetToAutoWidth : undefined}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors hidden sm:inline-block ${
                    customWidth !== null 
                      ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer' 
                      : 'bg-slate-200/80 text-slate-600'
                  }`}
                  title={customWidth !== null ? 'Custom width. Click to reset to smart auto width' : `Smart width (${activeWidth}px) adapted for ${windowWidth}px screen`}
                >
                  {activeWidth}px{customWidth !== null ? ' · Reset' : ' · Auto'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className={`inline-block w-2 h-2 rounded-full ${enabledCount === totalRules ? 'bg-emerald-500' : enabledCount === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span className="truncate">{enabledCount} of {totalRules} rules active</span>
                {enabledCount < totalRules && (
                  <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-1.5 py-0.2 rounded shrink-0">
                    Filter Active
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button 
              onClick={onToggle} 
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs cursor-pointer"
              aria-label="Collapse panel"
              title="Collapse Rules & Details panel"
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
              {/* Preset Actions: Enable All, Disable All, Reset in One Line */}
              <div className="flex items-center gap-1.5 p-1 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl shadow-2xs">
                <button
                  onClick={onEnableAllRules}
                  disabled={isAllEnabled}
                  className="flex-1 py-1.5 px-2 text-[11px] font-semibold bg-white text-emerald-700 border border-emerald-300/80 rounded-lg hover:bg-emerald-50 disabled:opacity-40 transition-colors shadow-2xs flex items-center justify-center gap-1 whitespace-nowrap min-w-0"
                  title={`Enable all validation checks (${totalRules})`}
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Enable All</span>
                </button>
                <button
                  onClick={onDisableAllRules}
                  disabled={isNoneEnabled}
                  className="flex-1 py-1.5 px-2 text-[11px] font-semibold bg-white text-red-700 border border-red-300/80 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors shadow-2xs flex items-center justify-center gap-1 whitespace-nowrap min-w-0"
                  title="Disable all validation checks"
                >
                  <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="truncate">Disable All</span>
                </button>
                <button
                  onClick={onResetRules}
                  className="flex-1 py-1.5 px-2 text-[11px] font-semibold bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs flex items-center justify-center gap-1 whitespace-nowrap min-w-0"
                  title="Reset rules to default active state"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">Reset</span>
                </button>
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
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Switch Toggle */}
                            <div className="shrink-0">
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
                            </div>
                          </div>

                          {/* Right Controls: Read More Info Button & Live Issue Count Badge */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {/* Read More button on the right */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRuleForModal(rule);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title={`Read detailed explanation for ${rule.name}`}
                              aria-label={`Read detailed explanation for ${rule.name}`}
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>

                            {/* Live Issue Count Badge */}
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

      {/* ========================================================================= */}
      {/* RULE EXPLANATION OVERLAY MODAL / BOX                                      */}
      {/* ========================================================================= */}
      {selectedRuleForModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedRuleForModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4 overflow-hidden relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  selectedRuleForModal.severity === 'error' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">
                    {selectedRuleForModal.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                      {selectedRuleForModal.category}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      selectedRuleForModal.severity === 'error' ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100'
                    }`}>
                      {selectedRuleForModal.severity}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ID: {selectedRuleForModal.id}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedRuleForModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close rule explanation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Explanation */}
            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-1">Summary</h4>
                <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-slate-600">
                  {selectedRuleForModal.shortDesc}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-1">Detailed Explanation & Publishing Specification</h4>
                <p className="text-slate-700 text-xs leading-relaxed">
                  {selectedRuleForModal.fullDescription || selectedRuleForModal.shortDesc}
                </p>
              </div>

              {/* Status & Quick Toggle Inside Modal */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between gap-3 mt-2">
                <div className="text-xs">
                  <span className="font-bold text-blue-950 block">Current Status:</span>
                  <span className={enabledRuleIds.has(selectedRuleForModal.id) ? 'text-emerald-700 font-semibold' : 'text-slate-500 font-semibold'}>
                    {enabledRuleIds.has(selectedRuleForModal.id) ? 'Active (Checking & Flagging)' : 'Disabled (Suppressed in validation)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleRule && onToggleRule(selectedRuleForModal.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                    enabledRuleIds.has(selectedRuleForModal.id)
                      ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {enabledRuleIds.has(selectedRuleForModal.id) ? 'Disable Rule' : 'Enable Rule'}
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRuleForModal(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
