import React, { useState, useRef, useMemo } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  Copy,
  Download,
  Edit2,
  Trash2,
  Filter,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  X,
  ExternalLink,
  ChevronDown,
  Info,
  Check,
  Image as ImageIcon,
  FileArchive,
  Eye,
  Maximize2,
  Sliders,
  Settings2,
  Code,
  Scissors,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import {
  extractContactSheetPdf,
  generateSample82PageData,
  formatAssetsToTsv,
  formatReviewAssetsToTsv,
  hasValidImageExtension,
  detectVendor,
  extractSourceAndImageId,
  formatExtractedImageFileName,
  formatCustomImageFileName,
  NAMING_PRESETS,
  DEFAULT_NAMING_OPTIONS,
  NamingOptions,
  NamingPreset,
  renderAndClipSelectedImage,
  generateSynthesizedSampleImage,
  exportAllExtractedImagesToZip,
  downloadSingleImage,
  AssetRecord,
  RawPageData,
  ExtractionProgress,
  ExtractedImageInfo
} from '../services/csExtractorService';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import saveAs from 'file-saver';
import { DownloadNamingModal } from './DownloadNamingModal';

declare const XLSX: any;

export const CsExtractor: React.FC = () => {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [rawPages, setRawPages] = useState<RawPageData[]>([]);
  const [summary, setSummary] = useState<{
    totalPages: number;
    totalAssets: number;
    totalSelected: number;
    totalMissing: number;
    totalMultiPage: number;
    totalWithAdditionalComments?: number;
    totalWithClippedExtension?: number;
    totalNeedsReview?: number;
  } | null>(null);

  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'selected' | 'missing' | 'multipage' | 'two_comments' | 'clipped_extension' | 'needs_review'>('all');
  const [assetPrefix, setAssetPrefix] = useState<string>('VIBE');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Modal / Drawer for inspecting and picking alternative candidate options
  const [inspectingAsset, setInspectingAsset] = useState<AssetRecord | null>(null);

  // Lightbox modal for previewing an individual extracted/clipped image
  const [activePreviewImage, setActivePreviewImage] = useState<{
    image: ExtractedImageInfo;
    asset: AssetRecord;
  } | null>(null);

  // ZIP packaging state
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);

  // Clipping preference: tight image box vs including caption
  const [cropMode, setCropMode] = useState<'tight' | 'with_caption' | 'expanded'>('tight');

  // Image file naming customization options
  const [namingOptions, setNamingOptions] = useState<NamingOptions>(DEFAULT_NAMING_OPTIONS);
  const [isNamingModalOpen, setIsNamingModalOpen] = useState<boolean>(false);

  // Background compilation state (non-blocking after metadata extraction)
  const [backgroundCompilation, setBackgroundCompilation] = useState<{
    isCompiling: boolean;
    completed: number;
    total: number;
    currentAssetCode?: string;
  }>({
    isCompiling: false,
    completed: 0,
    total: 0
  });
  const abortCompilationRef = useRef<boolean>(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAssetCode, setEditAssetCode] = useState<string>('');
  const [editSelectedImage, setEditSelectedImage] = useState<string>('');
  const [editPageDisplay, setEditPageDisplay] = useState<string>('');
  const [editComment, setEditComment] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Background compiler: compiles and clips images without freezing the user interface
  const startBackgroundCompilation = async (
    targetAssets: AssetRecord[],
    currentRawPages: RawPageData[],
    pdfDoc: any
  ) => {
    abortCompilationRef.current = false;
    const selectedAssets = targetAssets.filter(a => a.selectedImage);
    if (selectedAssets.length === 0) return;

    setBackgroundCompilation({
      isCompiling: true,
      completed: 0,
      total: selectedAssets.length,
      currentAssetCode: selectedAssets[0]?.assetCode
    });

    for (let i = 0; i < selectedAssets.length; i++) {
      if (abortCompilationRef.current) {
        break;
      }
      const asset = selectedAssets[i];

      setBackgroundCompilation(prev => ({
        ...prev,
        isCompiling: true,
        completed: i,
        total: selectedAssets.length,
        currentAssetCode: asset.assetCode
      }));

      if (!asset.extractedImage?.dataUrl) {
        try {
          if (pdfDoc) {
            const img = await renderAndClipSelectedImage(pdfDoc, asset, currentRawPages, { cropMode });
            asset.extractedImage = img;
          } else {
            const pageNum = asset.selectedPageNum || asset.pages[0] || 1;
            asset.extractedImage = generateSynthesizedSampleImage(pageNum, asset.assetCode, asset.selectedImage, asset.vendor);
          }
        } catch (clipErr) {
          console.warn('Could not clip image for', asset.assetCode, clipErr);
          const pageNum = asset.selectedPageNum || asset.pages[0] || 1;
          asset.extractedImage = generateSynthesizedSampleImage(pageNum, asset.assetCode, asset.selectedImage, asset.vendor);
        }

        // Trigger reactive state refresh so thumbnails update in the table
        setAssets([...targetAssets]);
      }

      // Small yield so main thread stays completely responsive for browsing/typing/filtering
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    if (!abortCompilationRef.current) {
      setBackgroundCompilation({
        isCompiling: false,
        completed: selectedAssets.length,
        total: selectedAssets.length
      });
    }
  };

  // Trigger file processing
  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file containing the contact sheet pages.');
      return;
    }

    // Cancel any ongoing background compilation
    abortCompilationRef.current = true;
    setFileName(file.name);
    setIsProcessing(true);
    setProgress({
      currentPage: 0,
      totalPages: 0,
      phase: 'loading',
      statusMessage: 'Preparing PDF parser...'
    });

    try {
      // Pass the File directly to extractContactSheetPdf which parses cleanly in a single pass
      // and returns the loaded pdfDocument, preventing "Cannot perform Construct on a detached ArrayBuffer" errors.
      const result = await extractContactSheetPdf(file, {
        assetPrefix: assetPrefix.trim() || 'VIBE',
        onProgress: (p) => setProgress(p)
      });

      const pdf = result.pdfDocument;
      pdfDocRef.current = pdf;

      // FIRST: Show metadata immediately so user has 0 waiting time!
      setAssets(result.assets);
      setRawPages(result.rawPages);
      setSummary(result.summary);
      setIsProcessing(false);
      setProgress(null);

      // SECOND: Continue compiling images asynchronously in the background
      startBackgroundCompilation(result.assets, result.rawPages, pdf);
    } catch (err: any) {
      console.error('Extraction error:', err);
      alert(`Failed to extract contact sheet: ${err?.message || err}`);
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // Load realistic 82-page sample
  const handleLoadSample = () => {
    abortCompilationRef.current = true;
    setIsProcessing(true);
    setFileName('Sample_ContactSheet_82Pages_VIBE3.pdf');
    pdfDocRef.current = null;
    setTimeout(() => {
      const sample = generateSample82PageData();
      setAssets(sample.assets);
      setRawPages(sample.rawPages);
      setSummary(sample.summary);
      setIsProcessing(false);
      // Background compile sample images
      startBackgroundCompilation(sample.assets, sample.rawPages, null);
    }, 150);
  };

  // Download all extracted images as a ZIP archive
  const handleDownloadAllImagesZip = async (customOpts?: NamingOptions) => {
    const opts = customOpts || namingOptions;
    const validAssets = assets.filter(a => a.selectedImage);
    if (validAssets.length === 0) {
      alert('No selected images available to download.');
      return;
    }

    setIsZipping(true);
    setZipProgress({ current: 0, total: validAssets.length });

    try {
      // Ensure all selected assets have extractedImage populated (if background hasn't finished yet)
      for (let i = 0; i < validAssets.length; i++) {
        const a = validAssets[i];
        if (!a.extractedImage?.dataUrl) {
          setZipProgress({ current: i + 1, total: validAssets.length });
          const pageNum = a.selectedPageNum || a.pages[0] || 1;
          if (pdfDocRef.current) {
            try {
              a.extractedImage = await renderAndClipSelectedImage(pdfDocRef.current, a, rawPages, { cropMode });
            } catch (err) {
              a.extractedImage = generateSynthesizedSampleImage(pageNum, a.assetCode, a.selectedImage, a.vendor);
            }
          } else {
            a.extractedImage = generateSynthesizedSampleImage(pageNum, a.assetCode, a.selectedImage, a.vendor);
          }
        }
      }

      await exportAllExtractedImagesToZip(
        assets,
        fileName || 'ContactSheet',
        {
          namingOptions: opts,
          onProgress: (current, total) => setZipProgress({ current, total })
        }
      );
      setCopyFeedback(`Exported ${validAssets.length} images to ZIP successfully`);
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch (err: any) {
      console.error('ZIP export error:', err);
      alert(`Failed to create ZIP: ${err?.message || err}`);
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  // Download a single individual image with current custom naming
  const handleDownloadSingle = async (asset: AssetRecord, index: number = 0) => {
    let img = asset.extractedImage;
    if (!img?.dataUrl) {
      const pageNum = asset.selectedPageNum || asset.pages[0] || 1;
      if (pdfDocRef.current) {
        img = await renderAndClipSelectedImage(pdfDocRef.current, asset, rawPages, { cropMode });
        asset.extractedImage = img;
      } else {
        img = generateSynthesizedSampleImage(pageNum, asset.assetCode, asset.selectedImage, asset.vendor);
        asset.extractedImage = img;
      }
    }
    if (img) {
      const customFileName = formatCustomImageFileName(asset, index, namingOptions);
      downloadSingleImage(img, customFileName);
      setCopyFeedback(`Downloaded ${customFileName}`);
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Fix Clear Button: instant, reliable execution without blocking window.confirm in iframes
  const handleClear = () => {
    abortCompilationRef.current = true;
    pdfDocRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setAssets([]);
    setRawPages([]);
    setSummary(null);
    setFileName('');
    setSearchQuery('');
    setStatusFilter('all');
    setBackgroundCompilation({ isCompiling: false, completed: 0, total: 0 });
    setActivePreviewImage(null);
    setInspectingAsset(null);
    setIsZipping(false);
    setZipProgress(null);
    setCopyFeedback('Cleared all contact sheet assets');
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 3000);
    });
  };

  // Export to Excel (.xlsx) using existing global XLSX
  const exportToExcel = () => {
    if (assets.length === 0) return;

    try {
      if (typeof XLSX === 'undefined') {
        throw new Error('Excel generation library is loading, please try again in a moment.');
      }

      // Sheet 1: All Extracted Assets
      const rows = assets.map((a, idx) => {
        const meta = extractSourceAndImageId(a.selectedImage || a.selectionCommentText || '');
        const source = a.source || meta.source || '—';
        const imageId = a.imageId || meta.imageId || '—';
        return {
          '#': idx + 1,
          'Page': a.pageDisplay,
          'Asset Code': a.assetCode,
          'Selection': a.selectedImage || '(None)',
          'Source': source,
          'Image ID': imageId,
          'Additional Comments': a.additionalCommentsText || (a.hasTwoCommentsOnPage || a.hasAdditionalComments ? 'Yes - Review Required' : 'None'),
          'Clipped / Missing Ext?': a.hasClippedExtension ? 'YES - Missing Extension' : 'OK',
          'Saved Filename': formatCustomImageFileName(a, idx, namingOptions),
          'Status': a.status,
          'Options Count': a.candidateOptions.length
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 5 },  // #
        { wch: 10 }, // Page
        { wch: 25 }, // Asset Code
        { wch: 36 }, // Selection
        { wch: 22 }, // Source
        { wch: 16 }, // Image ID
        { wch: 42 }, // Additional Comments
        { wch: 24 }, // Clipped / Missing Ext?
        { wch: 42 }, // Saved Filename
        { wch: 16 }, // Status
        { wch: 14 }  // Options Count
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'All Extracted Assets');

      // Sheet 2: Flagged for Manual Review (Additional Comments, Clipped Filename, Missing)
      const reviewAssets = assets.filter(a =>
        a.hasTwoCommentsOnPage || a.hasAdditionalComments || a.hasClippedExtension || a.status === 'Missing Selection' || a.status === 'Multiple Selections'
      );

      if (reviewAssets.length > 0) {
        const reviewRows = reviewAssets.map((a, idx) => {
          const meta = extractSourceAndImageId(a.selectedImage || a.selectionCommentText || '');
          const source = a.source || meta.source || '—';
          const imageId = a.imageId || meta.imageId || '—';
          return {
            '#': idx + 1,
            'Page': a.pageDisplay,
            'Asset Code': a.assetCode,
            'Flag Reason': [
              a.hasTwoCommentsOnPage ? '2 Comments on Page' : null,
              a.additionalCommentReason ? a.additionalCommentReason : (a.hasAdditionalComments ? 'Additional Comments on Page' : null),
              a.hasClippedExtension ? 'Clipped Filename (Missing Extension)' : null,
              a.status === 'Missing Selection' ? 'Missing Selection' : null,
              a.status === 'Multiple Selections' ? 'Multiple Selections' : null
            ].filter(Boolean).join('; '),
            'Selection': a.selectedImage || '(None)',
            'Source': source,
            'Image ID': imageId,
            'Additional Comments': a.additionalCommentsText || a.comments.slice(1).map(c => c.content).join(' | ') || '—',
            'Clipped / Missing Ext?': a.hasClippedExtension ? 'YES - Missing Extension' : 'OK',
            'Candidate Suggestion': a.clippedSuggestedOption || '—',
            'Status': a.status
          };
        });

        const wsReview = XLSX.utils.json_to_sheet(reviewRows);
        wsReview['!cols'] = [
          { wch: 5 },  // #
          { wch: 10 }, // Page
          { wch: 25 }, // Asset Code
          { wch: 34 }, // Flag Reason
          { wch: 36 }, // Selection
          { wch: 22 }, // Source
          { wch: 16 }, // Image ID
          { wch: 45 }, // Additional Comments
          { wch: 24 }, // Clipped / Missing Ext?
          { wch: 36 }, // Candidate Suggestion
          { wch: 16 }  // Status
        ];
        XLSX.utils.book_append_sheet(workbook, wsReview, 'Manual Review Required');
      }

      const safeName = (fileName || 'ContactSheet').replace(/\.pdf$/i, '');
      XLSX.writeFile(workbook, `${safeName}_Extracted_Selections.xlsx`);
    } catch (err: any) {
      console.error('Excel export error:', err);
      alert(`Could not export to Excel: ${err?.message || err}`);
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    if (assets.length === 0) return;
    const header = ['Page', 'Asset Code', 'Selection', 'Source', 'Image ID', 'Additional Comments', 'Clipped / Missing Ext?', 'Saved Filename', 'Status'];
    const rows = assets.map((a, idx) => {
      const meta = extractSourceAndImageId(a.selectedImage || a.selectionCommentText || '');
      const source = a.source || meta.source || '—';
      const imageId = a.imageId || meta.imageId || '—';
      return [
        `"${a.pageDisplay.replace(/"/g, '""')}"`,
        `"${a.assetCode.replace(/"/g, '""')}"`,
        `"${(a.selectedImage || '').replace(/"/g, '""')}"`,
        `"${source.replace(/"/g, '""')}"`,
        `"${imageId.replace(/"/g, '""')}"`,
        `"${(a.additionalCommentsText || (a.hasTwoCommentsOnPage || a.hasAdditionalComments ? 'Yes' : 'None')).replace(/"/g, '""')}"`,
        `"${a.hasClippedExtension ? 'YES - Missing Extension' : 'OK'}"`,
        `"${formatCustomImageFileName(a, idx, namingOptions).replace(/"/g, '""')}"`,
        `"${a.status.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const safeName = (fileName || 'ContactSheet').replace(/\.pdf$/i, '');
    saveAs(blob, `${safeName}_Extracted_Selections.csv`);
  };

  // Export to Word (.docx)
  const exportToWord = async () => {
    if (assets.length === 0) return;

    try {
      const tableRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Page', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Asset Code', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Selection', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Source', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Image ID', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Additional Comments', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Clipped?', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true, color: 'FFFFFF' })] })], shading: { fill: '1E293B' } }),
          ]
        }),
        ...assets.map(a => {
          const meta = extractSourceAndImageId(a.selectedImage || a.selectionCommentText || '');
          const source = a.source || meta.source || '—';
          const imageId = a.imageId || meta.imageId || '—';
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.pageDisplay })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.assetCode, bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.selectedImage || '—' })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: source })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: imageId })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.additionalCommentsText || (a.hasTwoCommentsOnPage || a.hasAdditionalComments ? 'Yes' : '—') })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.hasClippedExtension ? 'YES' : 'OK', color: a.hasClippedExtension ? 'DC2626' : '059669', bold: a.hasClippedExtension })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a.status })] })] }),
            ]
          });
        })
      ];

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              text: 'Contact Sheet Asset Selections Summary',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Source File: ${fileName || 'Contact Sheet'} | Total Assets: ${assets.length} | Extracted: ${new Date().toLocaleDateString()}`, italics: true, color: '64748B' })
              ]
            }),
            new Paragraph({ text: '' }),
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const safeName = (fileName || 'ContactSheet').replace(/\.pdf$/i, '');
      saveAs(blob, `${safeName}_Extracted_Selections.docx`);
    } catch (err: any) {
      console.error('Word export error:', err);
      alert(`Could not export to Word: ${err?.message || err}`);
    }
  };

  // Quick fix: append extension (e.g. .jpg) to clipped filename
  const handleAppendExtension = (assetId: string, ext = '.jpg') => {
    setAssets(prev => prev.map(a => {
      if (a.id === assetId && a.selectedImage) {
        const fixedImage = `${a.selectedImage}${ext}`;
        const meta = extractSourceAndImageId(fixedImage);
        const source = meta.source !== '—' ? meta.source : undefined;
        const imageId = meta.imageId !== '—' ? meta.imageId : undefined;
        const pageNum = a.selectedPageNum || a.pages[0] || 1;
        const updatedImg = generateSynthesizedSampleImage(pageNum, a.assetCode, fixedImage, source);
        return {
          ...a,
          selectedImage: fixedImage,
          hasClippedExtension: false,
          source,
          imageId,
          vendor: source,
          extractedImage: updatedImg,
          userEdited: true
        };
      }
      return a;
    }));
    setCopyFeedback(`Appended ${ext} to selection!`);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Copy review-only items for Excel
  const handleCopyReviewItems = async () => {
    const reviewTsv = formatReviewAssetsToTsv(assets);
    try {
      await navigator.clipboard.writeText(reviewTsv);
      setCopyFeedback(`Copied ${reviewStats.totalNeedsReview} review rows for Excel!`);
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Inline editing handler
  const startEditing = (a: AssetRecord) => {
    setEditingId(a.id);
    setEditAssetCode(a.assetCode);
    setEditSelectedImage(a.selectedImage);
    setEditPageDisplay(a.pageDisplay);
    setEditComment(a.comments.map(c => c.content).join(' | '));
  };

  const saveEditing = (id: string) => {
    setAssets(prev => prev.map(a => {
      if (a.id === id) {
        const cleanedImage = editSelectedImage.trim();
        const code = editAssetCode.trim() || a.assetCode;
        const pageDisplay = editPageDisplay.trim() || a.pageDisplay;
        const commentText = editComment.trim();
        const firstPageMatch = parseInt(pageDisplay, 10);
        const pageNum = !isNaN(firstPageMatch) ? firstPageMatch : (a.selectedPageNum || a.pages[0] || 1);
        const meta = extractSourceAndImageId(cleanedImage);
        const source = meta.source !== '—' ? meta.source : undefined;
        const imageId = meta.imageId !== '—' ? meta.imageId : undefined;
        const updatedImg = cleanedImage ? generateSynthesizedSampleImage(pageNum, code, cleanedImage, source) : undefined;

        const updatedComments = commentText
          ? [{ id: `comment-${id}`, pageNum, content: commentText }]
          : a.comments;

        const hasClipped = Boolean(cleanedImage && !hasValidImageExtension(cleanedImage));

        return {
          ...a,
          assetCode: code,
          selectedImage: cleanedImage,
          pageDisplay,
          status: cleanedImage ? 'Selected' : 'Missing Selection',
          source,
          imageId,
          vendor: source,
          comments: updatedComments,
          extractedImage: updatedImg,
          hasClippedExtension: hasClipped,
          userEdited: true
        };
      }
      return a;
    }));
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  // Select alternative candidate option
  const handlePickCandidate = (assetId: string, candidateText: string) => {
    setAssets(prev => prev.map(a => {
      if (a.id === assetId) {
        const pageNum = a.selectedPageNum || a.pages[0] || 1;
        const meta = extractSourceAndImageId(candidateText);
        const source = meta.source !== '—' ? meta.source : undefined;
        const imageId = meta.imageId !== '—' ? meta.imageId : undefined;
        const updatedImg = candidateText ? generateSynthesizedSampleImage(pageNum, a.assetCode, candidateText, source) : undefined;
        const hasClipped = Boolean(candidateText && !hasValidImageExtension(candidateText));

        return {
          ...a,
          selectedImage: candidateText,
          status: candidateText ? 'Selected' : 'Missing Selection',
          source,
          imageId,
          vendor: source,
          extractedImage: updatedImg,
          hasClippedExtension: hasClipped,
          userEdited: true
        };
      }
      return a;
    }));
    if (inspectingAsset && inspectingAsset.id === assetId) {
      setInspectingAsset(prev => {
        if (!prev) return null;
        const meta = extractSourceAndImageId(candidateText);
        return {
          ...prev,
          selectedImage: candidateText,
          status: candidateText ? 'Selected' : 'Missing Selection',
          source: meta.source !== '—' ? meta.source : undefined,
          imageId: meta.imageId !== '—' ? meta.imageId : undefined,
          vendor: meta.source !== '—' ? meta.source : undefined,
          hasClippedExtension: Boolean(candidateText && !hasValidImageExtension(candidateText))
        };
      });
    }
  };

  // Delete row
  const handleDeleteRow = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  // Add a new row manually
  const handleAddNewRow = () => {
    const newRecord: AssetRecord = {
      id: `manual-${Date.now()}`,
      assetCode: `${assetPrefix || 'VIBE'}_NEW_ASSET`,
      pages: [1],
      pageDisplay: '1',
      selectedPageNum: 1,
      selectedImage: '',
      status: 'Missing Selection',
      comments: [],
      candidateOptions: [],
      hasAdditionalComments: false,
      additionalComments: [],
      hasClippedExtension: false,
      userEdited: true
    };
    setAssets(prev => [newRecord, ...prev]);
    startEditing(newRecord);
  };

  // Review statistics computed from current assets
  const reviewStats = useMemo(() => {
    const twoCommentsCount = assets.filter(a => a.hasTwoCommentsOnPage || a.comments.length >= 2).length;
    const clippedCount = assets.filter(a => a.hasClippedExtension).length;
    const missingCount = assets.filter(a => a.status === 'Missing Selection').length;
    const multiPageCount = assets.filter(a => a.pages.length > 1).length;
    const selectedCount = assets.filter(a => a.status !== 'Missing Selection').length;
    const totalNeedsReview = assets.filter(a =>
      a.hasTwoCommentsOnPage || a.hasAdditionalComments || a.hasClippedExtension || a.status === 'Missing Selection' || a.status === 'Multiple Selections'
    ).length;

    return {
      twoCommentsCount,
      clippedCount,
      missingCount,
      multiPageCount,
      selectedCount,
      totalNeedsReview
    };
  }, [assets]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      // Status & review filter
      if (statusFilter === 'selected' && a.status === 'Missing Selection') return false;
      if (statusFilter === 'missing' && a.status !== 'Missing Selection') return false;
      if (statusFilter === 'multipage' && a.pages.length <= 1) return false;
      if (statusFilter === 'two_comments' && !(a.hasTwoCommentsOnPage || a.comments.length >= 2)) return false;
      if (statusFilter === 'clipped_extension' && !a.hasClippedExtension) return false;
      if (statusFilter === 'needs_review' && !(a.hasTwoCommentsOnPage || a.hasAdditionalComments || a.hasClippedExtension || a.status === 'Missing Selection' || a.status === 'Multiple Selections')) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = a.assetCode.toLowerCase().includes(q);
        const imageMatch = a.selectedImage.toLowerCase().includes(q);
        const pageMatch = a.pageDisplay.toLowerCase().includes(q);
        const vendorMatch = a.vendor?.toLowerCase().includes(q);
        const commentsMatch = a.comments.some(c => c.content.toLowerCase().includes(q));
        if (!codeMatch && !imageMatch && !pageMatch && !vendorMatch && !commentsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [assets, statusFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Banner & File Upload Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">CS Extractor</h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                Contact Sheet Selections
              </span>

              {/* Active PDF info directly inline in header */}
              {assets.length > 0 && (
                <div className="inline-flex items-center gap-2 bg-blue-50/80 border border-blue-200 px-2.5 py-1 rounded-lg text-xs ml-1">
                  <span className="font-semibold text-slate-500 text-[11px]">Active PDF:</span>
                  <span className="font-mono font-bold text-blue-700 max-w-[180px] sm:max-w-[280px] truncate" title={fileName || 'Contact Sheet.pdf'}>
                    {fileName || 'Contact Sheet.pdf'}
                  </span>
                  {summary && (
                    <span className="text-[11px] font-mono text-slate-500 hidden md:inline border-l border-blue-200 pl-2">
                      {summary.totalPages}p • {summary.totalAssets} assets
                    </span>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="ml-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer shrink-0"
                    title="Upload a different contact sheet PDF"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Asset Code Prefix Config */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-slate-500 font-medium">Prefix:</span>
              <input
                type="text"
                value={assetPrefix}
                onChange={(e) => setAssetPrefix(e.target.value)}
                className="w-16 px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-slate-800 uppercase focus:outline-blue-500 text-xs text-center"
                title="Default prefix for detecting asset codes in page headers"
              />
            </div>

            <button
              onClick={handleLoadSample}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Load realistic 82-page sample contact sheet dataset"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Load 82-Page Sample</span>
            </button>

            {assets.length > 0 && (
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                title="Clear current extraction"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFile(e.target.files[0]);
            }
          }}
          accept=".pdf"
          className="hidden"
        />

        {/* Upload Zone (Only shown when no active PDF is loaded) */}
        {assets.length === 0 && (
          <div className="p-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                  : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/60'
              }`}
            >
              <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1 shadow-2xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {fileName ? (
                      <span className="text-blue-600 font-mono">{fileName}</span>
                    ) : (
                      'Click to upload or drag & drop contact sheet PDF'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded font-medium">.PDF files</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded font-medium">Multi-page spanning</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded font-medium">Acrobat Sticky Notes</span>
                </div>
              </div>
            </div>

            {/* Progress Indicator */}
            {isProcessing && progress && (
              <div className="mt-4 p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-blue-900">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>{progress.statusMessage}</span>
                  </span>
                  {progress.totalPages > 0 && (
                    <span className="font-mono font-bold">
                      {Math.round((progress.currentPage / progress.totalPages) * 100)}%
                    </span>
                  )}
                </div>
                {progress.totalPages > 0 && (
                  <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 transition-all duration-200 rounded-full"
                      style={{ width: `${(progress.currentPage / progress.totalPages) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Results Table & Toolbar */}
      {assets.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            {/* Search & Filter pills */}
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code, image or page..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-blue-500 text-slate-800 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status & Review Filter Buttons */}
              <div className="hidden sm:flex items-center flex-wrap gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  All ({assets.length})
                </button>
                <button
                  onClick={() => setStatusFilter('selected')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    statusFilter === 'selected' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Selected ({reviewStats.selectedCount})
                </button>
                <button
                  onClick={() => setStatusFilter('missing')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    statusFilter === 'missing' ? 'bg-white text-amber-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Missing ({reviewStats.missingCount})
                </button>
                <button
                  onClick={() => setStatusFilter('multipage')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    statusFilter === 'multipage' ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  Multi-page ({reviewStats.multiPageCount})
                </button>
                {reviewStats.twoCommentsCount > 0 && (
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'two_comments' ? 'all' : 'two_comments')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      statusFilter === 'two_comments'
                        ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                        : 'text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 font-medium'
                    }`}
                    title="Filter pages that contain 2 comments on the same page"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>2 Comments ({reviewStats.twoCommentsCount})</span>
                  </button>
                )}
                {reviewStats.clippedCount > 0 && (
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'clipped_extension' ? 'all' : 'clipped_extension')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      statusFilter === 'clipped_extension'
                        ? 'bg-rose-600 text-white shadow-2xs font-semibold'
                        : 'text-rose-700 hover:bg-rose-100/70'
                    }`}
                    title="Filter selections where filename was clipped without .jpg or image extension"
                  >
                    <Scissors className="w-3 h-3" />
                    <span>Clipped .ext ({reviewStats.clippedCount})</span>
                  </button>
                )}
                {reviewStats.totalNeedsReview > 0 && (
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'needs_review' ? 'all' : 'needs_review')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      statusFilter === 'needs_review'
                        ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                        : 'bg-amber-200/80 text-amber-950 hover:bg-amber-300/80 font-bold border border-amber-300'
                    }`}
                    title="Filter all assets flagged for manual review"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Needs Review ({reviewStats.totalNeedsReview})</span>
                  </button>
                )}
              </div>

              {/* Crop Mode selector */}
              <div className="hidden md:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs text-slate-600">
                <span className="text-[11px] text-slate-500 px-1 font-medium">Crop:</span>
                <button
                  onClick={() => setCropMode('tight')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    cropMode === 'tight' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                  title="Tight crop around the research image"
                >
                  Image Only
                </button>
                <button
                  onClick={() => setCropMode('with_caption')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    cropMode === 'with_caption' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
                  }`}
                  title="Crop including image and caption filename below"
                >
                  With Caption
                </button>
              </div>
            </div>

            {/* Action buttons: Download All Images (.ZIP), Copy & Export */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Primary Batch Images Download Button with Naming Customization */}
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  onClick={() => handleDownloadAllImagesZip(namingOptions)}
                  disabled={isZipping || assets.filter(a => a.selectedImage).length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-l-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Download all selected images in a ZIP archive formatted with current naming rules"
                >
                  <FileArchive className={`w-3.5 h-3.5 ${isZipping ? 'animate-bounce' : ''}`} />
                  <span>
                    {isZipping
                      ? `Zipping (${zipProgress?.current || 0}/${zipProgress?.total || 0})...`
                      : `Download All Images (.ZIP) (${assets.filter(a => a.selectedImage).length})`}
                  </span>
                </button>
                <button
                  onClick={() => setIsNamingModalOpen(true)}
                  disabled={assets.filter(a => a.selectedImage).length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-r-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold border-l border-indigo-500 transition-colors cursor-pointer disabled:opacity-50"
                  title="Customize image file naming (presets, tokens, case, prefix/suffix)"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-[11px]">Naming Rules</span>
                </button>
              </div>

              {/* Copy notification */}
              {copyFeedback && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-fade-in shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                  <span>{copyFeedback}</span>
                </span>
              )}

              {/* Copy TSV for Excel */}
              <button
                onClick={() => copyToClipboard(formatAssetsToTsv(filteredAssets, true), 'Copied columns (Page, Code, Selection, Source, Image ID, Status)')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                title="Copy columns (Page, Asset Code, Selection, Source, Image ID, Additional Comments, Status) formatted to paste into Excel"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy for Excel</span>
              </button>

              {/* Export Dropdown / Buttons */}
              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium transition-colors cursor-pointer shadow-sm"
                title="Export complete table to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>

              <button
                onClick={exportToCsv}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                title="Download CSV"
              >
                <span>CSV</span>
              </button>

              <button
                onClick={exportToWord}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                title="Download Word Document (.docx)"
              >
                <span>Word</span>
              </button>

              <button
                onClick={handleAddNewRow}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-colors cursor-pointer"
                title="Add a custom asset row"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>

              {/* Clear Button in toolbar */}
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-medium transition-colors cursor-pointer"
                title="Clear all extracted contact sheet data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Manual Review Attention Callout Bar */}
          {reviewStats.totalNeedsReview > 0 && (
            <div className="mx-4 sm:mx-6 my-3 p-3 bg-gradient-to-r from-amber-50 via-amber-50/80 to-rose-50/60 border border-amber-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-xs">
                      Manual Review Queue: {reviewStats.totalNeedsReview} item{reviewStats.totalNeedsReview > 1 ? 's' : ''} flagged
                    </span>
                    {statusFilter !== 'all' && (
                      <button
                        onClick={() => setStatusFilter('all')}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-semibold cursor-pointer"
                      >
                        Reset Filter (show all {assets.length})
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap mt-0.5">
                    {reviewStats.twoCommentsCount > 0 && (
                      <span className="inline-flex items-center gap-1 bg-amber-100/90 text-amber-950 px-1.5 py-0.5 rounded font-medium">
                        <MessageSquare className="w-3 h-3 text-amber-800" />
                        <strong>{reviewStats.twoCommentsCount}</strong> with 2 comments on page
                      </span>
                    )}
                    {reviewStats.clippedCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Scissors className="w-3 h-3 text-rose-600" />
                        <strong>{reviewStats.clippedCount}</strong> clipped filenames (missing .ext)
                      </span>
                    )}
                    {reviewStats.missingCount > 0 && (
                      <span>⚠️ <strong>{reviewStats.missingCount}</strong> missing selections</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => setStatusFilter(statusFilter === 'needs_review' ? 'all' : 'needs_review')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-2xs ${
                    statusFilter === 'needs_review'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Filter the table to show only items requiring manual review"
                >
                  <Filter className="w-3.5 h-3.5 text-amber-500" />
                  <span>{statusFilter === 'needs_review' ? 'Showing Flagged Only' : 'Filter Review Rows'}</span>
                </button>

                <button
                  onClick={handleCopyReviewItems}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                  title="Copy flagged review rows directly to clipboard formatted for Excel"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Review TSV for Excel</span>
                </button>
              </div>
            </div>
          )}

          {/* Background image compilation status banner */}
          {backgroundCompilation.isCompiling && (
            <div className="mx-6 mb-3 px-4 py-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-xs text-indigo-900 animate-fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span className="font-medium truncate">
                  <strong>Compiling images in background:</strong> {backgroundCompilation.completed} of {backgroundCompilation.total} clipped ({Math.round((backgroundCompilation.completed / (backgroundCompilation.total || 1)) * 100)}%)
                  {backgroundCompilation.currentAssetCode && (
                    <span className="font-mono text-indigo-700 font-bold ml-1.5">[{backgroundCompilation.currentAssetCode}]</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-28 bg-indigo-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(backgroundCompilation.completed / (backgroundCompilation.total || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-indigo-600 font-medium hidden sm:inline">Interactive preview active</span>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                  <th className="py-2.5 px-3 min-w-[85px] text-center">Page</th>
                  <th className="py-2.5 px-4 min-w-[170px]">Asset Code</th>
                  <th className="py-2.5 px-4 min-w-[220px]">Selection</th>
                  <th className="py-2.5 px-3 min-w-[130px]">Source</th>
                  <th className="py-2.5 px-3 min-w-[110px]">Image ID</th>
                  <th className="py-2.5 px-4 min-w-[260px]">
                    <div className="flex items-center gap-1.5">
                      <span>Extracted Image & Saved Name</span>
                      <button
                        onClick={() => setIsNamingModalOpen(true)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center gap-1 cursor-pointer font-normal normal-case"
                        title="Customize image file naming rules"
                      >
                        <Sliders className="w-3 h-3 text-indigo-600" />
                        <span className="text-[10px] text-indigo-600 font-semibold">Format</span>
                      </button>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[100px] text-center">Status</th>
                  <th className="py-2.5 px-3 min-w-[90px] text-center">Options</th>
                  <th className="py-2.5 px-3 min-w-[80px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 text-sm">
                      No assets found matching the current search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset, index) => {
                    const isEditing = editingId === asset.id;
                    const isMultiPage = asset.pages.length > 1;
                    const customFileName = formatCustomImageFileName(asset, index, namingOptions);

                    return (
                      <tr
                        key={asset.id}
                        className={`transition-colors ${
                          asset.hasClippedExtension
                            ? 'bg-rose-50/30 hover:bg-rose-50/45'
                            : asset.hasAdditionalComments || asset.hasTwoCommentsOnPage
                            ? 'bg-amber-50/30 hover:bg-amber-50/45'
                            : asset.status === 'Missing Selection'
                            ? 'bg-amber-50/15 hover:bg-amber-50/25'
                            : isMultiPage
                            ? 'bg-indigo-50/10 hover:bg-indigo-50/20'
                            : 'hover:bg-blue-50/30'
                        }`}
                      >
                        {/* 1. Row Number */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        {/* 2. Page Number in Contact Sheet PDF */}
                        <td className="py-2.5 px-3 text-center">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editPageDisplay}
                              onChange={(e) => setEditPageDisplay(e.target.value)}
                              className="w-16 px-1.5 py-1 bg-white border border-blue-400 rounded text-xs font-mono text-center focus:outline-blue-600"
                              placeholder="e.g. 1"
                            />
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold ${
                                isMultiPage
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                              title={isMultiPage ? `Asset spans multiple pages: ${asset.pageDisplay}` : `Contact sheet page ${asset.pageDisplay}`}
                            >
                              {isMultiPage && <Layers className="w-3 h-3 mr-1 text-indigo-500" />}
                              p. {asset.pageDisplay}
                            </span>
                          )}
                        </td>

                        {/* 3. Asset Code */}
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editAssetCode}
                              onChange={(e) => setEditAssetCode(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-mono font-bold focus:outline-blue-600"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span className="font-semibold">{asset.assetCode}</span>
                              <button
                                onClick={() => copyToClipboard(asset.assetCode, `Copied ${asset.assetCode}`)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-opacity"
                                title="Copy asset code"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {asset.userEdited && (
                                <span className="text-[10px] px-1 py-0.2 bg-slate-100 text-slate-500 rounded font-sans">
                                  edited
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Selection */}
                        <td className="py-2.5 px-4 font-mono">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editSelectedImage}
                              onChange={(e) => setEditSelectedImage(e.target.value)}
                              placeholder="e.g. Shutterstock_2342348.jpg"
                              className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-mono focus:outline-blue-600"
                            />
                          ) : asset.selectedImage ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 group">
                                <span className={`font-medium break-all select-all ${
                                  asset.hasClippedExtension ? 'text-rose-900 font-bold' : 'text-slate-900'
                                }`}>
                                  {asset.selectedImage}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(asset.selectedImage, `Copied ${asset.selectedImage}`)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-opacity shrink-0"
                                  title="Copy image filename"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>

                              {/* If filename is clipped / missing image extension, display warning & 1-click fixes */}
                              {asset.hasClippedExtension && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                                    title="Filename in contact sheet is clipped or missing .jpg extension"
                                  >
                                    <Scissors className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    <span>Clipped (no .ext)</span>
                                  </span>

                                  <button
                                    onClick={() => handleAppendExtension(asset.id, '.jpg')}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 cursor-pointer shadow-2xs transition-colors"
                                    title="Quick fix: Append .jpg extension to filename"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>Add .jpg</span>
                                  </button>

                                  {asset.clippedSuggestedOption && (
                                    <button
                                      onClick={() => handlePickCandidate(asset.id, asset.clippedSuggestedOption!)}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer shadow-2xs transition-colors truncate max-w-[170px]"
                                      title={`Fix with candidate found on page: ${asset.clippedSuggestedOption}`}
                                    >
                                      <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                      <span className="truncate">{asset.clippedSuggestedOption}</span>
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Highlight 2 comments on this page / review required */}
                              {(asset.hasTwoCommentsOnPage || asset.hasAdditionalComments) && (
                                <div className="mt-1 p-1.5 bg-amber-50/90 border border-amber-200 rounded text-[11px] text-amber-900 shadow-2xs space-y-1">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-950 border border-amber-300 shrink-0">
                                      <MessageSquare className="w-3 h-3 text-amber-800 shrink-0" />
                                      2 Comments on Page
                                    </span>
                                    <button
                                      onClick={() => setInspectingAsset(asset)}
                                      className="text-[10px] text-amber-800 hover:text-amber-950 underline font-semibold shrink-0 cursor-pointer"
                                      title="View both comments on this page"
                                    >
                                      Review
                                    </button>
                                  </div>
                                  {asset.additionalCommentReason && (
                                    <p className="truncate font-sans text-amber-900/90 text-[10px]" title={asset.additionalCommentReason}>
                                      {asset.additionalCommentReason}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-slate-400 italic">
                                <span>No image selected</span>
                                {asset.candidateOptions.length > 0 && (
                                  <button
                                    onClick={() => setInspectingAsset(asset)}
                                    className="not-italic text-[11px] text-blue-600 hover:text-blue-800 font-sans font-medium underline cursor-pointer"
                                  >
                                    Pick from {asset.candidateOptions.length} options
                                  </button>
                                )}
                              </div>
                              {/* Show 2 Comments flag if comments exist on missing page */}
                              {(asset.hasTwoCommentsOnPage || asset.hasAdditionalComments) && (
                                <div className="p-1 bg-amber-50 border border-amber-200 rounded flex items-center justify-between gap-1 text-[10px] text-amber-900">
                                  <span className="font-bold">2 Comments on Page</span>
                                  <button
                                    onClick={() => setInspectingAsset(asset)}
                                    className="underline font-semibold cursor-pointer"
                                  >
                                    Review
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Source */}
                        <td className="py-2.5 px-3">
                          {(() => {
                            const meta = extractSourceAndImageId(asset.selectedImage || '');
                            const displaySource = asset.source || meta.source;
                            if (displaySource && displaySource !== '—') {
                              const isDual = displaySource.includes('/');
                              return (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                    isDual
                                      ? 'bg-amber-50 text-amber-900 border-amber-200 font-semibold'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                  title={isDual ? 'Numeric image ID without explicit source: Shutterstock or Getty' : displaySource}
                                >
                                  {displaySource}
                                </span>
                              );
                            }
                            return <span className="text-slate-300">—</span>;
                          })()}
                        </td>

                        {/* 6. Image ID */}
                        <td className="py-2.5 px-3 font-mono">
                          {(() => {
                            const meta = extractSourceAndImageId(asset.selectedImage || '');
                            const displayImageId = asset.imageId || meta.imageId;
                            if (displayImageId && displayImageId !== '—') {
                              return (
                                <div className="flex items-center gap-1 group">
                                  <span className="font-semibold text-slate-800">{displayImageId}</span>
                                  <button
                                    onClick={() => copyToClipboard(displayImageId, `Copied Image ID ${displayImageId}`)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-opacity shrink-0"
                                    title="Copy Image ID"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            }
                            return <span className="text-slate-300">—</span>;
                          })()}
                        </td>

                        {/* 7. Extracted Image & Saved Name */}
                        <td className="py-2.5 px-4">
                          {asset.selectedImage ? (
                            <div className="flex items-center gap-2.5">
                              {/* Thumbnail preview button */}
                              <div
                                onClick={() => {
                                  const img = asset.extractedImage || generateSynthesizedSampleImage(
                                    asset.selectedPageNum || asset.pages[0] || 1,
                                    asset.assetCode,
                                    asset.selectedImage,
                                    asset.vendor
                                  );
                                  setActivePreviewImage({ image: img, asset });
                                }}
                                className="relative group/thumb cursor-pointer shrink-0 w-14 h-10 rounded-md overflow-hidden bg-slate-900 border border-slate-200 shadow-2xs hover:ring-2 hover:ring-indigo-400 transition-all"
                                title="Click to view full-size image & download"
                              >
                                {asset.extractedImage?.dataUrl ? (
                                  <img
                                    src={asset.extractedImage.dataUrl}
                                    alt={asset.selectedImage}
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 text-[10px]">
                                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Eye className="w-3.5 h-3.5" />
                                </div>
                              </div>

                              {/* Formatted File Name & Quick Actions */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span
                                    onClick={() => {
                                      const img = asset.extractedImage || generateSynthesizedSampleImage(
                                        asset.selectedPageNum || asset.pages[0] || 1,
                                        asset.assetCode,
                                        asset.selectedImage,
                                        asset.vendor
                                      );
                                      setActivePreviewImage({ image: img, asset });
                                    }}
                                    className="font-mono text-[11px] font-bold text-slate-800 truncate block select-all cursor-pointer hover:text-indigo-600"
                                    title={`Click to preview: ${customFileName}`}
                                  >
                                    {customFileName}
                                  </span>

                                  {/* Quick download single image button */}
                                  <button
                                    onClick={() => handleDownloadSingle(asset, index)}
                                    className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                                    title="Download this individual image file with current naming rules"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>

                                  {/* Quick copy formatted filename button */}
                                  <button
                                    onClick={() => copyToClipboard(customFileName, 'Copied image filename')}
                                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                                    title="Copy formatted file name"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-slate-500">
                                    p. {asset.selectedPageNum || asset.pages[0]}
                                  </span>
                                  <span>•</span>
                                  <span className="uppercase">{namingOptions.extension}</span>
                                  {asset.extractedImage?.width && (
                                    <>
                                      <span>•</span>
                                      <span>{asset.extractedImage.width}×{asset.extractedImage.height}px</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* 8. Status */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {asset.status === 'Selected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Selected</span>
                              </span>
                            ) : asset.status === 'Multiple Selections' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Info className="w-3 h-3" />
                                <span>Multiple</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Missing</span>
                              </span>
                            )}

                            {/* Flags */}
                            {asset.hasClippedExtension && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Scissors className="w-2.5 h-2.5" />
                                <span>Clipped .ext</span>
                              </span>
                            )}
                            {asset.hasHeaderComment ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title={asset.additionalCommentReason}>
                                <MessageSquare className="w-2.5 h-2.5 text-amber-700" />
                                <span>Header note</span>
                              </span>
                            ) : asset.isTwoCommentsDifferentPlaces ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200" title={asset.additionalCommentReason}>
                                <MessageSquare className="w-2.5 h-2.5 text-purple-600" />
                                <span>2 places</span>
                              </span>
                            ) : asset.hasAdditionalComments ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title={asset.additionalCommentReason}>
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>Extra note</span>
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* 9. Options count & view */}
                        <td className="py-2.5 px-3 text-center">
                          {asset.candidateOptions.length > 0 ? (
                            <button
                              onClick={() => setInspectingAsset(asset)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                              title="Inspect candidate research images on this page"
                            >
                              <span>{asset.candidateOptions.length} choices</span>
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>

                        {/* 10. Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => saveEditing(asset.id)}
                                className="px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEditing(asset)}
                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Edit asset code, selection, page, or comment"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(asset.id)}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Summary */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              Showing <strong className="text-slate-800">{filteredAssets.length}</strong> of{' '}
              <strong className="text-slate-800">{assets.length}</strong> extracted assets
              {statusFilter !== 'all' && ` (filtered by ${statusFilter})`}.
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{assets.filter(a => a.status === 'Selected').length} Selected</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>{assets.filter(a => a.status === 'Missing Selection').length} Missing</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview / Lightbox Modal */}
      {activePreviewImage && (() => {
        const lightboxFileName = formatCustomImageFileName(activePreviewImage.asset, 0, namingOptions);
        return (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                      {activePreviewImage.asset.assetCode}
                    </span>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                      Page {activePreviewImage.image.pageNum}
                    </span>
                    {activePreviewImage.asset.vendor && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                        {activePreviewImage.asset.vendor}
                      </span>
                    )}
                  </div>
                  <h3 className="font-mono font-bold text-slate-900 text-sm mt-1.5 truncate select-all">
                    {lightboxFileName}
                  </h3>
                </div>
                <button
                  onClick={() => setActivePreviewImage(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Preview Canvas / Image */}
              <div className="p-6 bg-slate-950 flex flex-col items-center justify-center min-h-[320px] max-h-[520px] overflow-auto relative">
                <img
                  src={activePreviewImage.image.dataUrl}
                  alt={lightboxFileName}
                  className="max-h-[460px] max-w-full rounded-lg shadow-2xl object-contain border border-slate-800"
                />
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white/80 text-[11px] font-mono px-2 py-1 rounded">
                  {activePreviewImage.image.width} × {activePreviewImage.image.height} px
                </div>
              </div>

              {/* Modal Footer / Actions */}
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-mono">
                  <span className="font-semibold text-slate-700">Source: </span>
                  <span className="select-all text-slate-900">{activePreviewImage.asset.selectedImage}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(lightboxFileName, 'Copied filename')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy File Name</span>
                  </button>

                  <button
                    onClick={() => handleDownloadSingle(activePreviewImage.asset, 0)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Image (.{namingOptions.extension})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Inspect / Pick Alternative Candidate Modal */}
      {inspectingAsset && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Research Options on Page {inspectingAsset.pageDisplay}</h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    {inspectingAsset.assetCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any option to assign it as the selected image for this asset.
                </p>
              </div>
              <button
                onClick={() => setInspectingAsset(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Clipped Extension Warning & Fix banner */}
              {inspectingAsset.hasClippedExtension && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex flex-wrap items-center justify-between gap-2.5 text-xs animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold text-rose-900">Truncated/Clipped Filename Detected:</span>
                      <p className="text-rose-700 text-[11px] mt-0.5">
                        The filename on page {inspectingAsset.pageDisplay} is missing its file extension (e.g. .jpg).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        handleAppendExtension(inspectingAsset.id, '.jpg');
                        setInspectingAsset(prev => prev ? ({
                          ...prev,
                          selectedImage: prev.selectedImage ? `${prev.selectedImage}.jpg` : '',
                          hasClippedExtension: false,
                        }) : null);
                      }}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded text-xs cursor-pointer shadow-2xs transition-colors"
                      title="Append .jpg extension"
                    >
                      + Append .jpg
                    </button>
                  </div>
                </div>
              )}

              {/* Current Selection & Reviewer Comments */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Selection:</div>
                  <div className="font-mono text-sm font-bold text-slate-900 flex items-center justify-between mt-1">
                    <span className={inspectingAsset.hasClippedExtension ? 'text-rose-900' : ''}>
                      {inspectingAsset.selectedImage || '(None selected yet)'}
                    </span>
                    {inspectingAsset.selectedImage && (
                      <span className="text-xs font-sans font-normal px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Source & Image ID */}
                {inspectingAsset.selectedImage && (() => {
                  const meta = extractSourceAndImageId(inspectingAsset.selectedImage);
                  const src = inspectingAsset.source || meta.source;
                  const imgId = inspectingAsset.imageId || meta.imageId;
                  return (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 font-semibold uppercase text-[10px] block">Source</span>
                        <span className="font-medium text-slate-800">{src}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold uppercase text-[10px] block">Image ID</span>
                        <span className="font-mono font-bold text-slate-800">{imgId}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Primary Comment */}
                {inspectingAsset.comments.length > 0 && (
                  <div className="pt-2 text-xs text-slate-700 border-t border-slate-200">
                    <div className="font-semibold text-slate-800 mb-0.5 flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">Primary Selection Comment:</span>
                        {inspectingAsset.comments[0].author && (
                          <span className="text-slate-400 font-normal">(by {inspectingAsset.comments[0].author})</span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {inspectingAsset.comments[0].locationDescription || (inspectingAsset.comments[0].subtype === 'Square' ? 'Rectangle around candidate image' : 'Image grid')}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200 font-mono text-xs select-all">
                      {inspectingAsset.selectionCommentText || inspectingAsset.comments[0].content}
                    </div>
                  </div>
                )}

                {/* Additional Page Comments / 2 Comments on Page */}
                {(inspectingAsset.hasTwoCommentsOnPage || inspectingAsset.hasAdditionalComments) && (
                  <div className="pt-2.5 text-xs border-t border-amber-200/70 space-y-2">
                    <div className="font-semibold text-amber-950 flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-bold">2 Comments on Page — Flagged for Review:</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-bold text-[11px] border border-amber-300">
                        2 Comments
                      </span>
                    </div>

                    {/* Detection diagnosis reason */}
                    {inspectingAsset.additionalCommentReason && (
                      <div className="p-2 bg-amber-100/70 border border-amber-200 rounded text-[11px] text-amber-900">
                        <strong>Review Note:</strong> {inspectingAsset.additionalCommentReason}
                      </div>
                    )}

                    <div className="space-y-2">
                      {(inspectingAsset.additionalComments && inspectingAsset.additionalComments.length > 0 
                        ? inspectingAsset.additionalComments 
                        : inspectingAsset.comments.slice(1)
                      ).map((cmt, cIdx) => (
                        <div key={cIdx} className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 font-sans text-xs text-amber-950 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-amber-800">
                            <span className="font-semibold flex items-center gap-1.5">
                              <span>Comment #{cIdx + 2}</span>
                              {cmt.locationDescription && (
                                <span className="text-slate-500 font-normal">({cmt.locationDescription})</span>
                              )}
                            </span>
                            {cmt.author && <span className="text-slate-500">by {cmt.author}</span>}
                          </div>
                          <p className="font-mono text-xs bg-white/80 p-1.5 rounded border border-amber-200/60 select-all">
                            {cmt.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* List of candidate research images */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Available Research Options ({inspectingAsset.candidateOptions.length}):
                </div>
                {inspectingAsset.candidateOptions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 text-center">
                    No image filenames detected in the text layer of this page.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {inspectingAsset.candidateOptions.map((opt, idx) => {
                      const isCurrentlySelected = inspectingAsset.selectedImage === opt;
                      const vendor = detectVendor(opt);

                      return (
                        <div
                          key={idx}
                          onClick={() => handlePickCandidate(inspectingAsset.id, opt)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isCurrentlySelected
                              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                              : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/40'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isCurrentlySelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold text-slate-900 truncate">
                                {opt}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Vendor: <span className="font-medium text-slate-700">{vendor}</span>
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isCurrentlySelected ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white px-2 py-1 rounded shadow-2xs border border-emerald-200">
                                <Check className="w-3.5 h-3.5" />
                                Selected
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              >
                                Select this
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  handlePickCandidate(inspectingAsset.id, '');
                }}
                className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                onClick={() => setInspectingAsset(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Naming Customization Modal */}
      <DownloadNamingModal
        isOpen={isNamingModalOpen}
        onClose={() => setIsNamingModalOpen(false)}
        options={namingOptions}
        onChangeOptions={(newOpts) => setNamingOptions(newOpts)}
        sampleAssets={assets}
        onDownloadZip={(opts) => {
          setIsNamingModalOpen(false);
          handleDownloadAllImagesZip(opts);
        }}
        isZipping={isZipping}
        totalAssetsToDownload={assets.filter(a => a.selectedImage).length}
      />
    </div>
  );
};
