
export interface HeaderIndices {
  bragStatusColIndex?: number;
  usageColIndex: number;
  descColIndex: number;
  imgNoColIndex: number;
  sourceColIndex: number;
  rightsColIndex: number;
  ackColIndex: number;
  pageColIndex: number;
  photologColIndex: number;
  statusReclearedColIndex?: number;
  selectionsMadeColIndex?: number;
  feeColIndex: number;
  notesColIndex: number;
  jcCommentsColIndex?: number;
  aptaraCommentsColIndex?: number;
  poNumColIndex?: number;
}

export interface AcknowledgementRecord {
  bragStatus?: string;
  source: string;
  acknowledgement: string;
  pageNumber: string;
  usageClassification: string;
  licenseFee: string;
  originalRowIndex: number;
  description?: string;
  libraryImageNo?: string;
  rightsType?: string;
  photologCreation?: string;
  statusRecleared?: string;
  selectionsMade?: string;
  notes?: string;
  jcComments?: string;
  aptaraComments?: string;
  poNumber?: string;
}

export type AppStatus = 'idle' | 'processing' | 'success' | 'error';
export type AIAnalysisStatus = 'idle' | 'running' | 'completed' | 'error' | 'skipped';

export type ActiveView = 'credits' | 'uploadedLog' | 'dataHealth' | 'analysis' | 'history' | 'export';

export type AIFlaggedRecord = AcknowledgementRecord & {
  reason: string;
};

export interface ProcessedExcelData {
  records: AcknowledgementRecord[];
  isbn: string | null;
  title: string | null;
  rawData: (string | number)[][];
  headerRowIndex: number;
  columnIndices: HeaderIndices;
}

// Types for Image Analysis Feature
export interface ExtractedImage {
  imageBase64: string;
  mimeType: string;
  associatedText: string;
}

export interface ImageAnalysisResult {
  pageNumber: string;
  description: string;
  status: 'success' | 'error' | 'processing';
  // Data needed for display and retry
  mimeType: string;
  imageBase64: string;
}

export type ContactSheetStatus = 'idle' | 'processing' | 'describing' | 'success' | 'error';
