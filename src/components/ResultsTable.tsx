import React, { useState } from 'react';
import type { AcknowledgementRecord, AIFlaggedRecord } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ErrorIcon } from './icons/ErrorIcon';


interface ResultsTableProps {
  coverData: AcknowledgementRecord[];
  nonCoverData: AcknowledgementRecord[];
  dataValidationFlags: AIFlaggedRecord[];
}

const renderTableRows = (data: AcknowledgementRecord[], validationFlagsMap: Map<number, string>) => (
  <>
    {data.map((item) => {
        const validationReason = validationFlagsMap.get(item.originalRowIndex);
        const isFlagged = !!validationReason;
        const reasons = validationReason ? validationReason.split('|||') : [];

        return (
            <tr key={item.originalRowIndex} className={`transition-colors align-top ${isFlagged ? 'bg-red-50 hover:bg-red-100' : 'odd:bg-white even:bg-slate-50 hover:bg-blue-50'}`}>
                <td className="px-2 py-1.5 whitespace-nowrap text-sm font-medium text-slate-800">{item.source}</td>
                <td className="px-2 py-1.5 whitespace-normal text-sm text-slate-600">
                    <span>{item.acknowledgement}</span>
                     {isFlagged && (
                        <div className="mt-1 space-y-1 border-l-2 border-red-300 pl-2">
                            {reasons.map((reason, index) => (
                                <div key={index} className="flex items-start gap-1 text-red-800">
                                    <ErrorIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                                    <span className="text-xs font-semibold">{reason}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-sm text-slate-600 text-center">{item.pageNumber}</td>
            </tr>
        );
    })}
  </>
);

export const ResultsTable: React.FC<ResultsTableProps> = ({ 
    coverData, nonCoverData, 
    dataValidationFlags,
}) => {
    const [isCoverExpanded, setIsCoverExpanded] = useState(true);
    const [isMainExpanded, setIsMainExpanded] = useState(true);

    const validationFlagsMap = new Map<number, string>(
        dataValidationFlags.map(flag => [flag.originalRowIndex, flag.reason])
    );
    
  return (
    <div className="animate-fade-in flex flex-col gap-1">
        <div className="w-full">
            <div className="overflow-auto max-h-[80vh] border border-slate-200 rounded-lg shadow-inner">
                <table className="min-w-full divide-y divide-slate-300">
                <thead className="bg-slate-50 sticky top-0 z-20">
                    <tr>
                    <th scope="col" className="w-1/4 px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Source
                    </th>
                    <th scope="col" className="w-2/4 px-2 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Acknowledgement
                    </th>
                    <th scope="col" className="px-2 py-2 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Page
                    </th>
                    </tr>
                </thead>
                    {coverData.length > 0 && (
                        <tbody className="bg-white divide-y divide-slate-200">
                            <tr>
                                <td colSpan={3} className="px-2 py-1 bg-slate-100 sticky top-[33px] z-10">
                                     <button
                                        onClick={() => setIsCoverExpanded(!isCoverExpanded)}
                                        className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 text-black text-sm rounded-md hover:bg-slate-300 transition-colors shadow-sm"
                                    >
                                        <span>Cover Credits</span>
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isCoverExpanded ? 'rotate-180' : 'rotate-0'}`} />
                                    </button>
                                </td>
                            </tr>
                            {isCoverExpanded && renderTableRows(coverData, validationFlagsMap)}
                        </tbody>
                    )}
                    {nonCoverData.length > 0 && (
                        <tbody className="bg-white divide-y divide-slate-200">
                             <tr>
                                <td colSpan={3} className="px-2 py-1 bg-slate-100 sticky top-[33px] z-10">
                                     <button
                                        onClick={() => setIsMainExpanded(!isMainExpanded)}
                                        className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 text-black text-sm rounded-md hover:bg-slate-300 transition-colors shadow-sm"
                                    >
                                        <span>Main Content Credits</span>
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isMainExpanded ? 'rotate-180' : 'rotate-0'}`} />
                                    </button>
                                </td>
                            </tr>
                            {isMainExpanded && renderTableRows(nonCoverData, validationFlagsMap)}
                        </tbody>
                    )}
                </table>
            </div>
        </div>
    </div>
  );
};