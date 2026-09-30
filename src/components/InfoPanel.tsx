import React from 'react';
import type { AcknowledgementRecord } from '../types';
import { DetailsIcon } from './icons/DetailsIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';

interface InfoPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    fileName: string;
    originalRecordCount: number;
    totalSources: number;
    coverCreditsCount: number;
    mainCreditsCount: number;
    removedDuplicates: AcknowledgementRecord[];
    crossCategoryDuplicates: AcknowledgementRecord[];
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
    isOpen,
    onToggle,
    fileName,
    originalRecordCount,
    totalSources,
    coverCreditsCount,
    mainCreditsCount,
    removedDuplicates,
    crossCategoryDuplicates,
}) => {
    if (!isOpen) {
        return (
            <aside className="relative flex-shrink-0 w-11 transition-all duration-300">
                <div className="h-full bg-white rounded-xl shadow-md border border-slate-200 flex flex-col items-center py-4 select-none">
                    <button 
                        onClick={onToggle} 
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors shadow-2xs"
                        aria-label="Expand Details panel"
                        title="Expand Details panel"
                    >
                        <ChevronRightIcon className="w-4 h-4 rotate-180 transform" />
                    </button>
                    
                    <button 
                        onClick={onToggle}
                        className="mt-6 flex flex-col items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors group"
                        title="Click to expand Details panel"
                    >
                        <DetailsIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        <span 
                            className="font-bold text-[11px] tracking-wider uppercase text-slate-500 group-hover:text-blue-600"
                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                            Details
                        </span>
                    </button>
                </div>
            </aside>
        );
    }
    
    return (
        <aside className="relative transition-all duration-300 flex-shrink-0 w-80 lg:w-96">
            <div className="h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <DetailsIcon className="w-5 h-5 text-blue-600" />
                        <span>Details</span>
                    </h2>
                    <button 
                        onClick={onToggle} 
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        aria-label="Collapse panel"
                        title="Collapse panel"
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 h-full overflow-y-auto space-y-6">
                    {/* Process Results Section */}
                    <section>
                         <h3 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Process Results</h3>
                         <div className="text-xs space-y-1.5 text-slate-600">
                            <p><strong>File:</strong> <span className="font-medium text-slate-800 break-all">{fileName}</span></p>
                         </div>
                    </section>

                    {/* Summary Section */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Summary</h3>
                        <ul className="text-xs space-y-2 text-slate-600">
                            <li className="flex justify-between items-center"><span>Total Sources:</span> <span className="font-mono font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">{totalSources}</span></li>
                            <li className="flex justify-between items-center"><span>Cover Credits:</span> <span className="font-mono font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">{coverCreditsCount}</span></li>
                            <li className="flex justify-between items-center"><span>Main Credits:</span> <span className="font-mono font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">{mainCreditsCount}</span></li>
                            <li className="pt-2 border-t border-slate-100 flex justify-between items-center"><strong>Original Entries:</strong> <span className="font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{originalRecordCount}</span></li>
                        </ul>
                    </section>
                    
                    {(removedDuplicates.length > 0 || crossCategoryDuplicates.length > 0) && (
                        <section>
                            <details className="group bg-slate-50 border border-slate-200 rounded-lg overflow-hidden transition-all duration-300">
                                <summary className="p-3 cursor-pointer flex justify-between items-center font-semibold text-xs text-slate-700 hover:bg-slate-100 list-none">
                                    <span>View Duplicate Information</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-transform duration-300 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" >
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </summary>
                                <div className="p-3 border-t border-slate-200 space-y-3 text-xs">
                                    {removedDuplicates.length > 0 && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <h4 className="font-semibold text-amber-800">Removed Duplicates</h4>
                                            <p className="text-amber-700 text-[11px] mt-0.5">The following duplicate entries were found within their respective sections and removed:</p>
                                            <ul className="list-disc list-inside mt-2 text-amber-700 max-h-24 overflow-y-auto space-y-0.5">
                                                {removedDuplicates.map((item, i) => <li key={i}><strong>{item.source}:</strong> {item.acknowledgement}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                    {crossCategoryDuplicates.length > 0 && (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <h4 className="font-semibold text-blue-800">Cover and Main</h4>
                                            <p className="text-blue-700 text-[11px] mt-0.5">The following acknowledgements appear in both Cover and Main Content sections (both entries were kept):</p>
                                            <ul className="list-disc list-inside mt-2 text-blue-700 max-h-24 overflow-y-auto space-y-0.5">
                                                {crossCategoryDuplicates.map((item, i) => <li key={i}><strong>{item.source}:</strong> {item.acknowledgement}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </details>
                        </section>
                    )}
                </div>
            </div>
        </aside>
    );
};