import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowUp, ArrowDown, Pin, PinOff, EyeOff, Sparkles, Filter, 
  RotateCcw, Check, Search, X, WrapText 
} from 'lucide-react';
import type { GridColumnDef, ColumnFilterValue } from './types';

interface HeaderMenuProps {
  columnDef: GridColumnDef;
  isSortedAsc: boolean;
  isSortedDesc: boolean;
  isPinnedLeft: boolean;
  isPinnedRight: boolean;
  isWrapped: boolean;
  activeFilter?: ColumnFilterValue;
  uniqueValues?: string[];
  position?: { x: number; y: number };
  onSort: (desc: boolean | null) => void;
  onPin: (position: 'left' | 'right' | false) => void;
  onToggleWrap: () => void;
  onAutoFit: () => void;
  onHide: () => void;
  onSetFilter: (filter: ColumnFilterValue | null) => void;
  onClose: () => void;
}

export const HeaderMenu: React.FC<HeaderMenuProps> = ({
  columnDef,
  isSortedAsc,
  isSortedDesc,
  isPinnedLeft,
  isPinnedRight,
  isWrapped,
  activeFilter,
  uniqueValues = [],
  position,
  onSort,
  onPin,
  onToggleWrap,
  onAutoFit,
  onHide,
  onSetFilter,
  onClose
}) => {
  const [tab, setTab] = useState<'menu' | 'filter'>('menu');
  const [filterType, setFilterType] = useState<'text' | 'number' | 'values'>(
    activeFilter?.type || (columnDef.type === 'number' ? 'number' : 'text')
  );
  const [textFilter, setTextFilter] = useState(activeFilter?.textValue || '');
  const [minNum, setMinNum] = useState<number | ''>(activeFilter?.numberMin ?? '');
  const [maxNum, setMaxNum] = useState<number | ''>(activeFilter?.numberMax ?? '');
  const [selectedValues, setSelectedValues] = useState<Set<string>>(() => {
    if (activeFilter?.selectedValues) {
      return new Set(activeFilter.selectedValues);
    }
    return new Set(uniqueValues);
  });
  const [valueSearch, setValueSearch] = useState('');

  const filteredUniqueValues = useMemo(() => {
    if (!valueSearch.trim()) return uniqueValues;
    const q = valueSearch.toLowerCase();
    return uniqueValues.filter(v => v.toLowerCase().includes(q));
  }, [uniqueValues, valueSearch]);

  const handleApplyFilter = () => {
    if (filterType === 'text') {
      if (!textFilter.trim()) {
        onSetFilter(null);
      } else {
        onSetFilter({
          type: 'text',
          textValue: textFilter.trim()
        });
      }
    } else if (filterType === 'number') {
      if (minNum === '' && maxNum === '') {
        onSetFilter(null);
      } else {
        onSetFilter({
          type: 'number',
          numberMin: minNum,
          numberMax: maxNum
        });
      }
    } else {
      if (selectedValues.size === uniqueValues.length) {
        onSetFilter(null); // all selected = no filter
      } else {
        onSetFilter({
          type: 'values',
          selectedValues: Array.from(selectedValues)
        });
      }
    }
    onClose();
  };

  const handleClearFilter = () => {
    setTextFilter('');
    setMinNum('');
    setMaxNum('');
    setSelectedValues(new Set(uniqueValues));
    onSetFilter(null);
    onClose();
  };

  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number } | null>(position || null);

  useEffect(() => {
    if (!position) return;
    const updatePos = () => {
      const menuWidth = 260; // w-64 is 256px + margin
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // Detect if menu overflows right side of viewport:
      // If position.x + menuWidth > viewportWidth - 12, shift left so right edge fits on screen!
      if (x + menuWidth > viewportWidth - 12) {
        x = Math.max(12, viewportWidth - menuWidth - 12);
      }
      if (x < 12) {
        x = 12;
      }
      if (y + 320 > viewportHeight - 12 && position.y > 320) {
        y = Math.max(12, position.y - 320);
      }
      setAdjustedPos({ x, y });
    };

    updatePos();
  }, [position]);

  // Click outside and scroll listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the menu list itself
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  return (
    <div 
      ref={menuRef}
      className={`${adjustedPos ? 'fixed' : 'absolute top-full mt-1 right-0'} z-50 w-64 bg-white rounded-lg shadow-xl border border-slate-200 text-xs text-slate-700 py-1.5 animate-in fade-in zoom-in-95 duration-100`}
      style={adjustedPos ? { top: `${adjustedPos.y}px`, left: `${adjustedPos.x}px` } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      {tab === 'menu' ? (
        <div className="space-y-0.5">
          <div className="px-3 py-1 font-semibold text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 flex items-center justify-between">
            <span className="truncate">{columnDef.header}</span>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sort Controls */}
          <button
            onClick={() => { onSort(false); onClose(); }}
            className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer ${isSortedAsc ? 'text-blue-600 font-medium bg-blue-50/50' : ''}`}
          >
            <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort Ascending</span>
            {isSortedAsc && <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />}
          </button>

          <button
            onClick={() => { onSort(true); onClose(); }}
            className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer ${isSortedDesc ? 'text-blue-600 font-medium bg-blue-50/50' : ''}`}
          >
            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort Descending</span>
            {isSortedDesc && <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />}
          </button>

          {(isSortedAsc || isSortedDesc) && (
            <button
              onClick={() => { onSort(null); onClose(); }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Sort</span>
            </button>
          )}

          <div className="h-px bg-slate-100 my-1" />

          {/* Pinning Controls */}
          <button
            onClick={() => { onPin(isPinnedLeft ? false : 'left'); onClose(); }}
            className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer ${isPinnedLeft ? 'text-blue-600 font-medium bg-blue-50/50' : ''}`}
          >
            <Pin className="w-3.5 h-3.5 text-slate-400" />
            <span>{isPinnedLeft ? 'Unpin from Left' : 'Pin to Left'}</span>
          </button>

          <button
            onClick={() => { onPin(isPinnedRight ? false : 'right'); onClose(); }}
            className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer ${isPinnedRight ? 'text-blue-600 font-medium bg-blue-50/50' : ''}`}
          >
            <Pin className="w-3.5 h-3.5 text-slate-400 rotate-90" />
            <span>{isPinnedRight ? 'Unpin from Right' : 'Pin to Right'}</span>
          </button>

          <div className="h-px bg-slate-100 my-1" />

          {/* Wrap Column Text Control */}
          <button
            onClick={() => { onToggleWrap(); onClose(); }}
            className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${isWrapped ? 'text-blue-600 font-medium bg-blue-50/50' : ''}`}
            title="Toggle text wrapping for this column"
          >
            <div className="flex items-center gap-2">
              <WrapText className="w-3.5 h-3.5 text-slate-400" />
              <span>Wrap column text</span>
            </div>
            {isWrapped && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          {/* Auto-Fit */}
          <button
            onClick={() => { onAutoFit(); onClose(); }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            <span>Auto-fit column</span>
          </button>

          {/* Filter Option */}
          <button
            onClick={() => setTab('filter')}
            className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${activeFilter ? 'text-blue-600 font-medium bg-blue-50/50' : ''}`}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter column...</span>
            </div>
            {activeFilter && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          </button>

          {/* Hide Column */}
          <button
            onClick={() => { onHide(); onClose(); }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />
            <span>Hide column</span>
          </button>
        </div>
      ) : (
        /* Filter Tab */
        <div className="p-2 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <button
              onClick={() => setTab('menu')}
              className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
            >
              ← Back
            </button>
            <span className="font-semibold text-slate-700">Filter {columnDef.header}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter Type Tabs */}
          <div className="flex rounded-md bg-slate-100 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterType('text')}
              className={`flex-1 py-1 rounded text-center font-medium cursor-pointer transition-colors ${filterType === 'text' ? 'bg-white shadow-2xs text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Contains
            </button>
            {columnDef.type === 'number' && (
              <button
                type="button"
                onClick={() => setFilterType('number')}
                className={`flex-1 py-1 rounded text-center font-medium cursor-pointer transition-colors ${filterType === 'number' ? 'bg-white shadow-2xs text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Range
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterType('values')}
              className={`flex-1 py-1 rounded text-center font-medium cursor-pointer transition-colors ${filterType === 'values' ? 'bg-white shadow-2xs text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Values ({uniqueValues.length})
            </button>
          </div>

          {/* Text Filter Input */}
          {filterType === 'text' && (
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500 font-medium">Text contains</label>
              <input
                type="text"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                placeholder="Search text..."
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyFilter();
                }}
              />
            </div>
          )}

          {/* Number Range Inputs */}
          {filterType === 'number' && (
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-500 font-medium">Min value</label>
                <input
                  type="number"
                  value={minNum}
                  onChange={(e) => setMinNum(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Min"
                  className="w-full px-2.5 py-1 border border-slate-200 rounded text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 font-medium">Max value</label>
                <input
                  type="number"
                  value={maxNum}
                  onChange={(e) => setMaxNum(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Max"
                  className="w-full px-2.5 py-1 border border-slate-200 rounded text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Pick-from-values Checklist */}
          {filterType === 'values' && (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  value={valueSearch}
                  onChange={(e) => setValueSearch(e.target.value)}
                  placeholder="Filter values..."
                  className="w-full pl-7 pr-2 py-1 border border-slate-200 rounded text-xs focus:outline-hidden focus:border-blue-500 bg-slate-50/50"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-blue-600 px-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedValues(new Set(uniqueValues))}
                  className="hover:underline cursor-pointer"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedValues(new Set())}
                  className="hover:underline text-slate-500 cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded p-1 space-y-0.5 bg-slate-50/30">
                {filteredUniqueValues.length === 0 ? (
                  <div className="text-slate-400 text-center py-2 text-[11px]">No matches</div>
                ) : (
                  filteredUniqueValues.map((val) => {
                    const isChecked = selectedValues.has(val);
                    return (
                      <label 
                        key={val} 
                        className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-slate-100 rounded cursor-pointer text-[11px] text-slate-700 select-none truncate"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedValues(prev => {
                              const next = new Set(prev);
                              if (next.has(val)) next.delete(val);
                              else next.add(val);
                              return next;
                            });
                          }}
                          className="rounded text-blue-600 border-slate-300 focus:ring-0 w-3 h-3"
                        />
                        <span className="truncate">{val || '(Empty)'}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClearFilter}
              className="text-xs text-slate-500 hover:text-red-600 cursor-pointer font-medium"
            >
              Reset
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyFilter}
                className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-2xs cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
