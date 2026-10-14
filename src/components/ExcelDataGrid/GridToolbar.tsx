import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, SlidersHorizontal, WrapText, RotateCcw, 
  Check, X, Eye, EyeOff, GripVertical, FilterX 
} from 'lucide-react';
import type { GridColumnDef, GridDensity } from './types';

interface GridToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  density: GridDensity;
  onDensityChange: (density: GridDensity) => void;
  isWrapText: boolean;
  onToggleWrapText: () => void;
  columns: GridColumnDef[];
  columnOrder: string[];
  hiddenColumns: Set<string>;
  onToggleColumnVisibility: (colId: string) => void;
  onReorderColumns: (newOrder: string[]) => void;
  onResetView: () => void;
  totalRowCount: number;
  filteredRowCount: number;
  hasActiveFilters: boolean;
  onClearAllFilters: () => void;
  extraActions?: React.ReactNode;
}

export const GridToolbar: React.FC<GridToolbarProps> = ({
  searchQuery,
  onSearchChange,
  density,
  onDensityChange,
  isWrapText,
  onToggleWrapText,
  columns,
  columnOrder,
  hiddenColumns,
  onToggleColumnVisibility,
  onReorderColumns,
  onResetView,
  totalRowCount,
  filteredRowCount,
  hasActiveFilters,
  onClearAllFilters,
  extraActions,
}) => {
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const columnsPopoverRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop state for column manager popover
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (columnsPopoverRef.current && !columnsPopoverRef.current.contains(e.target as Node)) {
        setIsColumnsOpen(false);
      }
    };
    if (isColumnsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isColumnsOpen]);

  // Columns in current order
  const colMap = new Map<string, GridColumnDef>();
  columns.forEach(c => colMap.set(c.id, c));
  const orderedCols = columnOrder.map(id => colMap.get(id)).filter((c): c is GridColumnDef => !!c);

  const filteredColsForPopover = orderedCols.filter(col => {
    if (!columnSearch.trim()) return true;
    return col.header.toLowerCase().includes(columnSearch.toLowerCase());
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetId) return;
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetId) return;

    const currentOrder = [...columnOrder];
    const fromIndex = currentOrder.indexOf(draggedColId);
    const toIndex = currentOrder.indexOf(targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      currentOrder.splice(fromIndex, 1);
      currentOrder.splice(toIndex, 0, draggedColId);
      onReorderColumns(currentOrder);
    }
    setDraggedColId(null);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-white border-b border-slate-200 text-xs shrink-0 select-none">
      {/* Left: Global Search & Active Filter Chips */}
      <div className="flex items-center gap-2 flex-1 max-w-xl">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search all columns..."
            className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Clear Filters Chip */}
        {hasActiveFilters && (
          <button
            onClick={onClearAllFilters}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-medium text-[11px] transition-colors cursor-pointer shrink-0"
            title="Clear all active column filters"
          >
            <FilterX className="w-3 h-3 text-blue-600" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {/* Right: Controls & Row Counts */}
      <div className="flex items-center gap-2 shrink-0">
        {extraActions}

        {/* Density Segmented Control */}
        <div className="flex items-center bg-slate-100 rounded-md p-0.5 border border-slate-200 text-[11px] text-slate-600">
          <button
            type="button"
            onClick={() => onDensityChange('compact')}
            className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${density === 'compact' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'}`}
            title="Compact rows (~32px)"
          >
            Compact
          </button>
          <button
            type="button"
            onClick={() => onDensityChange('default')}
            className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${density === 'default' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'}`}
            title="Default rows (~38px)"
          >
            Default
          </button>
          <button
            type="button"
            onClick={() => onDensityChange('comfortable')}
            className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${density === 'comfortable' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'}`}
            title="Comfortable rows (~46px)"
          >
            Comfortable
          </button>
        </div>

        {/* Wrap Text Toggle */}
        <button
          type="button"
          onClick={onToggleWrapText}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors ${isWrapText ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          title="Toggle wrap text"
        >
          <WrapText className="w-3.5 h-3.5" />
          <span>Wrap text</span>
        </button>

        {/* Columns Popover Toggle */}
        <div className="relative" ref={columnsPopoverRef}>
          <button
            type="button"
            onClick={() => setIsColumnsOpen(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors ${isColumnsOpen ? 'bg-slate-100 text-slate-900 border-slate-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            title="Show/hide and reorder columns"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Columns</span>
          </button>

          {isColumnsOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-2.5 space-y-2 text-xs animate-in fade-in duration-100">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-semibold text-slate-700">Columns ({orderedCols.length})</span>
                <span className="text-[10px] text-slate-400">Drag to reorder</span>
              </div>

              {/* Search inside columns */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  placeholder="Find column..."
                  className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-hidden focus:bg-white"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-0.5 border border-slate-100 rounded p-1">
                {filteredColsForPopover.map(col => {
                  const isVisible = !hiddenColumns.has(col.id);
                  return (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDrop={(e) => handleDrop(e, col.id)}
                      className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-grab active:cursor-grabbing text-slate-700 transition-colors ${draggedColId === col.id ? 'opacity-40 bg-blue-50' : ''}`}
                    >
                      <GripVertical className="w-3 h-3 text-slate-300 shrink-0" />
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => onToggleColumnVisibility(col.id)}
                        className="rounded text-blue-600 border-slate-300 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className={`truncate flex-1 text-[11px] ${isVisible ? 'font-medium' : 'text-slate-400 line-through'}`}>
                        {col.header}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Reset View Button */}
        <button
          type="button"
          onClick={onResetView}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
          title="Restore default widths, order, pins, density, sorts and filters"
        >
          <RotateCcw className="w-3 h-3 text-slate-400" />
          <span>Reset view</span>
        </button>

        {/* Row Count */}
        <div className="text-[11px] font-medium text-slate-500 pl-1 border-l border-slate-200 whitespace-nowrap">
          Showing <span className="text-slate-800 font-semibold">{filteredRowCount.toLocaleString()}</span> of <span className="text-slate-800">{totalRowCount.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
