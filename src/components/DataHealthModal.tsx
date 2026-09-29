import React, { useState } from 'react';
import type { AIFlaggedRecord, AIAnalysisStatus } from '../types';
import { ErrorIcon } from './icons/ErrorIcon';
import { SuccessIcon } from './icons/SuccessIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { CopyIcon } from './icons/CopyIcon';
import { CloseIcon } from './icons/CloseIcon';

interface GroupedValidation {
    groupedReasons: Map<string, AIFlaggedRecord[]>;
    individualReasons: { item: AIFlaggedRecord; reasons: string[] }[];
}

const groupValidationFlags = (flags: AIFlaggedRecord[]): GroupedValidation => {
    // A predefined list of prefixes for multi-row validation errors that should be grouped.
    const groupablePrefixes = [
        "Image Used Too Many Times:",
        "Ambiguous Pair",
        "Inconsistent Pair"
    ];

    const isGroupableReason = (reason: string): boolean => {
        return groupablePrefixes.some(prefix => reason.startsWith(prefix));
    };

    const groupedReasons = new Map<string, AIFlaggedRecord[]>();
    const individualReasonsByRow = new Map<number, { item: AIFlaggedRecord; reasons: string[] }>();

    // Partition reasons into grouped or individual buckets based on the prefix list.
    flags.forEach(flag => {
        const reasons = flag.reason.split('|||');
        const individualForRow: string[] = [];
        
        reasons.forEach(reason => {
            if (isGroupableReason(reason)) {
                // This is a grouped reason. Add it to the main map.
                const existingFlags = groupedReasons.get(reason) || [];
                if (!existingFlags.some(f => f.originalRowIndex === flag.originalRowIndex)) {
                    existingFlags.push(flag);
                    groupedReasons.set(reason, existingFlags);
                }
            } else {
                // This is an individual reason for this row.
                individualForRow.push(reason);
            }
        });

        if (individualForRow.length > 0) {
             if (!individualReasonsByRow.has(flag.originalRowIndex)) {
                 individualReasonsByRow.set(flag.originalRowIndex, { item: flag, reasons: [] });
            }
            // Add the individual reasons to the specific row's list.
            const existingReasons = individualReasonsByRow.get(flag.originalRowIndex)!.reasons;
            individualForRow.forEach(r => {
                if (!existingReasons.includes(r)) {
                    existingReasons.push(r);
                }
            });
        }
    });

    const individualReasons = Array.from(individualReasonsByRow.values());
    
    return { groupedReasons, individualReasons };
};


interface DataHealthModalProps {
    isOpen: boolean;
    onClose: () => void;
    dataValidationFlags: AIFlaggedRecord[];
    aiAnalysisStatus: AIAnalysisStatus;
    aiFlags: AIFlaggedRecord[];
    onRunAiAnalysis: () => void;
    originalRecordCount: number;
}

export const DataHealthModal: React.FC<DataHealthModalProps> = ({
    isOpen,
    onClose,
    dataValidationFlags,
    aiAnalysisStatus,
    aiFlags,
    onRunAiAnalysis,
    originalRecordCount,
}) => {
    
    const [copyValidationStatus, setCopyValidationStatus] = useState<'idle' | 'copied'>('idle');

    if (!isOpen) {
        return null;
    }

    const handleCopyValidationIssues = () => {
        if (dataValidationFlags.length === 0) return;

        const { groupedReasons, individualReasons } = groupValidationFlags(dataValidationFlags);
        let textToCopy = "Data Validation Issues & Warnings:\n\n";
    
        groupedReasons.forEach((flags, reason) => {
            const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
            const prefix = reason.startsWith('[WARNING]') ? "[WARNING] " : "";
            textToCopy += `${prefix}${cleanReason}\n\n`;
        });

        individualReasons.forEach(({item, reasons}) => {
            textToCopy += `Row ${item.originalRowIndex + 1} (Page: ${item.pageNumber || 'N/A'})\n`;
            reasons.forEach(reason => {
                 const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
                 const prefix = reason.startsWith('[WARNING]') ? "- [WARNING] " : "- ";
                 textToCopy += `${prefix}${cleanReason}\n`;
            });
            textToCopy += '\n';
        });

        navigator.clipboard.writeText(textToCopy.trim()).then(() => {
            setCopyValidationStatus('copied');
            setTimeout(() => setCopyValidationStatus('idle'), 2000);
        }).catch(err => {
            console.error('Failed to copy validation issues: ', err);
            alert('Failed to copy data to clipboard.');
        });
    };

    const renderDataValidationSection = () => {
        if (dataValidationFlags.length > 0) {
            // Partition flags into errors vs warning-only flags
            const errorFlags = dataValidationFlags.filter(flag => {
                const reasons = flag.reason.split('|||');
                return reasons.some(r => !r.startsWith('[WARNING]'));
            });

            const warningFlags = dataValidationFlags.filter(flag => {
                const reasons = flag.reason.split('|||');
                return reasons.every(r => r.startsWith('[WARNING]'));
            });

            const renderIssueList = (flagsList: AIFlaggedRecord[], isWarning: boolean) => {
                if (flagsList.length === 0) return null;
                const { groupedReasons, individualReasons } = groupValidationFlags(flagsList);

                const textHeaderClass = isWarning ? 'text-amber-800' : 'text-red-800';
                const textSubClass = isWarning ? 'text-amber-700' : 'text-red-700';
                const listTextClass = isWarning ? 'text-amber-600' : 'text-red-600';
                const rowLabelClass = isWarning ? 'text-amber-900' : 'text-red-900';
                const reasonTextClass = isWarning ? 'text-amber-800' : 'text-red-800';

                return (
                    <div className={`p-4 rounded-lg border ${isWarning ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex justify-between items-center">
                            <h4 className={`font-semibold ${textHeaderClass} flex items-center gap-2`}>
                                {isWarning ? (
                                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">!</div>
                                ) : (
                                    <ErrorIcon className="w-5 h-5"/>
                                )}
                                <span>{isWarning ? 'Concerning Anomalies / Warnings (Non-Critical)' : 'Data Validation Errors Found'}</span>
                            </h4>
                        </div>

                        <p className={`${textSubClass} mt-2`}>
                            {isWarning 
                                ? 'The following entries are flagged as concerning but are not strict errors:' 
                                : 'The following entries violate strict data validation rules:'}
                        </p>
                        <ul className={`mt-2 ${listTextClass} max-h-96 overflow-y-auto space-y-2`}>
                            {Array.from(groupedReasons.keys()).map((reason, i) => {
                                const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
                                return (
                                    <li key={`group-${i}`}>
                                        <em className={reasonTextClass}>{cleanReason}</em>
                                    </li>
                                );
                            })}
                            {individualReasons.map(({item, reasons}, i) => (
                                 <li key={`individual-${i}`}>
                                    <strong className={rowLabelClass}>Row {item.originalRowIndex + 1}</strong> (Page: {item.pageNumber || 'N/A'})
                                    <ul className="list-disc list-inside mt-1 pl-4 space-y-0.5">
                                        {reasons.map((reason, j) => {
                                            const cleanReason = reason.startsWith('[WARNING]') ? reason.replace('[WARNING] ', '').replace('[WARNING]', '') : reason;
                                            return (
                                                <li key={j}>
                                                    <em className={reasonTextClass}>{cleanReason}</em>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            };

            return (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={handleCopyValidationIssues}
                            title="Copy all validation issues"
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            {copyValidationStatus === 'copied' ? (
                                <>
                                    <SuccessIcon className="w-4 h-4 text-green-600" />
                                    <span>Copied All</span>
                                </>
                            ) : (
                                <>
                                    <CopyIcon className="w-4 h-4" />
                                    <span>Copy All Issues</span>
                                </>
                            )}
                        </button>
                    </div>

                    {renderIssueList(errorFlags, false)}
                    {renderIssueList(warningFlags, true)}
                </div>
            );
        }

        if (originalRecordCount > 0) {
            return (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <SuccessIcon className="w-5 h-5 text-green-600"/>
                    <p className="font-semibold text-green-800">Data Validation Passed. No rule violations found.</p>
                </div>
            );
        }
        
        return null;
    };

    const renderAiFlagsContent = (flags: AIFlaggedRecord[]) => (
        <>
            <p className="text-orange-700 mt-1">The AI flagged the following entries as potential errors. Please review them:</p>
            <ul className="list-disc list-inside mt-2 text-orange-600 max-h-48 overflow-y-auto space-y-1">
                {flags.map((item, i) => (
                    <li key={i}>
                        <strong>{item.source} / {item.acknowledgement}</strong> (Page: {item.pageNumber})
                        <br/>
                        <em className="text-orange-800 pl-2">&rarr; AI reason: {item.reason}</em>
                    </li>
                ))}
            </ul>
        </>
    );

    const renderAiAnalysisSection = () => {
        switch (aiAnalysisStatus) {
            case 'running':
                return (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-4 animate-pulse">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <div>
                            <h4 className="font-semibold text-blue-800">AI Data Quality Check...</h4>
                            <p className="text-blue-700 mt-1 text-xs">Analyzing data for anomalies.</p>
                        </div>
                    </div>
                );
            case 'completed':
                if (aiFlags.length > 0) {
                    return (
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                            <h4 className="font-semibold text-orange-800 flex items-center gap-2 pr-2"><ErrorIcon className="w-5 h-5"/> AI Check Complete</h4>
                            {renderAiFlagsContent(aiFlags)}
                        </div>
                    );
                }
                return (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                        <SuccessIcon className="w-5 h-5 text-green-600"/>
                        <p className="font-semibold text-green-800">AI Data Quality Check Complete. No issues found.</p>
                    </div>
                );
            case 'idle':
            case 'skipped':
                return (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <h4 className="font-semibold text-slate-800">AI Data Quality Check</h4>
                        <p className="text-sm text-slate-600 mt-1 mb-4">Find potential formatting errors, inconsistencies, or typos in your data.</p>
                        <button
                            onClick={onRunAiAnalysis}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-colors"
                        >
                            <SparklesIcon className="w-5 h-5" />
                            <span>Run AI Check</span>
                        </button>
                    </div>
                );
            case 'error':
                 return (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="font-semibold text-red-800 flex items-center gap-2"><ErrorIcon className="w-5 h-5"/> AI Data Quality Check Failed</h4>
                        <p className="text-red-700 mt-1">The AI analysis could not be completed. You can still use the sorted data.</p>
                    </div>
                 );
            default:
                return null;
        }
    }
    
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center animate-fade-in-fast"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-slate-800">Data Health Report</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close">
                        <CloseIcon className="w-6 h-6 text-slate-600" />
                    </button>
                </header>
                <main className="p-6 flex-grow overflow-y-auto">
                    <div className="space-y-4 text-sm">
                        {renderDataValidationSection()}
                        {renderAiAnalysisSection()}
                    </div>
                </main>
            </div>
        </div>
    );
};