
import React, { useState, useCallback } from 'react';
import { processExcelFile } from './services/excelProcessor';
import { analyzeAcknowledgements, describeImage } from './services/geminiService';
import { processContactSheet } from './services/contactSheetProcessor';
import { validateData } from './services/dataValidator';
import { FileUpload } from './components/FileUpload';
import { ResultsTable } from './components/ResultsTable';
import { ErrorIcon } from './components/icons/ErrorIcon';
import { ActionsHeader } from './components/ActionsHeader';
import { DropdownMenu } from './components/DropdownMenu';
import { InfoPanel } from './components/InfoPanel';
import { NavigationRail } from './components/NavigationRail';
import { EditableLogModal } from './components/EditableLogModal';
import { DataHealthModal } from './components/DataHealthModal';
import { ExportModal } from './components/ExportModal';
import { AnalysisView } from './components/AnalysisView';
import { FilenameParser } from './components/FilenameParser';
import { CreditsCreator } from './components/CreditsCreator';
import { ContactSheetsTab } from './components/ContactSheetsTab';
import type { AcknowledgementRecord, AppStatus, AIFlaggedRecord, ContactSheetStatus, ImageAnalysisResult, ExtractedImage, AIAnalysisStatus, HeaderIndices, ActiveView } from './types';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import saveAs from "file-saver";
import { EditIcon } from './components/icons/EditIcon';


const cleanAcknowledgement = (ack: string, source: string): string => {
  const cleanedAck = ack.trim();
  const cleanedSource = source.trim();

  if (!cleanedSource) return cleanedAck;

  const escapedSource = cleanedSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexEnd = new RegExp(`\\s*\\/\\s*${escapedSource}$`, 'i');
  const regexStart = new RegExp(`^${escapedSource}\\s*\\/\\s*`, 'i');

  let result = cleanedAck;
  if (regexEnd.test(result)) {
    result = result.replace(regexEnd, '');
  } else if (regexStart.test(result)) {
    result = result.replace(regexStart, '');
  }
  return result.trim();
};

const isCoverPage = (pageNumber: string): boolean => {
  const normalizedPageNumber = pageNumber.trim().toLowerCase();

  if (normalizedPageNumber === '') {
    return true;
  }

  const exactMatchKeywords = ['c'];
  if (exactMatchKeywords.includes(normalizedPageNumber)) {
    return true;
  }
  
  const partialMatchKeywords = [
    'cov',
    'cover',
    'cvr',
    'fc', // Front Cover
    'bc', // Back Cover
    'ifc', // Inside Front Cover
    'ibc', // Inside Back Cover
  ];

  return partialMatchKeywords.some(keyword => normalizedPageNumber.includes(keyword));
};


const processGroup = (records: AcknowledgementRecord[]): { uniqueRecords: AcknowledgementRecord[], duplicates: AcknowledgementRecord[] } => {
  const cleanedRecords = records.map(record => ({
    ...record,
    acknowledgement: cleanAcknowledgement(record.acknowledgement, record.source),
  }));

  const groupedBySource = new Map<string, AcknowledgementRecord[]>();
  cleanedRecords.forEach(record => {
    if (!groupedBySource.has(record.source)) {
      groupedBySource.set(record.source, []);
    }
    groupedBySource.get(record.source)?.push(record);
  });
  
  const sortedSources = Array.from(groupedBySource.keys()).sort((a, b) => a.localeCompare(b));
  
  const uniqueRecords: AcknowledgementRecord[] = [];
  const duplicates: AcknowledgementRecord[] = [];
  
  sortedSources.forEach(source => {
    const sourceRecords = groupedBySource.get(source) || [];
    sourceRecords.sort((a, b) => a.acknowledgement.localeCompare(b.acknowledgement));
    
    const seenKeys = new Set<string>();
    const sourceLower = source.trim().toLowerCase();

    sourceRecords.forEach(record => {
      let uniqueKey: string;
      if (sourceLower === 'n/a') {
        uniqueKey = `${record.acknowledgement}|${record.description || ''}`;
      } else {
        uniqueKey = record.acknowledgement;
      }

      if (seenKeys.has(uniqueKey)) {
        duplicates.push(record);
      } else {
        seenKeys.add(uniqueKey);
        uniqueRecords.push(record);
      }
    });
  });

  return { uniqueRecords, duplicates };
};


const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isbn, setIsbn] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [originalRecordCount, setOriginalRecordCount] = useState<number>(0);
  const [originalRecords, setOriginalRecords] = useState<AcknowledgementRecord[]>([]);
  
  const [coverData, setCoverData] = useState<AcknowledgementRecord[]>([]);
  const [nonCoverData, setNonCoverData] = useState<AcknowledgementRecord[]>([]);
  const [removedDuplicates, setRemovedDuplicates] = useState<AcknowledgementRecord[]>([]);
  const [crossCategoryDuplicates, setCrossCategoryDuplicates] = useState<AcknowledgementRecord[]>([]);
  
  // State for Data Validation
  const [dataValidationFlags, setDataValidationFlags] = useState<AIFlaggedRecord[]>([]);
  const [highlightedRowIndices, setHighlightedRowIndices] = useState<number[]>([]);


  // State for AI Analysis
  const [aiFlags, setAiFlags] = useState<AIFlaggedRecord[]>([]);
  const [aiAnalysisStatus, setAiAnalysisStatus] = useState<AIAnalysisStatus>('idle');


  // State for Contact Sheet Analysis
  const [contactSheetStatus, setContactSheetStatus] = useState<ContactSheetStatus>('idle');
  const [imageAnalysisResults, setImageAnalysisResults] = useState<ImageAnalysisResult[]>([]);
  const [contactSheetError, setContactSheetError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  // State for Actions Header & Exporting
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [isMerging, setIsMerging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false); // Final Credits (Word)
  const [isDownloadingSorted, setIsDownloadingSorted] = useState(false); // Sorted Original Log (Excel)
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState(false); // Original Log (Excel)
  const [isDownloadingAll, setIsDownloadingAll] = useState(false); // All files


  // UI State & File Data State
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [rawData, setRawData] = useState<(string | number)[][]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('credits');
  const [headerRowIndex, setHeaderRowIndex] = useState(-1);
  const [columnIndices, setColumnIndices] = useState<HeaderIndices | null>(null);
  const [activeTab, setActiveTab] = useState<'logReview' | 'newFeature' | 'creditsCreator' | 'contactSheets'>('logReview');


  const handleReset = () => {
    setStatus('idle');
    setError(null);
    setFileName('');
    setCoverData([]);
    setNonCoverData([]);
    setRemovedDuplicates([]);
    setCrossCategoryDuplicates([]);
    setDataValidationFlags([]);
    setHighlightedRowIndices([]);
    setAiFlags([]);
    setAiAnalysisStatus('idle');
    setIsbn(null);
    setTitle(null);
    setOriginalRecordCount(0);
    setOriginalRecords([]);
    setRawData([]);
    setContactSheetStatus('idle');
    setImageAnalysisResults([]);
    setContactSheetError(null);
    setProcessingProgress({ current: 0, total: 0 });
    setCopyStatus('idle');
    setIsMerging(false);
    setIsDownloading(false);
    setIsDownloadingSorted(false);
    setIsDownloadingOriginal(false);
    setIsDownloadingAll(false);
    setIsInfoPanelOpen(true);
    setIsEditModalOpen(false);
    setActiveView('credits');
    setHeaderRowIndex(-1);
    setColumnIndices(null);
  };

  const handleProcessFile = useCallback(async (file: File) => {
    setStatus('processing');
    setFileName(file.name);
    setError(null);
    setDataValidationFlags([]);
    setHighlightedRowIndices([]);
    setAiFlags([]);
    setAiAnalysisStatus('idle');
    setIsbn(null);
    setTitle(null);
    setOriginalRecordCount(0);
    setOriginalRecords([]);
    setRawData([]);
    setActiveView('credits');

    try {
      const { records: allRecords, isbn: fileIsbn, title: fileTitle, rawData: allRawData, headerRowIndex, columnIndices } = await processExcelFile(file);
      
      setHeaderRowIndex(headerRowIndex);
      setColumnIndices(columnIndices);

      const validationFlags = validateData(allRawData, headerRowIndex, columnIndices);
      setDataValidationFlags(validationFlags);
      setHighlightedRowIndices(validationFlags.map(flag => flag.originalRowIndex));


      setOriginalRecords(allRecords);
      setRawData(allRawData);
      setIsbn(fileIsbn);
      setTitle(fileTitle);
      setOriginalRecordCount(allRecords.length);

      const coverRecords = allRecords.filter(r => isCoverPage(r.pageNumber));
      const nonCoverRecords = allRecords.filter(r => !isCoverPage(r.pageNumber));

      const { uniqueRecords: processedCoverData, duplicates: coverDups } = processGroup(coverRecords);
      const { uniqueRecords: processedNonCoverData, duplicates: nonCoverDups } = processGroup(nonCoverRecords);

      setCoverData(processedCoverData);
      setNonCoverData(processedNonCoverData);
      setRemovedDuplicates([...coverDups, ...nonCoverDups].sort((a,b) => a.source.localeCompare(b.source)));

      const coverAckSet = new Set(processedCoverData.map(r => `${r.source}|${r.acknowledgement}`));
      const crossDups = processedNonCoverData.filter(r => coverAckSet.has(`${r.source}|${r.acknowledgement}`));
      setCrossCategoryDuplicates(crossDups);

      // Show results to user immediately
      setStatus('success');
      
      // Set AI analysis to skipped by default, user can trigger it manually.
      setAiAnalysisStatus('skipped');

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
      setStatus('error');
    }
  }, []);

  const handleRunAiAnalysis = async () => {
    setAiAnalysisStatus('running');
    try {
        const allUniqueData = [...coverData, ...nonCoverData];
        if (allUniqueData.length === 0) {
            setAiAnalysisStatus('completed'); // Nothing to analyze
            return;
        }
        const flaggedData = await analyzeAcknowledgements(allUniqueData);
        setAiFlags(flaggedData);
        setAiAnalysisStatus('completed');
    } catch (aiError) {
        console.error("AI analysis failed:", aiError);
        setAiAnalysisStatus('error');
    }
  };

  const findPageNumberFromText = (text: string): string => {
    const numbers = text.match(/\d+/g);
    return numbers ? numbers.join(', ') : 'N/A';
  };

  const getPageNumberFromFilename = (filename: string): string => {
    return filename;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // remove the data URL prefix: "data:image/jpeg;base64,"
            resolve(result.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
    });
  };

  const handleContactSheetReset = useCallback(() => {
    setContactSheetStatus('idle');
    setContactSheetError(null);
    setImageAnalysisResults([]);
    setProcessingProgress({ current: 0, total: 0 });
  }, []);

  const handleProcessContactSheet = useCallback(async (file: File) => {
    setContactSheetStatus('processing');
    setContactSheetError(null);
    setImageAnalysisResults([]);
    setProcessingProgress({ current: 0, total: 0 });

    try {
        const extractedImages: ExtractedImage[] = await processContactSheet(file);

        setContactSheetStatus('describing');
        setProcessingProgress({ current: 0, total: extractedImages.length });
        
        const currentResults: ImageAnalysisResult[] = extractedImages.map(image => ({
            pageNumber: findPageNumberFromText(image.associatedText),
            description: 'Processing...',
            status: 'processing',
            mimeType: image.mimeType,
            imageBase64: image.imageBase64,
        }));
        setImageAnalysisResults(currentResults);

        const CONCURRENCY_LIMIT = 2;
        let completedCount = 0;
        const queue = [...extractedImages.entries()];

        const worker = async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (!item) continue;
                
                const [index, image] = item;

                try {
                    const description = await describeImage(image.imageBase64, image.mimeType);
                    currentResults[index] = { ...currentResults[index], description, status: 'success' };
                } catch (err) {
                     const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                     currentResults[index] = { ...currentResults[index], description: `Gemini AI image description failed: ${errorMessage}`, status: 'error' };
                }
                completedCount++;
                setProcessingProgress({ current: completedCount, total: extractedImages.length });
                setImageAnalysisResults([...currentResults]);
            }
        };

        const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
        await Promise.all(workers);

        setContactSheetStatus('success');

    } catch (err) {
        if (err instanceof Error) {
            setContactSheetError(err.message);
        } else {
            setContactSheetError('An unexpected error occurred during contact sheet processing.');
        }
        setContactSheetStatus('error');
    }
  }, []);

  const handleProcessDirectImages = useCallback(async (files: File[]) => {
    setContactSheetStatus('describing');
    setContactSheetError(null);
    setProcessingProgress({ current: 0, total: files.length });

    const currentResults: ImageAnalysisResult[] = files.map(file => ({
        pageNumber: getPageNumberFromFilename(file.name),
        description: 'Processing...',
        status: 'processing',
        mimeType: file.type,
        imageBase64: '',
    }));
    setImageAnalysisResults(currentResults);

    const CONCURRENCY_LIMIT = 2;
    let completedCount = 0;
    const queue = [...files.entries()];

    const worker = async () => {
        while(queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;

            const [index, file] = item;
            
            try {
                const base64 = await fileToBase64(file);
                currentResults[index].imageBase64 = base64;
                const description = await describeImage(base64, file.type);
                currentResults[index] = { ...currentResults[index], description, status: 'success' };
            } catch (err) {
                 const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                 currentResults[index] = { ...currentResults[index], description: `Gemini AI image description failed: ${errorMessage}`, status: 'error' };
            }
            completedCount++;
            setProcessingProgress({ current: completedCount, total: files.length });
            setImageAnalysisResults([...currentResults]);
        }
    };
    
    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);
    
    setContactSheetStatus('success');
  }, []);
  
  const handleRetryFailedImages = useCallback(async () => {
    const failedImages = imageAnalysisResults.filter(r => r.status === 'error');
    if (failedImages.length === 0) return;

    setContactSheetStatus('describing');
    const totalRetries = failedImages.length;
    const totalOriginal = imageAnalysisResults.length;
    const completedOriginal = totalOriginal - imageAnalysisResults.filter(r => r.status !== 'success').length;

    setProcessingProgress({ current: completedOriginal, total: totalOriginal });
    
    // FIX: Add explicit type annotation to prevent type widening of the `status` property.
    const updatedResults: ImageAnalysisResult[] = imageAnalysisResults.map(r => r.status === 'error' ? { ...r, description: 'Retrying...', status: 'processing' } : r);
    setImageAnalysisResults(updatedResults);

    const CONCURRENCY_LIMIT = 2;
    let completedRetries = 0;
    const queue = [...failedImages];

    const worker = async () => {
        while(queue.length > 0) {
            const imageToRetry = queue.shift();
            if (!imageToRetry) continue;

            const originalIndex = updatedResults.findIndex(r => r.pageNumber === imageToRetry.pageNumber && r.status === 'processing');
            if (originalIndex === -1) continue;
            
            try {
                const description = await describeImage(imageToRetry.imageBase64, imageToRetry.mimeType);
                updatedResults[originalIndex] = { ...imageToRetry, description, status: 'success' };
            } catch (err) {
                 const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                 updatedResults[originalIndex] = { ...imageToRetry, description: `Gemini AI image description failed: ${errorMessage}`, status: 'error' };
            }
            completedRetries++;
            setProcessingProgress({ current: completedOriginal + completedRetries, total: totalOriginal });
            setImageAnalysisResults([...updatedResults]);
        }
    };

    const workers = Array(CONCURRENCY_LIMIT).fill(null).map(worker);
    await Promise.all(workers);
    
    setContactSheetStatus('success');
  }, [imageAnalysisResults]);

  // Action handlers
  const sanitizeFilename = (name: string): string => {
    let sanitized = name.replace(/\s+/g, '_');
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return sanitized;
  };

  const handleCopy = () => {
      let tsvContent = "Source\tAcknowledgement\tPage Number\n";
      
      if (coverData.length > 0) {
          tsvContent += "--- Cover Credits ---\n";
          tsvContent += coverData.map(row => `${row.source}\t${row.acknowledgement}\t${row.pageNumber}`).join('\n') + '\n';
      }
      if (nonCoverData.length > 0) {
          tsvContent += "--- Main Content Credits ---\n";
          tsvContent += nonCoverData.map(row => `${row.source}\t${row.acknowledgement}\t${row.pageNumber}`).join('\n') + '\n';
      }

      if (removedDuplicates.length > 0) {
          tsvContent += "\n--- Removed Duplicates ---\n";
          tsvContent += removedDuplicates.map(row => `${row.source}\t${row.acknowledgement}\t(Page: ${row.pageNumber})`).join('\n') + '\n';
      }

      if (crossCategoryDuplicates.length > 0) {
          tsvContent += "\n--- Note: Acknowledgements in Both Cover and Main Content ---\n";
          tsvContent += crossCategoryDuplicates.map(row => `${row.source}\t${row.acknowledgement}`).join('\n') + '\n';
      }

      navigator.clipboard.writeText(tsvContent).then(() => {
          setCopyStatus('copied');
          setTimeout(() => setCopyStatus('idle'), 2000);
      }).catch(err => {
          console.error('Failed to copy text: ', err);
          alert('Failed to copy data to clipboard.');
      });
  };

  // --- REUSABLE GENERATION HELPERS ---

  const generateWordBlob = async (): Promise<Blob> => {
      const defaultStyles = { font: "Calibri", size: 22 }; // size 22 in docx half-points = 11pt

      const formatGroupToRuns = (data: AcknowledgementRecord[]): any[] => {
          if (!data.length) return [];
  
          const groupedBySource = new Map<string, string[]>();
          data.forEach(record => {
              const source = record.source;
              if (!groupedBySource.has(source)) {
                  groupedBySource.set(source, []);
              }
              groupedBySource.get(source)!.push(record.acknowledgement);
          });
  
          const runs: any[] = [];
          const sortedSources = Array.from(groupedBySource.keys());
  
          sortedSources.forEach((source, index) => {
              const acks = groupedBySource.get(source)!;
              const ackString = acks.join(', ');
  
              runs.push(new TextRun({ text: source, bold: true, ...defaultStyles }));
              runs.push(new TextRun({ text: " ", ...defaultStyles }));
              runs.push(new TextRun({ text: "(", bold: true, ...defaultStyles }));
              runs.push(new TextRun({ text: ackString, ...defaultStyles }));
              runs.push(new TextRun({ text: ")", bold: true, ...defaultStyles }));
  
              if (index === sortedSources.length - 1) {
                  runs.push(new TextRun({ text: ".", ...defaultStyles }));
              } else {
                  runs.push(new TextRun({ text: "; ", bold: true, ...defaultStyles }));
              }
          });
          
          return runs;
      };
  
      const paragraphs = [
          new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Acknowledgements", bold: true, ...defaultStyles })],
          }),
          new Paragraph({ children: [new TextRun({ text: "", ...defaultStyles })] }),
      ];

      if (aiAnalysisStatus === 'completed' && aiFlags.length > 0) {
          paragraphs.push(new Paragraph({
              children: [new TextRun({ text: "Data Quality Warning", bold: true, ...defaultStyles })]
          }));
          paragraphs.push(new Paragraph({
              children: [new TextRun({ text: "The AI analysis flagged the following entries as potential errors. Please review them carefully:", ...defaultStyles })]
          }));
          aiFlags.forEach(flag => {
              paragraphs.push(new Paragraph({
                  bullet: { level: 0 },
                  children: [
                      new TextRun({ text: `Source: `, bold: true, ...defaultStyles }),
                      new TextRun({ text: `${flag.source}, `, ...defaultStyles }),
                      new TextRun({ text: `Acknowledgement: `, bold: true, ...defaultStyles }),
                      new TextRun({ text: `${flag.acknowledgement}, `, ...defaultStyles }),
                      new TextRun({ text: `Page: `, bold: true, ...defaultStyles }),
                      new TextRun({ text: `${flag.pageNumber}. `, ...defaultStyles }),
                      new TextRun({ text: `Reason: `, bold: true, break: 1, ...defaultStyles }),
                      new TextRun({ text: flag.reason, italics: true, ...defaultStyles }),
                  ]
              }));
          });
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: "", ...defaultStyles })] }));
      }
  
      const coverRuns = formatGroupToRuns(coverData);
      if (coverRuns.length > 0) {
          paragraphs.push(new Paragraph({
              children: [ new TextRun({ text: "Cover: ", bold: true, ...defaultStyles }), ...coverRuns ]
          }));
      }
  
      const nonCoverRuns = formatGroupToRuns(nonCoverData);
      if (nonCoverRuns.length > 0) {
          if (coverRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: [new TextRun({ text: "", ...defaultStyles })] }));
          }
          paragraphs.push(new Paragraph({ children: nonCoverRuns }));
      }
  
      const doc = new Document({
          sections: [{ children: paragraphs }],
      });
  
      return await Packer.toBlob(doc);
  };

  const generateExcelWorkbook = (data: (string | number)[][], titleStr: string, applyStyle: boolean = true) => {
    // @ts-ignore
    const XLSX = window.XLSX;
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    if (applyStyle) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const borderStyle = { style: 'thin', color: { auto: 1 } };
        const border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        const headerFill = { fgColor: { rgb: "C6E0B4" } }; // Light Green

        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                if (!worksheet[cellAddress]) continue;

                if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
                
                worksheet[cellAddress].s.alignment = { wrapText: true, vertical: 'top' };
                worksheet[cellAddress].s.border = border;

                if (headerRowIndex !== -1 && R === headerRowIndex) {
                    worksheet[cellAddress].s.fill = headerFill;
                    worksheet[cellAddress].s.font = { bold: true };
                    worksheet[cellAddress].s.alignment = { wrapText: true, vertical: 'center', horizontal: 'center' };
                }
            }
        }

        if (headerRowIndex !== -1) {
            if (!worksheet['!rows']) worksheet['!rows'] = [];
            for (let i = 0; i <= headerRowIndex; i++) {
                 if (!worksheet['!rows'][i]) worksheet['!rows'][i] = {};
            }
            worksheet['!rows'][headerRowIndex] = { hpx: 40 };
        }

        const colWidths = [];
        const maxCol = range.e.c;
        for (let i = 0; i <= maxCol; i++) {
            if (i >= 9 && i <= 15) { // J=9 to P=15 are narrow
                 colWidths.push({ wch: 4 }); 
            } else if (columnIndices) {
                 if (i === columnIndices.sourceColIndex) colWidths.push({ wch: 40 });
                 else if (i === columnIndices.ackColIndex) colWidths.push({ wch: 60 });
                 else if (i === columnIndices.descColIndex) colWidths.push({ wch: 60 });
                 else if (i === columnIndices.pageColIndex) colWidths.push({ wch: 15 });
                 else if (i === columnIndices.notesColIndex) colWidths.push({ wch: 40 });
                 else if (i === columnIndices.imgNoColIndex) colWidths.push({ wch: 25 });
                 else if (i === columnIndices.feeColIndex) colWidths.push({ wch: 15 });
                 else if (i === columnIndices.usageColIndex) colWidths.push({ wch: 25 });
                 else if (i === columnIndices.rightsColIndex) colWidths.push({ wch: 15 });
                 else colWidths.push({ wch: 20 });
            } else {
                 colWidths.push({ wch: 20 });
            }
        }
        worksheet['!cols'] = colWidths;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, titleStr);
    return workbook;
  };

  const handleDownloadWord = async () => {
      if (isDownloading) return;
      setIsDownloading(true);
      try {
          const blob = await generateWordBlob();
          let docName = "Final_Credits.docx";
          if (isbn && title) {
              const sanitizedTitle = sanitizeFilename(title);
              docName = `Final_Credits_${isbn}_${sanitizedTitle}.docx`;
          }
          saveAs(blob, docName);
      } catch (err) {
          console.error('Failed to generate Word document:', err);
          alert('Failed to generate Word document.');
      } finally {
          setIsDownloading(false);
      }
  };

  const handleMergeAndDownload = async () => {
      if (isMerging) return;
      setIsMerging(true);
      try {
          // @ts-ignore
          const XLSX = window.XLSX;
          const originalCredits = [...coverData, ...nonCoverData];
          const imageCredits = imageAnalysisResults;
          const headers = ["Acknowledgement", "Page Number", "Image Filename", "AI Description"];
          const mergedRows = [];
          const maxRows = Math.max(originalCredits.length, imageCredits.length);
          for (let i = 0; i < maxRows; i++) {
              const original = originalCredits[i];
              const image = imageCredits[i];
              mergedRows.push([
                  original ? original.acknowledgement : '',
                  original ? original.pageNumber : '',
                  image ? image.pageNumber : '',
                  image ? image.description : '',
              ]);
          }
          const worksheet = XLSX.utils.aoa_to_sheet([headers, ...mergedRows]);
          worksheet['!cols'] = [ { wch: 50 }, { wch: 15 }, { wch: 40 }, { wch: 80 } ];
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Merged Credits");
          let docName = "Merged_Credits_Data.xlsx";
          if (isbn && title) {
              const sanitizedTitle = sanitizeFilename(title);
              docName = `Merged_Credits_${isbn}_${sanitizedTitle}.xlsx`;
          }
          XLSX.writeFile(workbook, docName);
      } catch (err) {
          console.error("Failed to merge and download Excel file:", err);
          alert("An unknown error occurred while generating the merged Excel file.");
      } finally {
          setIsMerging(false);
      }
  };

  const handleDownloadSortedOriginal = async () => {
      if (isDownloadingSorted) return;
      setIsDownloadingSorted(true);
      try {
          // @ts-ignore
          const XLSX = window.XLSX;
          const metadataRows = rawData.slice(0, headerRowIndex);
          const headers = rawData[headerRowIndex];
          const dataRows = rawData.slice(headerRowIndex + 1);
          const filteredDataRows = dataRows.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));
          const sortedDataRows = [...filteredDataRows].sort((a, b) => {
              const sourceA = String(a[columnIndices!.sourceColIndex] || '');
              const sourceB = String(b[columnIndices!.sourceColIndex] || '');
              const ackA = String(a[columnIndices!.ackColIndex] || '');
              const ackB = String(b[columnIndices!.ackColIndex] || '');
              const sourceCompare = sourceA.localeCompare(sourceB);
              if (sourceCompare !== 0) return sourceCompare;
              return ackA.localeCompare(ackB);
          });
          const finalData = [...metadataRows, headers, ...sortedDataRows];
          const workbook = generateExcelWorkbook(finalData, "Sorted Original Log");
          let docName = "Sorted_Original_Log.xlsx";
          if (isbn && title) {
              const sanitizedTitle = sanitizeFilename(title);
              docName = `Sorted_Original_Log_${isbn}_${sanitizedTitle}.xlsx`;
          }
          XLSX.writeFile(workbook, docName);
      } catch (err) {
          console.error("Failed to generate sorted original Excel file:", err);
          alert("An unknown error occurred while generating the sorted original Excel file.");
      } finally {
          setIsDownloadingSorted(false);
      }
  };
  
  const handleDownloadOriginal = async () => {
      if (isDownloadingOriginal) return;
      setIsDownloadingOriginal(true);
      try {
          // @ts-ignore
          const XLSX = window.XLSX;
          const workbook = generateExcelWorkbook(rawData, "Original Log");
          let docName = "Original_Log.xlsx";
          if (isbn && title) {
              const sanitizedTitle = sanitizeFilename(title);
              docName = `Original_Log_${isbn}_${sanitizedTitle}.xlsx`;
          }
          XLSX.writeFile(workbook, docName);
      } catch (err) {
          console.error("Failed to download original log:", err);
          alert("An unknown error occurred while downloading the original log.");
      } finally {
          setIsDownloadingOriginal(false);
      }
  };

  const handleDownloadAll = async () => {
      if (isDownloadingAll) return;
      setIsDownloadingAll(true);
      try {
          // @ts-ignore
          const JSZip = window.JSZip;
          if (!JSZip) {
              throw new Error("JSZip library not found.");
          }
          const zip = new JSZip();

          // 1. Generate Word Blob
          const wordBlob = await generateWordBlob();

          // 2. Generate Sorted Excel Blob
          const metadataRows = rawData.slice(0, headerRowIndex);
          const headers = rawData[headerRowIndex];
          const dataRows = rawData.slice(headerRowIndex + 1);
          const filteredDataRows = dataRows.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));
          const sortedDataRows = [...filteredDataRows].sort((a, b) => {
              const sourceA = String(a[columnIndices!.sourceColIndex] || '');
              const sourceB = String(b[columnIndices!.sourceColIndex] || '');
              const ackA = String(a[columnIndices!.ackColIndex] || '');
              const ackB = String(b[columnIndices!.ackColIndex] || '');
              const sourceCompare = sourceA.localeCompare(sourceB);
              if (sourceCompare !== 0) return sourceCompare;
              return ackA.localeCompare(ackB);
          });
          const sortedExcelWB = generateExcelWorkbook([...metadataRows, headers, ...sortedDataRows], "Sorted Original Log");
          
          // 3. Generate Original Excel Blob
          const originalExcelWB = generateExcelWorkbook(rawData, "Original Log");

          // Convert workbooks to binary buffers for JSZip
          // @ts-ignore
          const XLSX = window.XLSX;
          const sortedExcelBuf = XLSX.write(sortedExcelWB, { bookType: 'xlsx', type: 'array' });
          const originalExcelBuf = XLSX.write(originalExcelWB, { bookType: 'xlsx', type: 'array' });

          // Determine filenames
          const baseName = (isbn && title) ? `${isbn}_${sanitizeFilename(title)}` : "Credits_Data";
          
          zip.file(`Final_Credits_${baseName}.docx`, wordBlob);
          zip.file(`Sorted_Original_Log_${baseName}.xlsx`, sortedExcelBuf);
          zip.file(`Original_Log_${baseName}.xlsx`, originalExcelBuf);

          const zipBlob = await zip.generateAsync({ type: "blob" });
          saveAs(zipBlob, `Bundle_${baseName}.zip`);

      } catch (e) {
          console.error("Error during 'Download All' operation:", e);
          alert("An error occurred while trying to bundle your files into a ZIP archive.");
      } finally {
          setIsDownloadingAll(false);
      }
  };

  const handleEditOriginal = () => {
    if (rawData.length > 0) {
      setIsEditModalOpen(true);
    }
  };

  const totalSources = new Set([...coverData.map(d => d.source), ...nonCoverData.map(d => d.source)]).size;

  const renderContent = () => {
    switch (status) {
      case 'idle':
        return (
          <div className="bg-white rounded-xl shadow-lg p-2 sm:p-2">
            <FileUpload onFileSelect={handleProcessFile} />
          </div>
        );
      case 'processing':
        return (
          <div className="bg-white rounded-xl shadow-lg p-2 sm:p-3">
            <div className="text-center p-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-slate-600 font-semibold">Processing your file...</p>
            </div>
          </div>
        );
      case 'success':
        return (
          <>
            <div className="flex gap-2">
              <div className="flex-grow bg-white rounded-xl shadow-lg p-1 sm:p-2 flex gap-1 transition-all duration-300">
                <NavigationRail
                    activeView={activeView}
                    onNavigate={setActiveView}
                    dataValidationIssues={dataValidationFlags.length}
                />
                <div className="flex-grow min-w-0">
                  <div className="flex justify-end items-center mb-2 px-2">
                      {activeView === 'credits' && (
                        <button
                            onClick={handleEditOriginal}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-600 font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-colors text-sm shadow-sm"
                        >
                            <EditIcon className="w-4 h-4" />
                            <span>Edit Original Log</span>
                        </button>
                      )}
                  </div>
                  
                  {activeView === 'credits' && (
                    <ResultsTable 
                      coverData={coverData}
                      nonCoverData={nonCoverData}
                      dataValidationFlags={dataValidationFlags}
                    />
                  )}
                  
                  {activeView === 'analysis' && (
                    <AnalysisView
                        onProcessContactSheet={handleProcessContactSheet}
                        onProcessDirectImages={handleProcessDirectImages}
                        onResetContactSheet={handleContactSheetReset}
                        contactSheetStatus={contactSheetStatus}
                        imageAnalysisResults={imageAnalysisResults}
                        contactSheetError={contactSheetError}
                        processingProgress={processingProgress}
                        onRetryFailedImages={handleRetryFailedImages}
                    />
                  )}

                  {activeView === 'history' && (
                      <div className="p-4 text-center text-slate-500">
                          <h2 className="text-xl font-semibold">Coming Soon</h2>
                          <p>This section is under development.</p>
                      </div>
                  )}

                </div>
              </div>
              <InfoPanel 
                isOpen={isInfoPanelOpen}
                onToggle={() => setIsInfoPanelOpen(!isInfoPanelOpen)}
                fileName={fileName}
                originalRecordCount={originalRecordCount}
                totalSources={totalSources}
                coverCreditsCount={coverData.length}
                mainCreditsCount={nonCoverData.length}
                removedDuplicates={removedDuplicates}
                crossCategoryDuplicates={crossCategoryDuplicates}
              />
            </div>
            
            <DataHealthModal
                isOpen={activeView === 'dataHealth'}
                onClose={() => setActiveView('credits')}
                dataValidationFlags={dataValidationFlags}
                aiAnalysisStatus={aiAnalysisStatus}
                aiFlags={aiFlags}
                onRunAiAnalysis={handleRunAiAnalysis}
                originalRecordCount={originalRecordCount}
            />

            <ExportModal
                isOpen={activeView === 'export'}
                onClose={() => setActiveView('credits')}
                onDownloadWord={handleDownloadWord}
                onDownloadSortedLog={handleDownloadSortedOriginal}
                onDownloadOriginalLog={handleDownloadOriginal}
                onDownloadAll={handleDownloadAll}
                isDownloading={isDownloading}
                isDownloadingSorted={isDownloadingSorted}
                isDownloadingOriginal={isDownloadingOriginal}
                isDownloadingAll={isDownloadingAll}
            />
            
            {isEditModalOpen && (
              <EditableLogModal
                  isOpen={isEditModalOpen}
                  onClose={() => setIsEditModalOpen(false)}
              />
            )}
          </>
        );
      case 'error':
        return (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <ErrorIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-red-700">Processing Failed</h3>
              <p className="text-slate-600 mt-2 mb-4">{error}</p>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        );
    }
  };

  const menuItems = [
    { label: 'Process Another file', onClick: handleReset },
    { label: 'Help', onClick: () => {} }
  ];

  return (
    <main className="container mx-auto p-2 sm:p-4">
      <div className="mb-3 border-b border-slate-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('logReview')}
            className={`${
              activeTab === 'logReview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            } whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium`}
          >
            Log Review
          </button>
          <button
            onClick={() => setActiveTab('newFeature')}
            className={`${
              activeTab === 'newFeature'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            } whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium`}
          >
            Filename Parser
          </button>
          <button
            onClick={() => setActiveTab('creditsCreator')}
            className={`${
              activeTab === 'creditsCreator'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            } whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium`}
          >
            Credits Creator
          </button>
          <button
            onClick={() => setActiveTab('contactSheets')}
            className={`${
              activeTab === 'contactSheets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            } whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium`}
          >
            Contact Sheets
          </button>
        </nav>
      </div>

      {activeTab === 'logReview' && (
        <>
          <header className="mb-2 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <DropdownMenu items={menuItems} />
              <div className="text-left">
                <h1 className="text-3xl font-bold text-slate-800">A.M.H</h1>
                <p className="text-slate-500"></p>
              </div>
            </div>
            {status === 'success' && (
              <div className="flex items-center gap-6">
                <div className="text-right min-w-0">
                  {isbn && title && (
                    <p
                      className="text-lg font-semibold text-slate-800 truncate max-w-lg"
                      title={`${isbn}_${title}`}
                    >
                      {`${isbn}_${title}`}
                    </p>
                  )}
                </div>
                <ActionsHeader 
                  isMerging={isMerging}
                  copyStatus={copyStatus}
                  contactSheetStatus={contactSheetStatus}
                  imageAnalysisResults={imageAnalysisResults}
                  onMergeAndDownload={handleMergeAndDownload}
                  onCopy={handleCopy}
                />
              </div>
            )}
          </header>
          {renderContent()}
        </>
      )}

      {activeTab === 'newFeature' && <FilenameParser />}

      {activeTab === 'creditsCreator' && <CreditsCreator />}

      {activeTab === 'contactSheets' && <ContactSheetsTab />}
    </main>
  );
};

export default App;
