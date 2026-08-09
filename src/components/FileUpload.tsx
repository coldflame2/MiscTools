import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { Clipboard, FileSpreadsheet, Globe, Link as LinkIcon } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onPasteText?: (text: string) => void;
  onOnlineUrlSelect?: (url: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onPasteText, onOnlineUrlSelect }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pastedContent, setPastedContent] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [showUrlArea, setShowUrlArea] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.tsv')
      ) {
        onFileSelect(file);
      } else {
        alert('Please upload a valid Excel or tabular log file (.xlsx, .xls, .csv, .tsv).');
      }
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  }, [onFileSelect]);

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pastedContent.trim() && onPasteText) {
      onPasteText(pastedContent.trim());
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onlineUrl.trim() && onOnlineUrlSelect) {
      onOnlineUrlSelect(onlineUrl.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Box */}
      <div 
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragging ? 'border-blue-500 bg-blue-50/80 shadow-md' : 'border-slate-300 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-100/50'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          type="file"
          id="file-input"
          className="hidden"
          accept=".xlsx, .xls, .csv, .tsv"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center">
          <UploadIcon className="w-12 h-12 text-slate-400 mb-2" />
          <p className="text-base font-semibold text-slate-700">
            Drag & drop your local Excel file here
          </p>
          <p className="text-sm text-slate-500 mt-1">
            or <span className="text-blue-600 font-semibold underline">click to browse</span>
          </p>
          <p className="text-xs text-slate-400 mt-2">Supports .xlsx, .xls, .csv, and .tsv files</p>
        </div>
      </div>

      {/* Online Excel Link Option Toggle */}
      {onOnlineUrlSelect && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setShowUrlArea(!showUrlArea);
              if (showPasteArea) setShowPasteArea(false);
            }}
            className="flex items-center justify-between w-full text-left font-medium text-xs text-slate-700 hover:text-blue-600 transition-colors"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>Review online Excel link (Google Sheets / OneDrive / Web URL)</span>
            </span>
            <span className="text-[11px] text-blue-600 font-semibold">{showUrlArea ? 'Hide' : 'Expand Link Box'}</span>
          </button>

          {showUrlArea && (
            <form onSubmit={handleUrlSubmit} className="mt-3 space-y-2">
              <div className="relative">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="url"
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/... or https://.../log.xlsx"
                  className="w-full text-xs p-2.5 pl-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Paste any publicly accessible Excel file link, Google Sheets link, or OneDrive/SharePoint download link.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={!onlineUrl.trim()}
                  className="px-4 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  Fetch & Process Online Excel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Paste Option Toggle */}
      {onPasteText && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setShowPasteArea(!showPasteArea);
              if (showUrlArea) setShowUrlArea(false);
            }}
            className="flex items-center justify-between w-full text-left font-medium text-xs text-slate-700 hover:text-blue-600 transition-colors"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Clipboard className="w-4 h-4 text-blue-500" />
              <span>Or paste tabular log data directly</span>
            </span>
            <span className="text-[11px] text-blue-600 font-semibold">{showPasteArea ? 'Hide' : 'Expand Paste Box'}</span>
          </button>

          {showPasteArea && (
            <form onSubmit={handlePasteSubmit} className="mt-3 space-y-2">
              <textarea
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                placeholder="Paste tab-separated or copied Excel log rows here (starting from header row)..."
                rows={5}
                className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={!pastedContent.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Process Pasted Log
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
