import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  ArrowUp, ArrowDown, ArrowUpDown, MoreVertical, 
  Pin, Copy, AlertCircle, Database, Layers 
} from 'lucide-react';
import type { 
  GridColumnDef, 
  GridDensity, 
  StoredGridSettings, 
  ColumnFilterValue 
} from './types';
import { HeaderMenu } from './HeaderMenu';
import { GridToolbar } from './GridToolbar';

interface ExcelDataGridProps<T = any> {
  tableId: string;
  data: T[];
  columns: GridColumnDef<T>[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  getRowId?: (row: T, index: number) => string | number;
  getRowNumber?: (row: T, index: number) => number;
  getRowClassName?: (row: T, index: number) => string;
  extraToolbarActions?: React.ReactNode;
  showRowNumbers?: boolean;
}

export function ExcelDataGrid<T = any>({
  tableId,
  data,
  columns: userColumns,
  loading = false,
  error = null,
  emptyMessage = 'No records found',
  onRowClick,
  onRowDoubleClick,
  getRowId,
  getRowNumber,
  getRowClassName,
  extraToolbarActions,
  showRowNumbers = true,
}: ExcelDataGridProps<T>) {
  const storageKey = `excel_grid_settings_${tableId}`;

  // Load saved settings from localStorage
  const savedSettings = useMemo<StoredGridSettings | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to parse grid settings for table', tableId, e);
    }
    return null;
  }, [storageKey, tableId]);

  // Density state: Compact (~32px), Default (~38px), Comfortable (~46px)
  const [density, setDensity] = useState<GridDensity>(savedSettings?.density || 'compact');
  const [isWrapText, setIsWrapText] = useState<boolean>(savedSettings?.isWrapText || false);

  // Column widths
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initialWidths: Record<string, number> = {};
    userColumns.forEach(c => {
      initialWidths[c.id] = savedSettings?.columnWidths?.[c.id] ?? c.defaultWidth ?? 140;
    });
    return initialWidths;
  });

  // Column order & visibility
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (savedSettings?.columnOrder && savedSettings.columnOrder.length > 0) {
      // Ensure all valid columns are present
      const validIds = new Set(userColumns.map(c => c.id));
      const filteredSaved = savedSettings.columnOrder.filter(id => validIds.has(id));
      userColumns.forEach(c => {
        if (!filteredSaved.includes(c.id)) filteredSaved.push(c.id);
      });
      return filteredSaved;
    }
    return userColumns.map(c => c.id);
  });

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (savedSettings?.hiddenColumns) {
      return new Set(savedSettings.hiddenColumns);
    }
    return new Set(userColumns.filter(c => c.hidden).map(c => c.id));
  });

  // Column Pinning
  const [pinnedColumns, setPinnedColumns] = useState<{ left: string[]; right: string[] }>(() => {
    if (savedSettings?.pinnedColumns) {
      return savedSettings.pinnedColumns;
    }
    const left: string[] = [];
    const right: string[] = [];
    userColumns.forEach(c => {
      if (c.pinned === 'left') left.push(c.id);
      else if (c.pinned === 'right') right.push(c.id);
    });
    return { left, right };
  });

  // Sorting state (multi-sort capable)
  const [sorting, setSorting] = useState<SortingState>(() => {
    return savedSettings?.sorting || [];
  });

  // Filtering state
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterValue>>(() => {
    return savedSettings?.filters || {};
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Active cell & row selection (for arrow-key navigation)
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colId: string } | null>(null);

  // Header menu popup state
  const [activeMenuColId, setActiveMenuColId] = useState<string | null>(null);

  // Column resizing state
  const [resizingCol, setResizingCol] = useState<{ colId: string; startX: number; startWidth: number } | null>(null);

  // Header drag-and-drop state
  const [draggedHeaderId, setDraggedHeaderId] = useState<string | null>(null);
  const [dragOverHeaderId, setDragOverHeaderId] = useState<string | null>(null);

  // Toast feedback (e.g. for Copy cell)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2000);
  }, []);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex: number;
    colId: string;
    value: string;
    row: T;
  } | null>(null);

  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Persist settings to localStorage on changes
  useEffect(() => {
    const toSave: StoredGridSettings = {
      columnWidths,
      columnOrder,
      hiddenColumns: Array.from(hiddenColumns),
      pinnedColumns,
      density,
      isWrapText,
      sorting,
      filters: columnFilters,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save grid settings', e);
    }
  }, [columnWidths, columnOrder, hiddenColumns, pinnedColumns, density, isWrapText, sorting, columnFilters, storageKey]);

  // Unique values map for pick-from-values filtering
  const uniqueValuesByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    userColumns.forEach(col => {
      const set = new Set<string>();
      data.slice(0, 1000).forEach((row, idx) => {
        let val = '';
        if (col.accessorFn) {
          val = String(col.accessorFn(row, idx) ?? '');
        } else if (col.accessorKey) {
          val = String((row as any)[col.accessorKey] ?? '');
        }
        if (val.trim()) set.add(val.trim());
      });
      map.set(col.id, Array.from(set).sort());
    });
    return map;
  }, [userColumns, data]);

  // Filter data (global search + column filters)
  const filteredData = useMemo(() => {
    let result = data;

    // 1. Column filters
    const filterKeys = Object.keys(columnFilters);
    if (filterKeys.length > 0) {
      result = result.filter((row, idx) => {
        for (const colId of filterKeys) {
          const filter = columnFilters[colId];
          if (!filter) continue;

          const col = userColumns.find(c => c.id === colId);
          if (!col) continue;

          let val = '';
          if (col.accessorFn) {
            val = String(col.accessorFn(row, idx) ?? '');
          } else if (col.accessorKey) {
            val = String((row as any)[col.accessorKey] ?? '');
          }

          if (filter.type === 'text' && filter.textValue) {
            if (!val.toLowerCase().includes(filter.textValue.toLowerCase())) {
              return false;
            }
          } else if (filter.type === 'number') {
            const num = parseFloat(val);
            if (isNaN(num)) return false;
            if (filter.numberMin !== '' && filter.numberMin !== undefined && num < filter.numberMin) {
              return false;
            }
            if (filter.numberMax !== '' && filter.numberMax !== undefined && num > filter.numberMax) {
              return false;
            }
          } else if (filter.type === 'values' && filter.selectedValues) {
            const trimmed = val.trim();
            if (!filter.selectedValues.includes(trimmed)) {
              return false;
            }
          }
        }
        return true;
      });
    }

    // 2. Global search across all visible columns
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row, idx) => {
        return userColumns.some(col => {
          if (hiddenColumns.has(col.id)) return false;
          let val = '';
          if (col.accessorFn) {
            val = String(col.accessorFn(row, idx) ?? '');
          } else if (col.accessorKey) {
            val = String((row as any)[col.accessorKey] ?? '');
          }
          return val.toLowerCase().includes(q);
        });
      });
    }

    return result;
  }, [data, columnFilters, searchQuery, userColumns, hiddenColumns]);

  // TanStack Table Column Definitions
  const tableColumns = useMemo<ColumnDef<T, any>[]>(() => {
    return userColumns.map(col => {
      return {
        id: col.id,
        header: col.header,
        accessorFn: col.accessorFn ? (row, idx) => col.accessorFn!(row, idx) : (row) => (row as any)[col.accessorKey || col.id],
        enableSorting: col.enableSorting !== false,
      };
    });
  }, [userColumns]);

  // TanStack Table Instance
  const table = useReactTable({
    data: filteredData,
    columns: tableColumns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  // Row height based on density
  const rowHeight = useMemo(() => {
    if (density === 'compact') return 32;
    if (density === 'default') return 38;
    return 46;
  }, [density]);

  // Row Virtualizer for fast 10,000+ rows scrolling
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 25,
  });

  // Calculate dynamic Row Number column width based on max row count digits
  const rowNumberColWidth = useMemo(() => {
    if (!showRowNumbers) return 0;
    const maxDigits = String(Math.max(10, data.length)).length;
    // e.g. 2 digits = 28px, 3 digits = 34px, 4 digits = 40px, 5 digits = 46px
    return Math.max(28, 14 + maxDigits * 7);
  }, [showRowNumbers, data.length]);

  // Visible leaf columns in current order, respecting pinned positions
  const visibleOrderedColumns = useMemo(() => {
    const colMap = new Map<string, GridColumnDef<T>>();
    userColumns.forEach(c => colMap.set(c.id, c));

    const leftPins: GridColumnDef<T>[] = [];
    const centers: GridColumnDef<T>[] = [];
    const rightPins: GridColumnDef<T>[] = [];

    columnOrder.forEach(id => {
      if (hiddenColumns.has(id)) return;
      const col = colMap.get(id);
      if (!col) return;

      if (pinnedColumns.left.includes(id)) {
        leftPins.push(col);
      } else if (pinnedColumns.right.includes(id)) {
        rightPins.push(col);
      } else {
        centers.push(col);
      }
    });

    return [...leftPins, ...centers, ...rightPins];
  }, [userColumns, columnOrder, hiddenColumns, pinnedColumns]);

  // Compute sticky horizontal offsets for left & right pinned columns
  const pinnedOffsets = useMemo(() => {
    const leftOffsets: Record<string, number> = {};
    const rightOffsets: Record<string, number> = {};

    let currentLeft = showRowNumbers ? rowNumberColWidth : 0;
    visibleOrderedColumns.forEach(col => {
      if (pinnedColumns.left.includes(col.id)) {
        leftOffsets[col.id] = currentLeft;
        currentLeft += (columnWidths[col.id] ?? col.defaultWidth ?? 140);
      }
    });

    let currentRight = 0;
    [...visibleOrderedColumns].reverse().forEach(col => {
      if (pinnedColumns.right.includes(col.id)) {
        rightOffsets[col.id] = currentRight;
        currentRight += (columnWidths[col.id] ?? col.defaultWidth ?? 140);
      }
    });

    return { leftOffsets, rightOffsets };
  }, [visibleOrderedColumns, pinnedColumns, columnWidths, showRowNumbers, rowNumberColWidth]);

  // Total table width
  const totalTableWidth = useMemo(() => {
    let width = showRowNumbers ? rowNumberColWidth : 0;
    visibleOrderedColumns.forEach(col => {
      width += (columnWidths[col.id] ?? col.defaultWidth ?? 140);
    });
    return Math.max(width, 600);
  }, [showRowNumbers, rowNumberColWidth, visibleOrderedColumns, columnWidths]);

  // Double click header edge to auto-fit
  const handleAutoFitColumn = useCallback((colId: string) => {
    const col = userColumns.find(c => c.id === colId);
    if (!col) return;

    // Scan sample of up to 100 visible rows to estimate max text width
    let maxLen = col.header.length;
    data.slice(0, 100).forEach((row, idx) => {
      let val = '';
      if (col.accessorFn) val = String(col.accessorFn(row, idx) ?? '');
      else if (col.accessorKey) val = String((row as any)[col.accessorKey] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });

    // Approximate character width in pixels + padding
    const calculatedWidth = Math.max(col.minWidth || 48, Math.min(col.maxWidth || 600, maxLen * 8.5 + 24));
    setColumnWidths(prev => ({
      ...prev,
      [colId]: Math.round(calculatedWidth),
    }));
    showToast(`Auto-fitted "${col.header}" to ${Math.round(calculatedWidth)}px`);
  }, [userColumns, data, showToast]);

  // Handle column resize dragging
  const handleMouseDownResize = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentW = columnWidths[colId] || userColumns.find(c => c.id === colId)?.defaultWidth || 140;
    setResizingCol({
      colId,
      startX: e.clientX,
      startWidth: currentW,
    });
  };

  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizingCol.startX;
      const targetCol = userColumns.find(c => c.id === resizingCol.colId);
      const minW = targetCol?.minWidth || 40;
      const maxW = targetCol?.maxWidth || 800;
      const newWidth = Math.max(minW, Math.min(maxW, Math.round(resizingCol.startWidth + delta)));

      setColumnWidths(prev => ({
        ...prev,
        [resizingCol.colId]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, userColumns]);

  // Reset View handler
  const handleResetView = useCallback(() => {
    const initialWidths: Record<string, number> = {};
    userColumns.forEach(c => {
      initialWidths[c.id] = c.defaultWidth ?? 140;
    });
    setColumnWidths(initialWidths);
    setColumnOrder(userColumns.map(c => c.id));
    setHiddenColumns(new Set(userColumns.filter(c => c.hidden).map(c => c.id)));
    
    const left: string[] = [];
    const right: string[] = [];
    userColumns.forEach(c => {
      if (c.pinned === 'left') left.push(c.id);
      else if (c.pinned === 'right') right.push(c.id);
    });
    setPinnedColumns({ left, right });
    
    setDensity('compact');
    setIsWrapText(false);
    setSorting([]);
    setColumnFilters({});
    setSearchQuery('');
    setSelectedCell(null);

    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}

    showToast('Grid view reset to defaults');
  }, [userColumns, storageKey, showToast]);

  // Keyboard navigation & Copy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell || tableRows.length === 0) return;

      // Don't hijack if user is typing inside an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const { rowIndex, colId } = selectedCell;
      const colIdx = visibleOrderedColumns.findIndex(c => c.id === colId);

      // Ctrl+C / Cmd+C: Copy selected cell value
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const row = tableRows[rowIndex]?.original;
        if (!row) return;

        const col = userColumns.find(c => c.id === colId);
        let cellVal = '';
        if (col?.accessorFn) cellVal = String(col.accessorFn(row, rowIndex) ?? '');
        else if (col?.accessorKey) cellVal = String((row as any)[col.accessorKey] ?? '');

        navigator.clipboard.writeText(cellVal);
        showToast('Copied cell value');
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextRow = Math.min(tableRows.length - 1, rowIndex + 1);
        setSelectedCell({ rowIndex: nextRow, colId });
        rowVirtualizer.scrollToIndex(nextRow, { align: 'auto' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevRow = Math.max(0, rowIndex - 1);
        setSelectedCell({ rowIndex: prevRow, colId });
        rowVirtualizer.scrollToIndex(prevRow, { align: 'auto' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (colIdx < visibleOrderedColumns.length - 1) {
          setSelectedCell({ rowIndex, colId: visibleOrderedColumns[colIdx + 1].id });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (colIdx > 0) {
          setSelectedCell({ rowIndex, colId: visibleOrderedColumns[colIdx - 1].id });
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (visibleOrderedColumns.length > 0) {
          setSelectedCell({ rowIndex, colId: visibleOrderedColumns[0].id });
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        if (visibleOrderedColumns.length > 0) {
          setSelectedCell({ rowIndex, colId: visibleOrderedColumns[visibleOrderedColumns.length - 1].id });
        }
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        const nextRow = Math.min(tableRows.length - 1, rowIndex + 15);
        setSelectedCell({ rowIndex: nextRow, colId });
        rowVirtualizer.scrollToIndex(nextRow, { align: 'auto' });
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        const prevRow = Math.max(0, rowIndex - 15);
        setSelectedCell({ rowIndex: prevRow, colId });
        rowVirtualizer.scrollToIndex(prevRow, { align: 'auto' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, tableRows, visibleOrderedColumns, userColumns, rowVirtualizer, showToast]);

  // Context Menu handlers
  const handleCellContextMenu = (e: React.MouseEvent, rowIndex: number, colId: string, value: string, row: T) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCell({ rowIndex, colId });

    const menuW = 200;
    const menuH = 160;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 10);

    setContextMenu({
      x,
      y,
      rowIndex,
      colId,
      value,
      row,
    });
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const hasActiveFilters = Object.keys(columnFilters).length > 0 || !!searchQuery.trim();

  // Drag and drop for headers
  const handleHeaderDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedHeaderId(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleHeaderDragEnd = () => {
    setDraggedHeaderId(null);
    setDragOverHeaderId(null);
  };

  const handleHeaderDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedHeaderId && draggedHeaderId !== targetId) {
      setDragOverHeaderId(targetId);
    }
  };

  const handleHeaderDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedHeaderId || draggedHeaderId === targetId) {
      setDraggedHeaderId(null);
      setDragOverHeaderId(null);
      return;
    }

    const newOrder = [...columnOrder];
    const fromIdx = newOrder.indexOf(draggedHeaderId);
    const toIdx = newOrder.indexOf(targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedHeaderId);
      setColumnOrder(newOrder);
      showToast('Column reordered');
    }

    setDraggedHeaderId(null);
    setDragOverHeaderId(null);
  };

  return (
    <div 
      ref={gridContainerRef}
      className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden select-none relative"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none transition-all animate-in fade-in duration-150">
          {toastMessage}
        </div>
      )}

      {/* Slim Toolbar */}
      <GridToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        density={density}
        onDensityChange={setDensity}
        isWrapText={isWrapText}
        onToggleWrapText={() => setIsWrapText(prev => !prev)}
        columns={userColumns}
        columnOrder={columnOrder}
        hiddenColumns={hiddenColumns}
        onToggleColumnVisibility={(colId) => {
          setHiddenColumns(prev => {
            const next = new Set(prev);
            if (next.has(colId)) next.delete(colId);
            else next.add(colId);
            return next;
          });
        }}
        onReorderColumns={setColumnOrder}
        onResetView={handleResetView}
        totalRowCount={data.length}
        filteredRowCount={filteredData.length}
        hasActiveFilters={hasActiveFilters}
        onClearAllFilters={() => {
          setColumnFilters({});
          setSearchQuery('');
          showToast('Cleared all filters');
        }}
        extraActions={extraToolbarActions}
      />

      {/* Main Grid Viewport with Dual Scrollbars */}
      <div 
        ref={parentRef}
        className="flex-1 min-h-0 overflow-auto bg-white relative focus:outline-hidden"
        tabIndex={0}
      >
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading data grid...</span>
          </div>
        ) : error ? (
          <div className="h-64 flex flex-col items-center justify-center text-red-500 gap-2 p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-xs font-semibold">{error}</p>
            <button 
              onClick={handleResetView}
              className="mt-2 text-xs px-3 py-1 bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100 cursor-pointer"
            >
              Reset View
            </button>
          </div>
        ) : tableRows.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
            <Database className="w-8 h-8 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setColumnFilters({});
                  setSearchQuery('');
                }}
                className="mt-1 text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Clear all active filters
              </button>
            )}
          </div>
        ) : (
          <div 
            style={{ 
              width: `${totalTableWidth}px`, 
              minWidth: '100%', 
              height: `${rowVirtualizer.getTotalSize() + rowHeight}px`,
              position: 'relative' 
            }}
          >
            {/* Sticky Header Row */}
            <div 
              className="sticky top-0 z-30 flex bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 select-none shadow-2xs"
              style={{ height: `${rowHeight + 2}px` }}
            >
              {/* Row Number Header */}
              {showRowNumbers && (
                <div 
                  className="sticky left-0 z-40 bg-slate-100 border-r border-slate-200 flex items-center justify-center text-[11px] font-mono text-slate-400 uppercase tracking-wider shrink-0"
                  style={{ width: `${rowNumberColWidth}px`, minWidth: `${rowNumberColWidth}px` }}
                >
                  #
                </div>
              )}

              {/* Data Column Headers */}
              {visibleOrderedColumns.map((col) => {
                const width = columnWidths[col.id] ?? col.defaultWidth ?? 140;
                const isPinnedLeft = pinnedColumns.left.includes(col.id);
                const isPinnedRight = pinnedColumns.right.includes(col.id);
                const isFiltered = !!columnFilters[col.id];
                const sortState = sorting.find(s => s.id === col.id);
                const isSortedAsc = sortState ? !sortState.desc : false;
                const isSortedDesc = sortState ? sortState.desc : false;

                const stickyLeft = isPinnedLeft ? pinnedOffsets.leftOffsets[col.id] : undefined;
                const stickyRight = isPinnedRight ? pinnedOffsets.rightOffsets[col.id] : undefined;

                return (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={(e) => handleHeaderDragStart(e, col.id)}
                    onDragOver={(e) => handleHeaderDragOver(e, col.id)}
                    onDragEnd={handleHeaderDragEnd}
                    onDrop={(e) => handleHeaderDrop(e, col.id)}
                    className={`group relative flex items-center justify-between border-r border-slate-200/80 px-2 text-[12px] transition-colors ${
                      isPinnedLeft || isPinnedRight ? 'sticky z-30 bg-slate-100/90 backdrop-blur-2xs' : 'bg-slate-50'
                    } ${dragOverHeaderId === col.id ? 'bg-blue-100/60 border-l-2 border-l-blue-600' : 'hover:bg-slate-100/80'}`}
                    style={{
                      width: `${width}px`,
                      minWidth: `${col.minWidth || 40}px`,
                      maxWidth: col.maxWidth ? `${col.maxWidth}px` : undefined,
                      left: stickyLeft !== undefined ? `${stickyLeft}px` : undefined,
                      right: stickyRight !== undefined ? `${stickyRight}px` : undefined,
                    }}
                    title={col.headerTooltip || `${col.header} (Click to sort, drag to reorder)`}
                  >
                    {/* Header Label & Sort Indicator */}
                    <div 
                      onClick={(e) => {
                        // Click to sort, shift+click for multi-sort
                        const isMulti = e.shiftKey;
                        setSorting(prev => {
                          const current = prev.find(s => s.id === col.id);
                          if (!current) {
                            return isMulti ? [...prev, { id: col.id, desc: false }] : [{ id: col.id, desc: false }];
                          }
                          if (!current.desc) {
                            return isMulti 
                              ? prev.map(s => s.id === col.id ? { id: col.id, desc: true } : s)
                              : [{ id: col.id, desc: true }];
                          }
                          // Clear sort on 3rd click
                          return isMulti ? prev.filter(s => s.id !== col.id) : [];
                        });
                      }}
                      className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer overflow-hidden py-1"
                    >
                      <span className="truncate">{col.header}</span>

                      {/* Small Sort Arrow */}
                      {isSortedAsc && <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      {isSortedDesc && <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />}

                      {/* Filter Dot Indicator */}
                      {isFiltered && (
                        <span 
                          className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" 
                          title="Filter active on this column"
                        />
                      )}
                    </div>

                    {/* Header Menu Trigger ("⋮" button on hover) */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuColId(prev => prev === col.id ? null : col.id);
                        }}
                        className={`p-1 rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 cursor-pointer transition-opacity ${
                          activeMenuColId === col.id ? 'opacity-100 text-blue-600 bg-blue-50' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title="Column options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Header Popover Menu */}
                      {activeMenuColId === col.id && (
                        <HeaderMenu
                          columnDef={col}
                          isSortedAsc={isSortedAsc}
                          isSortedDesc={isSortedDesc}
                          isPinnedLeft={isPinnedLeft}
                          isPinnedRight={isPinnedRight}
                          activeFilter={columnFilters[col.id]}
                          uniqueValues={uniqueValuesByColumn.get(col.id)}
                          onSort={(desc) => {
                            if (desc === null) {
                              setSorting(prev => prev.filter(s => s.id !== col.id));
                            } else {
                              setSorting([{ id: col.id, desc }]);
                            }
                          }}
                          onPin={(pos) => {
                            setPinnedColumns(prev => {
                              const left = prev.left.filter(id => id !== col.id);
                              const right = prev.right.filter(id => id !== col.id);
                              if (pos === 'left') left.push(col.id);
                              else if (pos === 'right') right.push(col.id);
                              return { left, right };
                            });
                          }}
                          onAutoFit={() => handleAutoFitColumn(col.id)}
                          onHide={() => {
                            setHiddenColumns(prev => new Set([...prev, col.id]));
                            showToast(`Hidden "${col.header}"`);
                          }}
                          onSetFilter={(val) => {
                            setColumnFilters(prev => {
                              const next = { ...prev };
                              if (!val) delete next[col.id];
                              else next[col.id] = val;
                              return next;
                            });
                          }}
                          onClose={() => setActiveMenuColId(null)}
                        />
                      )}
                    </div>

                    {/* Column Resizing Handle */}
                    <div
                      draggable={false}
                      onDragStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => handleMouseDownResize(e, col.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleAutoFitColumn(col.id);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-10"
                      title="Drag to resize, double-click to auto-fit"
                    />
                  </div>
                );
              })}
            </div>

            {/* Virtualized Table Rows */}
            <div
              style={{
                position: 'absolute',
                top: `${rowHeight + 2}px`,
                left: 0,
                width: `${totalTableWidth}px`,
                transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                if (!row) return null;

                const originalRow = row.original;
                const rowIndex = virtualRow.index;
                const excelRowNum = getRowNumber ? getRowNumber(originalRow, rowIndex) : rowIndex + 1;
                const isSelectedRow = selectedCell?.rowIndex === rowIndex;
                const customRowClass = getRowClassName ? getRowClassName(originalRow, rowIndex) : '';

                return (
                  <div
                    key={virtualRow.key}
                    onClick={() => {
                      if (onRowClick) onRowClick(originalRow, rowIndex);
                    }}
                    onDoubleClick={() => {
                      if (onRowDoubleClick) onRowDoubleClick(originalRow, rowIndex);
                    }}
                    className={`flex border-b border-slate-100 hover:bg-sky-50/40 transition-colors ${
                      isSelectedRow ? 'bg-blue-50/70 font-medium' : 'bg-white'
                    } ${customRowClass}`}
                    style={{
                      height: `${rowHeight}px`,
                      lineHeight: `${rowHeight}px`,
                    }}
                  >
                    {/* Row Number Cell */}
                    {showRowNumbers && (
                      <div
                        className="sticky left-0 z-20 bg-slate-50/90 border-r border-slate-200 flex items-center justify-center text-[11px] font-mono text-slate-400 select-none shrink-0"
                        style={{ width: `${rowNumberColWidth}px`, minWidth: `${rowNumberColWidth}px` }}
                      >
                        {excelRowNum}
                      </div>
                    )}

                    {/* Data Cells */}
                    {visibleOrderedColumns.map((col, colIdx) => {
                      const width = columnWidths[col.id] ?? col.defaultWidth ?? 140;
                      const isPinnedLeft = pinnedColumns.left.includes(col.id);
                      const isPinnedRight = pinnedColumns.right.includes(col.id);
                      const stickyLeft = isPinnedLeft ? pinnedOffsets.leftOffsets[col.id] : undefined;
                      const stickyRight = isPinnedRight ? pinnedOffsets.rightOffsets[col.id] : undefined;

                      const isSelectedCell = selectedCell?.rowIndex === rowIndex && selectedCell?.colId === col.id;

                      let cellValue: any = '';
                      if (col.accessorFn) {
                        cellValue = col.accessorFn(originalRow, rowIndex);
                      } else if (col.accessorKey) {
                        cellValue = (originalRow as any)[col.accessorKey];
                      }

                      const stringVal = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';

                      // Alignment & font styling
                      let alignClass = 'text-left';
                      if (col.align === 'right' || col.type === 'number') {
                        alignClass = 'text-right tabular-nums';
                      } else if (col.align === 'center') {
                        alignClass = 'text-center';
                      }

                      let fontClass = 'text-[13px] text-slate-800';
                      if (col.type === 'id') {
                        fontClass = 'text-[12px] font-mono text-slate-700';
                      }

                      return (
                        <div
                          key={col.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCell({ rowIndex, colId: col.id });
                          }}
                          onContextMenu={(e) => handleCellContextMenu(e, rowIndex, col.id, stringVal, originalRow)}
                          className={`relative px-2 border-r border-slate-100 flex items-center ${alignClass} ${fontClass} ${
                            isPinnedLeft || isPinnedRight ? 'sticky z-10 bg-slate-50/95 backdrop-blur-2xs' : ''
                          } ${isSelectedCell ? 'ring-2 ring-blue-500 ring-inset z-20 bg-blue-50/90' : ''} ${
                            col.className || ''
                          }`}
                          style={{
                            width: `${width}px`,
                            minWidth: `${col.minWidth || 40}px`,
                            maxWidth: col.maxWidth ? `${col.maxWidth}px` : undefined,
                            left: stickyLeft !== undefined ? `${stickyLeft}px` : undefined,
                            right: stickyRight !== undefined ? `${stickyRight}px` : undefined,
                          }}
                          title={stringVal}
                        >
                          {col.cell ? (
                            col.cell({
                              row: originalRow,
                              value: cellValue,
                              rowIndex,
                              colIndex: colIdx,
                              isSelected: isSelectedCell,
                            })
                          ) : (
                            <span className={isWrapText ? 'line-clamp-2 leading-tight py-0.5' : 'truncate w-full block'}>
                              {stringVal || <span className="text-slate-300">-</span>}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-xs text-slate-700 w-48 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.value);
              showToast('Copied cell value');
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy cell</span>
          </button>

          <button
            onClick={() => {
              // Copy whole row as TSV
              const tsvRow = visibleOrderedColumns.map(col => {
                if (col.accessorFn) return String(col.accessorFn(contextMenu.row, contextMenu.rowIndex) ?? '');
                if (col.accessorKey) return String((contextMenu.row as any)[col.accessorKey] ?? '');
                return '';
              }).join('\t');

              navigator.clipboard.writeText(tsvRow);
              showToast('Copied row as TSV');
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy row (TSV)</span>
          </button>

          <div className="h-px bg-slate-100 my-1" />

          <button
            onClick={() => {
              handleAutoFitColumn(contextMenu.colId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>Auto-fit column</span>
          </button>
        </div>
      )}
    </div>
  );
}
