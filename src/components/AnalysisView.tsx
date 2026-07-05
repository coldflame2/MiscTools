import React from 'react';
import { ImageAnalysis } from './ImageAnalysis';
import type { ContactSheetStatus, ImageAnalysisResult } from '../types';

interface AnalysisViewProps {
  onProcessContactSheet: (file: File) => void;
  onProcessDirectImages: (files: File[]) => void;
  onResetContactSheet: () => void;
  onRetryFailedImages: () => void;
  contactSheetStatus: ContactSheetStatus;
  imageAnalysisResults: ImageAnalysisResult[];
  contactSheetError: string | null;
  processingProgress: { current: number; total: number };
}

export const AnalysisView: React.FC<AnalysisViewProps> = (props) => {
  return (
    <div className="animate-fade-in p-1">
      <ImageAnalysis {...props} />
    </div>
  );
};
