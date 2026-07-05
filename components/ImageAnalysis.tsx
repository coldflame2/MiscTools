import React, { useState } from 'react';
import type { ContactSheetStatus, ImageAnalysisResult } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { ErrorIcon } from './icons/ErrorIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { SuccessIcon } from './icons/SuccessIcon';

interface ImageAnalysisProps {
  onProcessContactSheet: (file: File) => void;
  onProcessDirectImages: (files: File[]) => void;
  onResetContactSheet: () => void;
  onRetryFailedImages: () => void;
  contactSheetStatus: ContactSheetStatus;
  imageAnalysisResults: ImageAnalysisResult[];
  contactSheetError: string | null;
  processingProgress: { current: number; total: number };
}

const ContactSheetUploader: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
    const handleFileChange = (files: FileList | null) => {
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            onFileSelect(file);
          } else {
            alert('Please upload a valid PDF or DOCX file.');
          }
        }
    };

    return (
        <div 
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50"
            onClick={() => document.getElementById('contact-sheet-input')?.click()}
        >
            <input
                type="file"
                id="contact-sheet-input"
                className="hidden"
                accept=".pdf, .docx"
                onChange={(e) => handleFileChange(e.target.files)}
            />
            <div className="flex flex-col items-center justify-center">
                <UploadIcon className="w-12 h-12 text-slate-400 mb-3" />
                <p className="font-semibold text-slate-700">
                    Upload Contact Sheet
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    Drop a PDF or DOCX file here or <span className="text-blue-600 font-medium">click to browse</span>
                </p>
            </div>
        </div>
    );
};

const DirectImageUploader: React.FC<{ onFileSelect: (files: File[]) => void }> = ({ onFileSelect }) => {
    const handleFileChange = (files: FileList | null) => {
        if (files && files.length > 0) {
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            if (imageFiles.length > 0) {
                onFileSelect(imageFiles);
            } else {
                alert('Please select valid image files (e.g., JPG, PNG).');
            }
        }
    };

    return (
        <div 
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-blue-50"
            onClick={() => document.getElementById('direct-image-input')?.click()}
        >
            <input
                type="file"
                id="direct-image-input"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => handleFileChange(e.target.files)}
            />
            <div className="flex flex-col items-center justify-center">
                <UploadIcon className="w-12 h-12 text-slate-400 mb-3" />
                <p className="font-semibold text-slate-700">
                    Upload Images Directly
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    Drop multiple image files here or <span className="text-blue-600 font-medium">click to browse</span>
                </p>
            </div>
        </div>
    );
};

const ProgressBar: React.FC<{ current: number, total: number, status: ContactSheetStatus }> = ({ current, total, status }) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    const statusText = status === 'processing' ? 'Extracting images...' : `Generating descriptions... ${current} / ${total}`;

    return (
        <div className="w-full">
            <p className="text-center text-slate-600 mb-2">{statusText}</p>
            <div className="w-full bg-slate-200 rounded-full h-4">
                <div 
                    className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

const ResultsDisplay: React.FC<{ results: ImageAnalysisResult[] }> = ({ results }) => {
    if (results.length === 0) {
        return null;
    }
    return (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
            {results.map((result, index) => {
                const isError = result.status === 'error';
                const isProcessing = result.status === 'processing';
                
                return (
                    <div key={index} className={`p-3 rounded-md shadow-sm animate-fade-in border ${isError ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                         <p className="text-sm text-slate-500">
                            File: <span className="font-semibold text-slate-800 break-all">{result.pageNumber}</span>
                        </p>
                        <div className={`text-sm mt-1 pl-2 border-l-2 ${isError ? 'text-red-700 border-red-200' : 'text-slate-600 border-slate-200'}`}>
                            {isError && <ErrorIcon className="w-4 h-4 inline-block mr-1 -mt-1" />}
                            {isProcessing && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block mr-2 -mt-1"></div>}
                            <span>{result.description}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ 
    onProcessContactSheet, 
    onProcessDirectImages,
    onResetContactSheet,
    onRetryFailedImages,
    contactSheetStatus, 
    imageAnalysisResults, 
    contactSheetError,
    processingProgress
}) => {
    const [uploadMode, setUploadMode] = useState<'contactSheet' | 'direct'>('contactSheet');
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

    const hasFailedImages = imageAnalysisResults.some(r => r.status === 'error');

    const handleDownloadExcel = () => {
        if (isDownloadingExcel || imageAnalysisResults.length === 0) return;
        setIsDownloadingExcel(true);

        try {
            // @ts-ignore
            const XLSX = window.XLSX;
            if (!XLSX) {
                throw new Error('The library for creating Excel files (xlsx) could not be found.');
            }

            const headers = ["Filename", "Description"];
            const data = imageAnalysisResults
                .filter(r => r.status === 'success') // Only download successful results
                .map(result => [result.pageNumber, result.description]);

            if (data.length === 0) {
                alert("No successful image descriptions to download.");
                setIsDownloadingExcel(false);
                return;
            }

            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

            worksheet['!cols'] = [ { wch: 40 }, { wch: 80 } ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Image Descriptions");

            XLSX.writeFile(workbook, "Image_Analysis_Results.xlsx");

        } catch (err) {
            console.error("Failed to generate Excel file:", err);
            if (err instanceof Error) {
                alert(`Failed to generate Excel file: ${err.message}`);
            } else {
                alert("An unknown error occurred while generating the Excel file.");
            }
        } finally {
            setIsDownloadingExcel(false);
        }
    };

    const renderUploader = () => {
        if (uploadMode === 'contactSheet') {
            return <ContactSheetUploader onFileSelect={onProcessContactSheet} />;
        }
        return <DirectImageUploader onFileSelect={onProcessDirectImages} />;
    };
    
    const renderContent = () => {
        switch (contactSheetStatus) {
            case 'idle':
                return (
                    <div>
                        <div className="flex justify-center border-b border-slate-200 mb-4">
                            <button
                                onClick={() => setUploadMode('contactSheet')}
                                className={`px-4 py-2 text-sm font-semibold transition-colors ${uploadMode === 'contactSheet' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                From Contact Sheet
                            </button>
                            <button
                                onClick={() => setUploadMode('direct')}
                                className={`px-4 py-2 text-sm font-semibold transition-colors ${uploadMode === 'direct' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                From Image Files
                            </button>
                        </div>
                        {renderUploader()}
                    </div>
                );
            case 'processing':
                return <ProgressBar current={processingProgress.current} total={processingProgress.total} status={contactSheetStatus} />;
            case 'describing':
                return (
                    <div>
                        <ProgressBar current={processingProgress.current} total={processingProgress.total} status={contactSheetStatus} />
                        <div className="mt-6">
                           <ResultsDisplay results={imageAnalysisResults} />
                        </div>
                    </div>
                );
            case 'success':
                return (
                    <div>
                        <ResultsDisplay results={imageAnalysisResults} />
                        {imageAnalysisResults.length > 0 && (
                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                               {hasFailedImages && (
                                    <button
                                        onClick={onRetryFailedImages}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-75 transition-colors"
                                    >
                                        <span>Retry Failed</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleDownloadExcel}
                                    disabled={isDownloadingExcel}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition-all disabled:bg-green-400 disabled:cursor-not-allowed"
                                >
                                    {isDownloadingExcel ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <DownloadIcon className="w-5 h-5" />
                                            <span>Download Excel</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={onResetContactSheet}
                                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors"
                                >
                                    Analyze More Images
                                </button>
                            </div>
                        )}
                    </div>
                );
            case 'error':
                 return (
                    <div className="text-center p-6 bg-red-50 rounded-lg">
                        <ErrorIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <h4 className="font-semibold text-red-600 mb-1">Image Processing Failed</h4>
                        <p className="text-slate-600 text-sm mb-4">{contactSheetError}</p>
                        <button
                          onClick={onResetContactSheet}
                          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700"
                        >
                          Try Again
                        </button>
                    </div>
                 );
        }
    }

    return (
        <section>
            <h3 className="text-xl font-bold text-slate-700 mb-4">Image Analysis (Optional)</h3>
            {renderContent()}
        </section>
    );
};