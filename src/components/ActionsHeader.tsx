import React from 'react';
import type { ImageAnalysisResult } from '../types';
import { CopyIcon } from './icons/CopyIcon';
import { SuccessIcon } from './icons/SuccessIcon';
import { MergeIcon } from './icons/MergeIcon';

interface ActionsHeaderProps {
  isMerging: boolean;
  copyStatus: 'idle' | 'copied';
  contactSheetStatus: string;
  imageAnalysisResults: ImageAnalysisResult[];
  onMergeAndDownload: () => void;
  onCopy: () => void;
}

export const ActionsHeader: React.FC<ActionsHeaderProps> = ({
    isMerging,
    copyStatus,
    contactSheetStatus,
    imageAnalysisResults,
    onMergeAndDownload,
    onCopy,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
        {contactSheetStatus === 'success' && imageAnalysisResults.length > 0 && (
            <button
                onClick={onMergeAndDownload}
                disabled={isMerging}
                title="Merge & Download Data"
                className="flex items-center justify-center w-10 h-10 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition-all disabled:bg-purple-400 disabled:cursor-not-allowed"
            >
                {isMerging ? ( <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> ) : 
                ( <MergeIcon className="w-6 h-6" /> )}
            </button>
        )}
        <button
            onClick={onCopy}
            title="Copy Sorted Data"
            className="flex items-center justify-center w-10 h-10 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-75 transition-all"
        >
            {copyStatus === 'copied' ? <SuccessIcon className="w-6 h-6" /> : <CopyIcon className="w-5 h-5" />}
        </button>
    </div>
  );
};