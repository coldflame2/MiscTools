import type { ReactNode } from 'react';

export type ColumnType = 'text' | 'number' | 'id' | 'status' | 'custom';

export type GridDensity = 'compact' | 'default' | 'comfortable';

export interface GridColumnDef<T = any> {
  id: string;
  header: string;
  accessorKey?: string;
  accessorFn?: (row: T, index: number) => any;
  type?: ColumnType;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  pinned?: 'left' | 'right' | false;
  hidden?: boolean;
  cell?: (info: { row: T; value: any; rowIndex: number; colIndex: number; isSelected?: boolean; isWrapped?: boolean }) => ReactNode;
  headerTooltip?: string;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableResizing?: boolean;
  defaultWrap?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface StoredGridSettings {
  columnWidths: Record<string, number>;
  columnOrder: string[];
  hiddenColumns: string[];
  pinnedColumns: { left: string[]; right: string[] };
  density: GridDensity;
  isWrapText: boolean;
  columnWraps?: Record<string, boolean>;
  sorting: { id: string; desc: boolean }[];
  filters: Record<string, ColumnFilterValue>;
}

export interface ColumnFilterValue {
  type: 'text' | 'number' | 'values';
  textValue?: string;
  numberMin?: number | '';
  numberMax?: number | '';
  selectedValues?: string[];
}
