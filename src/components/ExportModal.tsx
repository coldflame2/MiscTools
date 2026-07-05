import React from 'react';
import { CloseIcon } from './icons/CloseIcon';
import { FileWordIcon } from './icons/FileWordIcon';
import { FileSheetIcon } from './icons/FileSheetIcon';
import { DownloadIcon } from './icons/DownloadIcon';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDownloadWord: () => void;
    onDownloadSortedLog: () => void;
    onDownloadOriginalLog: () => void;
    onDownloadAll: () => void;
    isDownloading: boolean;
    isDownloadingSorted: boolean;
    isDownloadingOriginal: boolean;
    isDownloadingAll: boolean;
}

const ExportOption: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    disabled: boolean;
    isLoading: boolean;
}> = ({ icon, title, description, onClick, disabled, isLoading }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center w-full p-4 text-left border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-slate-100 rounded-lg text-slate-600">
            {isLoading ? <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div> : icon}
        </div>
        <div className="ml-4 flex-grow">
            <p className="font-semibold text-slate-800">{title}</p>
            <p className="text-sm text-slate-500">{description}</p>
        </div>
    </button>
);


export const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    onDownloadWord,
    onDownloadSortedLog,
    onDownloadOriginalLog,
    onDownloadAll,
    isDownloading,
    isDownloadingSorted,
    isDownloadingOriginal,
    isDownloadingAll,
}) => {
    if (!isOpen) {
        return null;
    }
    
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center animate-fade-in-fast"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl h-auto flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-slate-800">Export Options</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
                        <CloseIcon className="w-6 h-6 text-slate-600" />
                    </button>
                </header>
                <main className="p-6 flex-grow overflow-y-auto">
                    <div className="space-y-6">
                        {/* Primary Export Action */}
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                             <ExportOption
                                icon={<FileWordIcon className="w-6 h-6 text-blue-700" />}
                                title="Final Credits (Word)"
                                description="Download the final, cleaned, and formatted acknowledgements document, ready for publication."
                                onClick={onDownloadWord}
                                isLoading={isDownloading}
                                disabled={isDownloading || isDownloadingSorted || isDownloadingOriginal || isDownloadingAll}
                            />
                        </div>

                        {/* Secondary Export Actions */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-3">Additional Downloads</h3>
                            <div className="space-y-3">
                                <ExportOption
                                    icon={<FileSheetIcon className="w-6 h-6" />}
                                    title="Sorted Original Log (Excel)"
                                    description="Downloads the complete original log with all columns, sorted by Source then Acknowledgement."
                                    onClick={onDownloadSortedLog}
                                    isLoading={isDownloadingSorted}
                                    disabled={isDownloading || isDownloadingSorted || isDownloadingOriginal || isDownloadingAll}
                                />
                                <ExportOption
                                    icon={<FileSheetIcon className="w-6 h-6" />}
                                    title="Original Log (Excel)"
                                    description="Downloads an Excel file of the original, unprocessed data as it was uploaded."
                                    onClick={onDownloadOriginalLog}
                                    isLoading={isDownloadingOriginal}
                                    disabled={isDownloading || isDownloadingSorted || isDownloadingOriginal || isDownloadingAll}
                                />
                            </div>
                        </div>

                        {/* Download All Action */}
                         <div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-3">Batch Export</h3>
                            <div className="space-y-3">
                                <ExportOption
                                    icon={<DownloadIcon className="w-6 h-6" />}
                                    title="Download Everything"
                                    description="Downloads all available files: Final Credits, Sorted Log, and Original Log."
                                    onClick={onDownloadAll}
                                    isLoading={isDownloadingAll}
                                    disabled={isDownloading || isDownloadingSorted || isDownloadingOriginal || isDownloadingAll}
                                />
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
};