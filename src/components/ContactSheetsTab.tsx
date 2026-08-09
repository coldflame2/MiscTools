import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  Plus, 
  RefreshCw, 
  Settings, 
  Check, 
  FolderOpen, 
  X, 
  Download, 
  Layers, 
  Info,
  Calendar,
  Grid,
  FileUp,
  Sliders,
  Type,
  FileText,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { 
  ContactSheetSettings, 
  ContactSheetPage, 
  SheetImage, 
  saveSettings, 
  loadSettings, 
  saveSheets, 
  loadSheets, 
  wipeDatabase 
} from '../services/contactSheetDb';

// Initial/Default settings
const DEFAULT_SETTINGS: ContactSheetSettings = {
  imageFit: 'contain',
  showLabels: true,
  labelFontSize: 10,
  labelColor: '#000000', // black
  labelFontFamily: 'Calibri, sans-serif',
  labelFontWeight: 'normal',
  backgroundCanvas: 'white',
  headerStyle: 'minimal',
  showFooter: false,
  footerShowPageNumber: false,
  footerCustomText: '',
  customTitle: 'RESEARCH SPECIFICATION SHEET',
  customSubtitle: 'Field Analysis & Asset Portfolio',
  customDate: new Date().toLocaleDateString(),
  minimalRightTitle: 'Photo Research',
  cellBackgroundColor: 'white',
  headerFontSize: 14,
  headerColor: '#000000',
  headerFontFamily: 'Calibri, sans-serif',
  headerFontWeight: 'bold',
  pageSize: 'A4',
  pageOrientation: 'portrait',
  pageMargin: 'narrow',
  gridRows: 5,
  gridCols: 4
};

const BACKGROUND_COLORS = {
  white: 'bg-white',
  black: 'bg-black text-white',
  charcoal: 'bg-slate-900 text-slate-100',
  transparent: 'bg-transparent border-2 border-dashed border-slate-300'
};

const CELL_BACKGROUND_COLORS = {
  white: 'bg-white',
  transparent: 'bg-transparent',
  'slate-50': 'bg-slate-50',
  'slate-100': 'bg-slate-100',
  'slate-800': 'bg-slate-800',
  black: 'bg-black'
};

import { PdfViewer } from './PdfViewer';

export const ContactSheetsTab: React.FC = () => {
  const [settings, setSettings] = useState<ContactSheetSettings>(DEFAULT_SETTINGS);
  const [sheets, setSheets] = useState<ContactSheetPage[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Progress states for PDF generation
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [previewMode, setPreviewMode] = useState<'interactive' | 'pdf'>('pdf');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    if (isExportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportDropdownOpen]);

  const [autoUpdate, setAutoUpdate] = useState<boolean>(true);
  const lastSettingsRef = useRef<string>('');
  const lastSheetsRef = useRef<string>('');

  const generatePreview = useCallback(async () => {
    if (sheets.length === 0) {
      setPreviewPdfUrl(null);
      return;
    }
    setIsPreviewGenerating(true);
    try {
      const { generatePdfBlob } = await import('./ContactSheetPDF');
      const blob = await generatePdfBlob(sheets, settings);
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      // Track exactly what we successfully generated
      lastSettingsRef.current = JSON.stringify(settings);
      lastSheetsRef.current = JSON.stringify(sheets);
    } catch (e) {
      console.error('Failed to generate preview', e);
    } finally {
      setIsPreviewGenerating(false);
    }
  }, [sheets, settings]);

  useEffect(() => {
    if (previewMode === 'pdf' && !previewPdfUrl && sheets.length > 0 && !isLoading) {
      generatePreview();
    }
  }, [previewMode, previewPdfUrl, sheets.length, isLoading, generatePreview]);

  // Debounced auto-update for True PDF Preview when settings or sheets change
  useEffect(() => {
    if (previewMode !== 'pdf' || !autoUpdate || sheets.length === 0 || isLoading) {
      return;
    }

    const currentSettingsStr = JSON.stringify(settings);
    const currentSheetsStr = JSON.stringify(sheets);

    // If the settings and sheets match what was last generated, do not regenerate
    if (currentSettingsStr === lastSettingsRef.current && currentSheetsStr === lastSheetsRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      generatePreview();
    }, 800);

    return () => clearTimeout(timer);
  }, [settings, sheets, autoUpdate, previewMode, isLoading, generatePreview]);

  // Sidebar and layout states
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isPagesSidebarCollapsed, setIsPagesSidebarCollapsed] = useState(false);
  const [controlsWidth, setControlsWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [specsWidth, setSpecsWidth] = useState(256);
  const [isResizingSpecs, setIsResizingSpecs] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute effective layout to ensure preview is always visible
  let effectiveIsControlsCollapsed = isControlsCollapsed;
  let effectiveIsSpecsCollapsed = isPagesSidebarCollapsed;
  
  let effectiveControlsWidth = effectiveIsControlsCollapsed ? 48 : controlsWidth;
  let effectiveSpecsWidth = effectiveIsSpecsCollapsed ? 48 : specsWidth;

  // The canvas needs a minimum width to display the grid correctly (images disappear if it gets too small)
  const MAIN_MIN_WIDTH = 700; 
  let availableForSidebars = windowWidth - MAIN_MIN_WIDTH;
  
  if (effectiveControlsWidth + effectiveSpecsWidth > availableForSidebars) {
    // 1. Collapse Controls
    effectiveIsControlsCollapsed = true;
    effectiveControlsWidth = 48;
  }
  
  if (effectiveControlsWidth + effectiveSpecsWidth > availableForSidebars) {
    // 2. Collapse Specs
    effectiveIsSpecsCollapsed = true;
    effectiveSpecsWidth = 48;
  }

  const [loadedIndices, setLoadedIndices] = useState<Record<number, boolean>>({});

  const workspaceScrollRef = useRef<HTMLDivElement>(null);

  // Track which sheet indexes have been loaded in the UI to prevent un-rendering them when out of view
  useEffect(() => {
    if (sheets.length === 0) {
      setLoadedIndices({});
      return;
    }
    setLoadedIndices(prev => {
      const next = { ...prev };
      // Always mark current, previous, and next pages as loaded
      for (let i = Math.max(0, activeSheetIndex - 1); i <= Math.min(sheets.length - 1, activeSheetIndex + 1); i++) {
        next[i] = true;
      }
      return next;
    });
  }, [activeSheetIndex, sheets.length]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const appendInputRef = useRef<HTMLInputElement>(null);

  const getCleanSpecName = useCallback((sheet: ContactSheetPage) => {
    const raw = sheet.specName || sheet.folderName || 'Unnamed spec.';
    return raw.replace(/\s*\(Part\s*\d+(?:\s*of\s*\d+)?\)$/i, '').trim() || 'Unnamed spec.';
  }, []);

  // Load from IndexedDB on Mount
  useEffect(() => {
    const initWorkspace = async () => {
      setIsLoading(true);
      try {
        const loadedSettings = await loadSettings();
        if (loadedSettings) {
          const merged = { ...DEFAULT_SETTINGS, ...loadedSettings };
          if (loadedSettings.pageSize === '12x12') merged.pageSize = 'A4';
          if (!loadedSettings.pageMargin) merged.pageMargin = 'narrow';
          if (!loadedSettings.gridRows || (loadedSettings.gridRows === 4 && loadedSettings.gridCols === 3)) {
            merged.gridRows = 5;
            merged.gridCols = 4;
          }
          setSettings(merged);
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        const loadedSheets = await loadSheets();
        if (loadedSheets && loadedSheets.length > 0) {
          setSheets(loadedSheets);
        }
      } catch (err) {
        console.error('Error loading workspace from IndexedDB:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initWorkspace();
  }, []);

  // Save to IndexedDB on changes
  useEffect(() => {
    if (!isLoading) {
      saveSettings(settings).catch(err => console.error('Failed to auto-save settings:', err));
    }
  }, [settings, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveSheets(sheets).catch(err => console.error('Failed to auto-save sheets:', err));
    }
  }, [sheets, isLoading]);

  // Reflow sheets when grid size changes or sheet items mismatch capacity
  useEffect(() => {
    if (isLoading || sheets.length === 0) return;
    
    const capacity = (settings.gridRows || 5) * (settings.gridCols || 4);
    if (capacity <= 0) return;
    
    let needsReflow = false;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].images.length > capacity) {
        needsReflow = true;
        break;
      }
      if (sheets[i].images.length < capacity && i < sheets.length - 1) {
        const curName = getCleanSpecName(sheets[i]);
        const nextName = getCleanSpecName(sheets[i + 1]);
        if (curName === nextName) {
          needsReflow = true;
          break;
        }
      }
      if (/\s*\(Part\s*\d+/i.test(sheets[i].folderName) || /\s*\(Part\s*\d+/i.test(sheets[i].specName || '')) {
        needsReflow = true;
        break;
      }
    }
    
    if (needsReflow) {
      const newSheets: ContactSheetPage[] = [];
      let currentGroupImages: SheetImage[] = [];
      let currentSpec = '';
      
      const flushGroup = () => {
        if (currentGroupImages.length === 0) return;
        for (let i = 0; i < currentGroupImages.length; i += capacity) {
          const chunk = currentGroupImages.slice(i, i + capacity);
          const partNum = Math.floor(i / capacity) + 1;
          newSheets.push({
            id: `sheet-${currentSpec.replace(/[^a-z0-9]+/gi, '-')}-${i}-${Date.now()}-${Math.random()}`,
            folderName: currentSpec,
            specName: currentSpec,
            partNumber: partNum,
            images: chunk
          });
        }
      };
      
      for (const sheet of sheets) {
        const cleanName = getCleanSpecName(sheet);
        if (cleanName !== currentSpec) {
          if (currentGroupImages.length > 0) flushGroup();
          currentSpec = cleanName;
          currentGroupImages = [...sheet.images];
        } else {
          currentGroupImages.push(...sheet.images);
        }
      }
      if (currentGroupImages.length > 0) flushGroup();
      
      setSheets(newSheets);
      
      if (activeSheetIndex >= newSheets.length) {
        setActiveSheetIndex(Math.max(0, newSheets.length - 1));
      }
    }
  }, [settings.gridRows, settings.gridCols, isLoading, sheets, getCleanSpecName]);


  // Global Drag and Drop event handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only turn off overlay if we leave the outer window
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Attach global listeners
  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [sheets]); // re-bind so handlers get fresh sheets context if needed

  // Helper: Read single file or blob to base64 URL, sniff mime type, and auto-convert unsupported formats (like WebP/GIF) to JPEG for PDF compat
  const fileToDataUrl = async (file: File | Blob): Promise<string> => {
    const buffer = await file.arrayBuffer();
    let mimeType = 'image/jpeg';
    const bytes = new Uint8Array(buffer.slice(0, 12));
    
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      mimeType = 'image/png';
    } else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      mimeType = 'image/jpeg';
    } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      mimeType = 'image/gif';
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && 
               bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      mimeType = 'image/webp';
    } else if (file.type && file.type.startsWith('image/')) {
      mimeType = file.type;
    }

    const blob = new Blob([buffer], { type: mimeType });
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // @react-pdf/renderer only supports PNG and JPEG. Convert WebP, GIF, or unknown to JPEG via Canvas.
    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
             resolve(rawDataUrl); // Fallback
             return;
          }
          ctx.fillStyle = '#ffffff'; // White bg for transparent gifs
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = () => resolve(rawDataUrl); // Fallback
        img.src = rawDataUrl;
      });
    }

    return rawDataUrl;
  };

  // Extract ZIP and group images based on folder structure rules
  const processZipFile = async (file: File): Promise<{ folderName: string; images: { name: string; dataUrl: string }[] }[]> => {
    // @ts-ignore
    const JSZip = window.JSZip;
    if (!JSZip) throw new Error("JSZip is not loaded in the browser.");
    
    const zip = await JSZip.loadAsync(file);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    
    interface ImageEntry {
      name: string;
      relativePath: string;
      dirPath: string;
      zipEntry: any;
    }
    
    const imageEntries: ImageEntry[] = [];
    
    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return; // skip directory entries
      
      const isImage = imageExtensions.some(ext => relativePath.toLowerCase().endsWith(ext));
      if (!isImage) return;
      
      const parts = relativePath.split('/');
      const name = parts[parts.length - 1];
      const dirPath = parts.slice(0, -1).join('/'); // empty string "" for root
      
      imageEntries.push({
        name,
        relativePath,
        dirPath,
        zipEntry
      });
    });

    if (imageEntries.length === 0) {
      return [];
    }

    // Set progress bar initial state
    setZipProgress({
      current: 0,
      total: imageEntries.length,
      message: `Extracting ${imageEntries.length} images from archive...`
    });

    interface ProcessedResult {
      name: string;
      dirPath: string;
      dataUrl: string;
    }

    const processedResults: ProcessedResult[] = [];
    let processedCount = 0;
    
    // Process with controlled concurrency
    const concurrencyLimit = 8;
    let entryIndex = 0;

    const runWorker = async () => {
      while (entryIndex < imageEntries.length) {
        const currentIdx = entryIndex++;
        const entry = imageEntries[currentIdx];
        try {
          // Extract as Blob (extremely fast, browser-native decompressed)
          let blob = await entry.zipEntry.async("blob");
          
          // Convert Blob to Base64 (extremely fast, browser-native C++)
          const dataUrl = await fileToDataUrl(blob);
          
          processedResults.push({
            name: entry.name,
            dirPath: entry.dirPath,
            dataUrl
          });
        } catch (err) {
          console.error(`Failed to decompress and process image: ${entry.relativePath}`, err);
        }

        processedCount++;
        setZipProgress({
          current: processedCount,
          total: imageEntries.length,
          message: `Decompressing and optimizing images (${processedCount}/${imageEntries.length})...`
        });
      }
    };

    // Start parallel worker loops
    const workers = Array.from({ length: Math.min(concurrencyLimit, imageEntries.length) }).map(() => runWorker());
    await Promise.all(workers);
    
    // Find unique active directory paths containing image files
    const activeDirs = Array.from(new Set(processedResults.map(entry => entry.dirPath)));
    
    const pagesList: { folderName: string; images: { name: string; dataUrl: string }[] }[] = [];
    
    // 1. Process root files (directly in ZIP root) -> "Unnamed spec."
    const rootResults = processedResults.filter(entry => entry.dirPath === "");
    if (rootResults.length > 0) {
      pagesList.push({
        folderName: "Unnamed spec.",
        images: rootResults.map(r => ({ name: r.name, dataUrl: r.dataUrl }))
      });
    }
    
    // 2. Process directories containing images -> Folder name itself is the spec name
    for (const dirPath of activeDirs) {
      if (dirPath === "") continue;
      
      const dirResults = processedResults.filter(entry => entry.dirPath === dirPath);
      if (dirResults.length === 0) continue;
      
      const parts = dirPath.split('/').filter(Boolean);
      const folderName = parts[parts.length - 1] || "Unnamed spec.";
      
      pagesList.push({
        folderName: folderName,
        images: dirResults.map(r => ({ name: r.name, dataUrl: r.dataUrl }))
      });
    }
    
    return pagesList;
  };

  // Main file processing orchestrator
  const processUploadedFiles = async (files: File[]) => {
    const imagesToGroup: { name: string; dataUrl: string }[] = [];
    const allZipPages: { folderName: string; images: { name: string; dataUrl: string }[] }[] = [];
    
    try {
      const zipFiles = files.filter(file => file.type === 'application/zip' || file.name.endsWith('.zip'));
      const imageFiles = files.filter(file => file.type.startsWith('image/'));

      // Process ZIPs
      for (const file of zipFiles) {
        try {
          const zipPages = await processZipFile(file);
          allZipPages.push(...zipPages);
        } catch (e) {
          console.error('Error processing ZIP file:', e);
          alert(`Could not extract ZIP "${file.name}": ` + (e instanceof Error ? e.message : 'Unknown error'));
        }
      }

      // Process direct images
      if (imageFiles.length > 0) {
        setZipProgress({
          current: 0,
          total: imageFiles.length,
          message: `Optimizing and importing ${imageFiles.length} images...`
        });

        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          try {
            const dataUrl = await fileToDataUrl(file);
            imagesToGroup.push({
              name: file.name,
              dataUrl: dataUrl
            });
          } catch (e) {
            console.error('Error processing image file:', e);
          }
          setZipProgress({
            current: i + 1,
            total: imageFiles.length,
            message: `Optimizing and importing images (${i + 1}/${imageFiles.length})...`
          });
        }
      }

      const newSheets: ContactSheetPage[] = [];
      const currentGridCapacity = (settings.gridRows || 5) * (settings.gridCols || 4);

      // 1. Create sheets from ZIP folders
      for (const page of allZipPages) {
        const filesList = page.images;
        const rawName = page.folderName || "Unnamed spec.";
        const cleanName = rawName.replace(/\s*\(Part\s*\d+(?:\s*of\s*\d+)?\)$/i, '').trim() || "Unnamed spec.";
        const chunkSize = currentGridCapacity;
        for (let i = 0; i < filesList.length; i += chunkSize) {
          const chunk = filesList.slice(i, i + chunkSize);
          const partNum = Math.floor(i / chunkSize) + 1;
            
          newSheets.push({
            id: `zip-${cleanName}-${i}-${Date.now()}-${Math.random()}`,
            folderName: cleanName,
            specName: cleanName,
            partNumber: partNum,
            images: chunk.map((img, index) => ({
              id: `img-${Date.now()}-${index}-${Math.random()}`,
              name: img.name,
              dataUrl: img.dataUrl
            }))
          });
        }
      }

      // 2. Create sheets from direct images
      if (imagesToGroup.length > 0) {
        const cleanName = "Direct Selection";
        const chunkSize = currentGridCapacity;
        for (let i = 0; i < imagesToGroup.length; i += chunkSize) {
          const chunk = imagesToGroup.slice(i, i + chunkSize);
          const partNum = Math.floor(i / chunkSize) + 1;

          newSheets.push({
            id: `direct-${i}-${Date.now()}`,
            folderName: cleanName,
            specName: cleanName,
            partNumber: partNum,
            images: chunk.map((img, index) => ({
              id: `img-${Date.now()}-${index}-${Math.random()}`,
              name: img.name,
              dataUrl: img.dataUrl
            }))
          });
        }
      }

      if (newSheets.length > 0) {
        setSheets(prev => {
          const updated = [...prev, ...newSheets];
          setActiveSheetIndex(prev.length); // switch to the first newly added sheet
          return updated;
        });
      }
    } catch (err) {
      console.error('Error during files processing:', err);
    } finally {
      setZipProgress(null);
    }
  };

  // Append/Upload more images to the CURRENT active sheet
  const handleAppendFiles = async (files: File[]) => {
    if (sheets.length === 0) {
      await processUploadedFiles(files);
      return;
    }

    const currentSheet = sheets[activeSheetIndex];
    const newImages: SheetImage[] = [];
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      try {
        setZipProgress({
          current: 0,
          total: imageFiles.length,
          message: `Appending ${imageFiles.length} images to current page...`
        });

        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          try {
            const dataUrl = await fileToDataUrl(file);
            newImages.push({
              id: `img-append-${Date.now()}-${Math.random()}`,
              name: file.name,
              dataUrl: dataUrl
            });
          } catch (e) {
            console.error('Error appending image file:', e);
          }
          setZipProgress({
            current: i + 1,
            total: imageFiles.length,
            message: `Optimizing and appending (${i + 1}/${imageFiles.length})...`
          });
        }
      } finally {
        setZipProgress(null);
      }
    }

    if (newImages.length > 0) {
      const updatedSheets = [...sheets];
      const mergedImages = [...currentSheet.images, ...newImages];
      
      // If the sheet exceeds 25 images, redistribute excess into new sheets or simply allow it (and paginate on render)
      // Standard practice: update active sheet's images
      updatedSheets[activeSheetIndex] = {
        ...currentSheet,
        images: mergedImages
      };
      
      setSheets(updatedSheets);
    }
  };

  // Image manipulation in specific sheet
  const handleRemoveImage = (sheetIndex: number, imageId: string) => {
    const updatedSheets = [...sheets];
    const currentSheet = updatedSheets[sheetIndex];
    if (!currentSheet) return;
    updatedSheets[sheetIndex] = {
      ...currentSheet,
      images: currentSheet.images.filter(img => img.id !== imageId)
    };
    // If sheet becomes empty, clean it up
    if (updatedSheets[sheetIndex].images.length === 0) {
      updatedSheets.splice(sheetIndex, 1);
      setActiveSheetIndex(Math.max(0, sheetIndex - 1));
    }
    setSheets(updatedSheets);
  };

  const handleMoveImage = (sheetIndex: number, imageId: string, direction: 'left' | 'right') => {
    const updatedSheets = [...sheets];
    const currentSheet = updatedSheets[sheetIndex];
    if (!currentSheet) return;
    const images = [...currentSheet.images];
    const index = images.findIndex(img => img.id === imageId);
    
    if (index === -1) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < images.length) {
      // swap elements
      const temp = images[index];
      images[index] = images[targetIndex];
      images[targetIndex] = temp;
      
      updatedSheets[sheetIndex] = {
        ...currentSheet,
        images: images
      };
      setSheets(updatedSheets);
    }
  };

  // Sidebar drag resizer handlers
  const startResizingControls = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const startResizingSpecs = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizingSpecs(true);
  }, []);

  useEffect(() => {
    if (!isResizing && !isResizingSpecs) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('workspace-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        
        if (isResizing) {
          const newWidth = e.clientX - rect.left;
          if (newWidth > 240 && newWidth < 550) {
            setControlsWidth(newWidth);
          }
        }
        
        if (isResizingSpecs) {
          const newWidth = rect.right - e.clientX;
          if (newWidth > 200 && newWidth < 500) {
            setSpecsWidth(newWidth);
          }
        }
      } else {
        if (isResizing) {
          if (e.clientX > 240 && e.clientX < 550) {
            setControlsWidth(e.clientX);
          }
        }
        if (isResizingSpecs) {
          const newWidth = window.innerWidth - e.clientX;
          if (newWidth > 200 && newWidth < 500) {
            setSpecsWidth(newWidth);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsResizingSpecs(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isResizingSpecs]);

  // Page selection and smooth scroll helper
  const scrollToPage = (index: number) => {
    setActiveSheetIndex(index);
    const element = document.getElementById(`live-preview-sheet-canvas-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Viewport scroll tracker to automatically set active page feedback
  useEffect(() => {
    if (sheets.length === 0) return;

    const scrollContainer = workspaceScrollRef.current;
    if (!scrollContainer) return;

    const observerOptions = {
      root: scrollContainer,
      rootMargin: '-20% 0px -40% 0px', // focused towards middle of viewport
      threshold: 0.15
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          const match = id.match(/live-preview-sheet-canvas-(\d+)/);
          if (match) {
            const index = parseInt(match[1]);
            setActiveSheetIndex(index);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sheets.forEach((_, index) => {
      const el = document.getElementById(`live-preview-sheet-canvas-${index}`);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [sheets]);

  // Actions
  const handleWipeWorkspace = async () => {
    try {
      await wipeDatabase();
      setSheets([]);
      setSettings(DEFAULT_SETTINGS);
      setActiveSheetIndex(0);
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Error wiping workspace:", err);
    }
  };

  // PDF Exporters
  const handleExportSingle = async () => {
    if (sheets.length === 0) return;
    const currentSheet = sheets[activeSheetIndex];
    setPdfProgress({ current: 0, total: 1 });
    try {
      const { generatePdfBlob } = await import('./ContactSheetPDF');
      const blob = await generatePdfBlob([currentSheet], settings);
      
      const filename = currentSheet.folderName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contact_sheet_${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to render PDF: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setPdfProgress(null);
    }
  };

  const handleExportPortfolio = async () => {
    if (sheets.length === 0) return;
    
    setPdfProgress({ current: 0, total: sheets.length });
    try {
      const { generatePdfBlob } = await import('./ContactSheetPDF');
      setPdfProgress({ current: Math.floor(sheets.length / 2), total: sheets.length });
      const blob = await generatePdfBlob(sheets, settings);
      
      setPdfProgress({ current: sheets.length, total: sheets.length });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_specifications_portfolio.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to render portfolio PDF: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setPdfProgress(null);
    }
  };

  const handleExportAllZip = async () => {
    if (specGroups.length === 0) return;
    
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const total = sheets.length;
    setPdfProgress({ current: 0, total });

    try {
      let currentProgress = 0;
      const { generatePdfBlob } = await import('./ContactSheetPDF');

      for (const group of specGroups) {
        const groupSheets = group.pages.map(p => p.sheet);
        const pdfBlob = await generatePdfBlob(groupSheets, settings);
        
        currentProgress += group.pages.length;
        setPdfProgress({ current: currentProgress, total });
        
        const filename = group.specName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        zip.file(`contact_sheet_${filename}.pdf`, pdfBlob);
      }
      
      setPdfProgress({ current: total, total });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "all_specs.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (e) {
      console.error(e);
      alert("Failed to render ZIP: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setPdfProgress(null);
    }
  };

  // Helper styles for presets
  const getHeaderStyle = () => {
    const isDark = settings.backgroundCanvas === 'black' || settings.backgroundCanvas === 'charcoal';
    switch (settings.headerStyle) {
      case 'minimal':
        return {
          wrapper: `border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-1.5 mb-2`,
          title: `text-lg font-bold font-sans tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`,
          subtitle: `text-xs font-semibold font-sans tracking-wide uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`,
          meta: ``
        };
      case 'classic':
        return {
          wrapper: `border-b-2 border-double ${isDark ? 'border-slate-700' : 'border-slate-400'} pb-3 mb-3 text-center`,
          title: `text-3xl font-serif font-medium tracking-normal ${isDark ? 'text-white' : 'text-slate-950'}`,
          subtitle: `text-sm italic ${isDark ? 'text-slate-300' : 'text-slate-700'} font-serif mt-1.5`,
          meta: `text-xs font-serif uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2`
        };
      case 'academic':
        return {
          wrapper: `border-t-2 border-b-2 ${isDark ? 'border-slate-100' : 'border-slate-950'} py-2 mb-3 grid grid-cols-2 gap-4 items-center`,
          title: `text-xl font-sans font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'} text-left uppercase`,
          subtitle: `text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'} text-left mt-1`,
          meta: `text-xs font-mono ${isDark ? 'text-slate-100' : 'text-slate-900'} text-right space-y-1`
        };
      case 'industrial':
        return {
          wrapper: `border-b-4 ${isDark ? 'border-white' : 'border-slate-950'} pb-2 mb-3 text-left relative`,
          title: `text-4xl font-mono font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-950'} uppercase`,
          subtitle: `text-sm font-mono font-bold ${isDark ? 'text-slate-950 bg-white' : 'text-slate-800 bg-slate-200'} px-2 py-0.5 inline-block mt-2`,
          meta: `text-xs font-mono font-semibold tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-3 block`
        };
      default:
        return {
          wrapper: `border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-2 mb-3 text-left`,
          title: `text-xl font-sans font-bold ${isDark ? 'text-white' : 'text-slate-900'}`,
          subtitle: `text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-1`,
          meta: `text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} mt-1`
        };
    }
  };

  const isDark = settings.backgroundCanvas === 'black' || settings.backgroundCanvas === 'charcoal';
  const headerTheme = getHeaderStyle();

  // Dynamic grouping of pages/sheets into unique Specs for the right sidebar
  const getSpecGroups = () => {
    interface SpecGroup {
      specName: string;
      pages: {
        sheetIndex: number;
        sheet: ContactSheetPage;
      }[];
    }
    
    const groups: SpecGroup[] = [];
    sheets.forEach((sheet, index) => {
      let specName = sheet.specName || "";
      if (!specName) {
        // Strip out any trailing part number suffix like " (Part 1)"
        specName = sheet.folderName.replace(/\s\(Part\s\d+\)$/, "");
      }
      
      let lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.specName === specName) {
        lastGroup.pages.push({ sheetIndex: index, sheet });
      } else {
        groups.push({
          specName,
          pages: [{ sheetIndex: index, sheet }]
        });
      }
    });
    return groups;
  };

  const specGroups = getSpecGroups();

  return (
    <div className="relative h-[calc(100vh-84px)] flex flex-col bg-slate-50 text-slate-800 rounded-xl overflow-hidden border border-slate-200">
      
      {/* Global Drag-and-Drop Immersive Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-blue-600/90 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm pointer-events-none transition-all duration-300">
          <div className="p-8 border-4 border-dashed border-white rounded-2xl flex flex-col items-center max-w-md text-center">
            <Upload className="w-16 h-16 animate-bounce mb-4" />
            <h3 className="text-2xl font-bold tracking-tight">Drop Files to Upload</h3>
            <p className="mt-2 text-blue-100">
              Drop ZIP archives or direct images anywhere on the screen to compile them instantly into professional contact sheets.
            </p>
          </div>
        </div>
      )}

      {/* PDF Generation Overlay */}
      {pdfProgress !== null && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-2">
          <div className="bg-white rounded-xl shadow-2xl p-2 max-w-sm w-full text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Rendering Portfolio PDF</h3>
            <p className="text-slate-500 text-sm mt-1">Generating high-fidelity print specifications...</p>
            
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Rendering Pages</span>
                <span className="font-semibold">{pdfProgress.current} / {pdfProgress.total}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZIP and Image Import Progress Overlay */}
      {zipProgress !== null && (
        <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-12 h-12 shrink-0">
                <div className="absolute inset-0 border-3 border-blue-100 rounded-full"></div>
                <div className="absolute inset-0 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-left min-w-0">
                <h3 className="text-base font-bold text-slate-950 truncate">Importing Assets</h3>
                <p className="text-xs text-slate-500 truncate">{zipProgress.message}</p>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
                <span>Optimizing image layouts</span>
                <span className="font-semibold font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded">
                  {zipProgress.current} / {zipProgress.total}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${zipProgress.total > 0 ? (zipProgress.current / zipProgress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-[10px] border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-2 flex-1">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-bold tracking-tight text-slate-900">
            Contact Sheets Workspace
          </h2>
        </div>

        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-md flex gap-1 border border-slate-200 h-[32px]">
              <button 
                onClick={() => setPreviewMode('interactive')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${previewMode === 'interactive' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Interactive Editor
              </button>
              <button 
                onClick={() => {
                  setPreviewMode('pdf');
                  if (!previewPdfUrl) generatePreview();
                }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${previewMode === 'pdf' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                True PDF Preview
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 flex-1">
          {sheets.length > 1 && (
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200 h-[32px]">
              <button
                onClick={() => scrollToPage(Math.max(0, activeSheetIndex - 1))}
                disabled={activeSheetIndex === 0}
                className="p-1 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <div className="relative flex items-center h-full">
                <select
                  value={activeSheetIndex}
                  onChange={(e) => scrollToPage(parseInt(e.target.value))}
                  className="text-xs font-medium bg-transparent border-none text-slate-700 py-0.5 pl-2 pr-5 focus:outline-none focus:ring-0 cursor-pointer appearance-none h-full"
                >
                  {sheets.map((sheet, index) => (
                    <option key={sheet.id} value={index}>
                      Page {index + 1}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1 pointer-events-none" />
              </div>
              <button
                onClick={() => scrollToPage(Math.min(sheets.length - 1, activeSheetIndex + 1))}
                disabled={activeSheetIndex === sheets.length - 1}
                className="p-1 rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Next Page"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {sheets.length > 0 && (
            <>
              <button
                onClick={() => appendInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md text-xs transition-colors h-[32px] cursor-pointer shadow-2xs"
                title="Append more assets to current workspace"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload More</span>
              </button>
              <input
                type="file"
                ref={appendInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && handleAppendFiles(Array.from(e.target.files))}
              />

              <div className="relative flex items-center h-[32px]" ref={exportDropdownRef}>
                <div className="flex rounded-md shadow-sm h-full">
                  <button
                    onClick={handleExportSingle}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-l-md text-xs transition-colors border-r-0 h-full"
                    title="Download current sheet as a standalone 12x12 PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Current</span>
                  </button>
                  <button
                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                    className={`flex items-center justify-center px-1.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-r-md transition-colors h-full ${isExportDropdownOpen ? 'bg-slate-100' : ''}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <AnimatePresence>
                  {isExportDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col"
                    >
                      <button
                        onClick={() => {
                          handleExportPortfolio();
                          setIsExportDropdownOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 text-left w-full transition-colors border-b border-slate-100"
                      >
                        <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 truncate">Export All Merged</span>
                          <span className="text-[10px] text-slate-500 font-normal truncate">Single multi-page PDF</span>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          handleExportAllZip();
                          setIsExportDropdownOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 text-left w-full transition-colors"
                      >
                        <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 truncate">Export All ZIP</span>
                          <span className="text-[10px] text-slate-500 font-normal truncate">Separate PDFs in a ZIP</span>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-medium rounded-md text-xs transition-colors h-[32px]"
                title="Clear current workspace and reset to defaults"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-grow flex flex-col items-center justify-center p-12">
          <RefreshCw className="w-10 h-10 animate-spin text-slate-400 mb-4" />
          <p className="text-slate-500 font-medium text-sm">Loading your creative workspace from database...</p>
        </div>
      ) : sheets.length === 0 ? (
        /* Empty State Landing / Upload Initial Workspace */
        <div className="flex-grow flex flex-col items-center justify-center p-1 max-w-2xl mx-auto text-center mt-2 mb-12">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 border border-blue-100">
            <Upload className="w-8 h-8" />
          </div>
          
          <h3 className="text-xl font-bold text-slate-900">Upload</h3>
          <p className="text-slate-600 text-sm mt-1 max-w-md">
            Import ZIP archives containing photo folders. 
            Folders will automatically compile into 12×12-inch grid.
          </p>

          <div className="mt-4 flex flex-col sm:flex-row gap-1 justify-center w-full max-w-md">
            <div 
              onClick={() => zipInputRef.current?.click()}
              className="flex-1 cursor-pointer p-5 border border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white hover:bg-blue-50/50 transition-all text-center flex flex-col items-center justify-center group"
            >
              <input 
                type="file" 
                ref={zipInputRef} 
                className="hidden" 
                accept=".zip" 
                onChange={(e) => e.target.files && processUploadedFiles(Array.from(e.target.files))} 
              />
              <FolderOpen className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
              <span className="font-semibold text-sm text-slate-700 group-hover:text-blue-700">Folder / ZIP Upload</span>
              <span className="text-xs text-slate-400 mt-1">Unpacks & groups by subfolder</span>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 cursor-pointer p-5 border border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white hover:bg-blue-50/50 transition-all text-center flex flex-col items-center justify-center group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                multiple 
                onChange={(e) => e.target.files && processUploadedFiles(Array.from(e.target.files))} 
              />
              <Plus className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
              <span className="font-semibold text-sm text-slate-700 group-hover:text-blue-700">Multi-Select Images</span>
              <span className="text-xs text-slate-400 mt-1">Direct upload of multiple images</span>
            </div>
          </div>

        </div>
      ) : (
        /* Workspace Screen */
        <div id="workspace-container" className="flex-grow flex flex-row relative overflow-hidden">

          {/* Left Sidebar: Controls & Settings Panel */}
          <motion.aside 
            key="controls-sidebar"
            initial={false}
            animate={{ 
              width: effectiveControlsWidth,
            }}
            transition={isResizing ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' }}
            className="border-r border-slate-200 bg-white flex flex-col flex-shrink-0 h-full overflow-hidden"
          >
            <div className={`pl-[16px] pr-4 h-[35px] pt-[10px] pb-[10px] border-b border-slate-200 bg-slate-50/50 flex items-center ${effectiveIsControlsCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
              <span className={`text-xs font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5 whitespace-nowrap transition-opacity duration-200 ${effectiveIsControlsCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                Specification Controls
              </span>
              <button
                onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                title={effectiveIsControlsCollapsed ? "Expand Controls" : "Collapse Controls"}
              >
                {effectiveIsControlsCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            <div 
              className={`flex-grow p-2.5 space-y-2.5 overflow-y-auto transition-opacity duration-200 ${effectiveIsControlsCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              style={{ width: controlsWidth }}
            >
              {/* PDF Preview Controls (Single Line) */}
              <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                <button 
                  onClick={async () => {
                    if (previewMode !== 'pdf') {
                      setPreviewMode('pdf');
                    }
                    await generatePreview();
                  }}
                  disabled={isPreviewGenerating || sheets.length === 0}
                  className="flex-grow bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 h-[28px] cursor-pointer shadow-2xs min-w-0"
                >
                  {isPreviewGenerating ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <RefreshCw className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">Update Preview</span>
                </button>
                <label className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold cursor-pointer select-none bg-white px-2 h-[28px] rounded border border-slate-200 shrink-0 shadow-2xs">
                  <input
                    type="checkbox"
                    checked={autoUpdate}
                    onChange={(e) => {
                      setAutoUpdate(e.target.checked);
                      if (e.target.checked && previewMode !== 'pdf') {
                        setPreviewMode('pdf');
                      }
                    }}
                    className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Live</span>
                </label>
              </div>

              {/* Header Content */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                  <Type className="w-3 h-3 text-slate-400" />
                  Header Content
                </div>

                {/* Right Title */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Header Title</label>
                  <input
                    type="text"
                    placeholder="Photo Research"
                    value={settings.minimalRightTitle || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, minimalRightTitle: e.target.value }))}
                    className="flex-grow min-w-0 px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                  />
                </div>

                {/* Header Font Controls */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Font Size</label>
                  <input
                    type="range"
                    min="8"
                    max="36"
                    value={settings.headerFontSize || 14}
                    onChange={(e) => setSettings(prev => ({ ...prev, headerFontSize: parseInt(e.target.value) }))}
                    className="flex-grow accent-blue-500 h-1.5"
                  />
                  <span className="text-xs font-mono text-slate-500 w-8 text-right shrink-0">{settings.headerFontSize || 14}px</span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Font Family</label>
                  <select
                    value={settings.headerFontFamily || 'Calibri, sans-serif'}
                    onChange={(e) => setSettings(prev => ({ ...prev, headerFontFamily: e.target.value }))}
                    className="flex-grow min-w-0 text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                  >
                    <option value="Calibri, sans-serif">Calibri</option>
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Font Weight</label>
                  <select
                    value={settings.headerFontWeight || 'bold'}
                    onChange={(e) => setSettings(prev => ({ ...prev, headerFontWeight: e.target.value }))}
                    className="flex-grow min-w-0 text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="100">Thin (100)</option>
                    <option value="300">Light (300)</option>
                    <option value="500">Medium (500)</option>
                    <option value="700">Bold (700)</option>
                    <option value="900">Black (900)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Font Color</label>
                  <div className="flex-grow min-w-0 flex items-center gap-1.5">
                    <input
                      type="color"
                      value={settings.headerColor || '#000000'}
                      onChange={(e) => setSettings(prev => ({ ...prev, headerColor: e.target.value }))}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                    />
                    <div className="flex gap-1 overflow-x-auto pb-0.5 flex-grow">
                      {['#000000', '#1e293b', '#64748b', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, headerColor: color }))}
                          className={`shrink-0 w-4 h-4 rounded border transition-all ${
                            (settings.headerColor || '#000000') === color ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Page Layout & Grid */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                  <BookOpen className="w-3 h-3 text-slate-400" />
                  Page Layout & Grid
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Page Size</label>
                  <select
                    value={settings.pageSize || 'A4'}
                    onChange={(e) => setSettings(prev => ({ ...prev, pageSize: e.target.value as any }))}
                    className="flex-grow min-w-0 text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="12x12">12x12 (Square)</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Orientation</label>
                  <select
                    value={settings.pageOrientation || 'portrait'}
                    onChange={(e) => setSettings(prev => ({ ...prev, pageOrientation: e.target.value as any }))}
                    className="flex-grow min-w-0 text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Margins</label>
                  <select
                    value={settings.pageMargin || 'narrow'}
                    onChange={(e) => setSettings(prev => ({ ...prev, pageMargin: e.target.value as any }))}
                    className="flex-grow min-w-0 text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                  >
                    <option value="narrow">Narrow (1/4 in)</option>
                    <option value="normal">Normal (1/2 in)</option>
                    <option value="wide">Wide (1 in)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Grid Layout</label>
                  <div className="flex-grow flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-xs text-slate-500">R:</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.gridRows || 5}
                        onChange={(e) => setSettings(prev => ({ ...prev, gridRows: parseInt(e.target.value) || 5 }))}
                        className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded-md text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-xs text-slate-500">C:</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.gridCols || 4}
                        onChange={(e) => setSettings(prev => ({ ...prev, gridCols: parseInt(e.target.value) || 4 }))}
                        className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded-md text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Labels configuration */}

              {/* Fit modes */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                  <Grid className="w-3 h-3 text-slate-400" />
                  Image Aspect Fit
                </div>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, imageFit: 'contain' }))}
                    className={`py-1 text-[11px] font-semibold rounded transition-all text-center ${
                      settings.imageFit === 'contain'
                        ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Contain
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, imageFit: 'cover' }))}
                    className={`py-1 text-[11px] font-semibold rounded transition-all text-center ${
                      settings.imageFit === 'cover'
                        ? 'bg-white text-blue-600 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cover (Crop)
                  </button>
                </div>
              </div>

              {/* Grid Background & Cell Background */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Canvas & Cell Background</div>
                
                {/* Canvas Background */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Canvas</label>
                  <div className="flex-grow min-w-0 flex items-center gap-1.5">
                    <input
                      type="color"
                      value={settings.backgroundCanvas?.startsWith('#') ? settings.backgroundCanvas : (settings.backgroundCanvas === 'black' ? '#000000' : settings.backgroundCanvas === 'charcoal' ? '#1e293b' : '#ffffff')}
                      onChange={(e) => setSettings(prev => ({ ...prev, backgroundCanvas: e.target.value }))}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                      title="Custom Canvas Color"
                    />
                    <div className="flex gap-1 overflow-x-auto pb-0.5 flex-grow items-center">
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, backgroundCanvas: 'transparent' }))}
                        className={`shrink-0 w-4 h-4 rounded border border-dashed border-slate-400 bg-transparent transition-all ${
                          settings.backgroundCanvas === 'transparent' ? 'border-blue-500 ring-1 ring-blue-500' : ''
                        }`}
                        title="Transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, backgroundCanvas: 'white' }))}
                        className={`shrink-0 w-4 h-4 rounded border transition-all bg-white ${
                          settings.backgroundCanvas === 'white' || settings.backgroundCanvas === '#ffffff' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'
                        }`}
                        title="White"
                      />
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, backgroundCanvas: 'black' }))}
                        className={`shrink-0 w-4 h-4 rounded border transition-all bg-black ${
                          settings.backgroundCanvas === 'black' || settings.backgroundCanvas === '#000000' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-800'
                        }`}
                        title="Black"
                      />
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, backgroundCanvas: 'charcoal' }))}
                        className={`shrink-0 w-4 h-4 rounded border transition-all bg-slate-800 ${
                          settings.backgroundCanvas === 'charcoal' || settings.backgroundCanvas === '#1e293b' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700'
                        }`}
                        title="Charcoal"
                      />
                    </div>
                  </div>
                </div>

                {/* Cell Background */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Cell Bg</label>
                  <div className="flex-grow min-w-0 flex items-center gap-1.5">
                    <input
                      type="color"
                      value={settings.cellBackgroundColor?.startsWith('#') ? settings.cellBackgroundColor : (settings.cellBackgroundColor === 'black' ? '#000000' : settings.cellBackgroundColor === 'slate-800' ? '#1e293b' : '#ffffff')}
                      onChange={(e) => setSettings(prev => ({ ...prev, cellBackgroundColor: e.target.value }))}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer shrink-0"
                      title="Custom Cell Color"
                    />
                    <div className="flex gap-1 overflow-x-auto pb-0.5 flex-grow items-center">
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, cellBackgroundColor: 'transparent' }))}
                        className={`shrink-0 w-4 h-4 rounded border border-dashed border-slate-400 bg-transparent transition-all ${
                          settings.cellBackgroundColor === 'transparent' ? 'border-blue-500 ring-1 ring-blue-500' : ''
                        }`}
                        title="Transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, cellBackgroundColor: 'white' }))}
                        className={`shrink-0 w-4 h-4 rounded border transition-all bg-white ${
                          settings.cellBackgroundColor === 'white' || settings.cellBackgroundColor === '#ffffff' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'
                        }`}
                        title="White"
                      />
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, cellBackgroundColor: 'slate-50' }))}
                        className={`shrink-0 w-4 h-4 rounded border transition-all bg-slate-100 ${
                          settings.cellBackgroundColor === 'slate-50' || settings.cellBackgroundColor === '#f8fafc' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200'
                        }`}
                        title="Light Gray"
                      />
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, cellBackgroundColor: 'black' }))}
                        className={`shrink-0 w-4 h-4 rounded border transition-all bg-black ${
                          settings.cellBackgroundColor === 'black' || settings.cellBackgroundColor === '#000000' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-800'
                        }`}
                        title="Black"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer controls */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Footer Config</span>
                  <input
                    type="checkbox"
                    checked={settings.showFooter}
                    onChange={(e) => setSettings(prev => ({ ...prev, showFooter: e.target.checked }))}
                    className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {settings.showFooter && (
                  <div className="space-y-1.5 pl-1.5 border-l-2 border-slate-200 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-medium">Page Numbers</span>
                      <input
                        type="checkbox"
                        checked={settings.footerShowPageNumber}
                        onChange={(e) => setSettings(prev => ({ ...prev, footerShowPageNumber: e.target.checked }))}
                        className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 shrink-0 font-medium w-24">Footer Notes</label>
                      <input
                        type="text"
                        value={settings.footerCustomText}
                        onChange={(e) => setSettings(prev => ({ ...prev, footerCustomText: e.target.value }))}
                        className="flex-grow min-w-0 text-xs px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          </motion.aside>

          {/* Vertical Drag Resizer Handle Bar */}
          <div
            className="w-1 hover:w-1.5 bg-slate-200 hover:bg-blue-500 cursor-col-resize select-none transition-all duration-150 self-stretch z-10 shrink-0"
            onMouseDown={startResizingControls}
            title="Drag to resize Controls Sidebar"
          />

      {/* Right Workspace: Browser Interactive Previews */}
      <main className="flex-grow flex flex-col min-w-0 bg-slate-100 overflow-hidden relative">

        {/* Core Interactive Specification Preview */}
        {previewMode === 'pdf' ? (
          <div className="flex-grow relative overflow-hidden bg-slate-300 flex items-center justify-center p-0">
            {previewPdfUrl ? (
                <PdfViewer url={previewPdfUrl} pageNumber={activeSheetIndex + 1} />
            ) : (
              <div className="text-slate-500 flex flex-col items-center">
                 {sheets.length > 0 ? (
                   <>
                     <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                     <p>Generating PDF Preview...</p>
                   </>
                 ) : (
                   <p>Upload files to start.</p>
                 )}
              </div>
            )}
          </div>
        ) : (
        <div 
          ref={workspaceScrollRef}
          className="flex-grow pt-2 pb-8 px-4 sm:pb-12 sm:px-8 overflow-y-auto flex flex-col items-center gap-8 min-h-[500px]"
          style={{ scrollBehavior: 'smooth' }}
        >
          {sheets.map((sheet, index) => {
            const group = specGroups.find(g => g.pages.some(p => p.sheetIndex === index));
            const pIdx = group?.pages.findIndex(p => p.sheetIndex === index) ?? -1;
            const isMultiPage = (group?.pages.length ?? 0) > 1;
            const cleanFolderName = group?.specName || sheet.folderName.replace(/\s\(Part\s\d+\)$/, "");

            const isLoaded = loadedIndices[index] || Math.abs(index - activeSheetIndex) <= 1;

            return (
              <div 
                key={sheet.id}
                id={`live-preview-sheet-canvas-${index}`}
                className="relative shadow-2xl rounded-lg overflow-visible max-w-[700px] w-full bg-white transition-all duration-300 scroll-mt-10 shrink-0"
              >
                
                {/* Part indicator overlay on top center */}
                {isMultiPage && (
                  <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-slate-200 text-slate-600 font-sans text-[11px] font-bold px-3 py-1 rounded-t-lg border border-b-0 border-slate-300 shadow-sm z-20">
                    PART {pIdx + 1} OF {group?.pages.length}
                  </div>
                )}

                {/* Canvas Aspect Block */}
                <div 
                  className={`w-full ${
                    settings.pageSize === 'A4'
                      ? (settings.pageOrientation === 'landscape' ? 'aspect-[1.414/1]' : 'aspect-[1/1.414]')
                      : settings.pageSize === 'Letter'
                      ? (settings.pageOrientation === 'landscape' ? 'aspect-[11/8.5]' : 'aspect-[8.5/11]')
                      : 'aspect-square'
                  } p-4 sm:p-6 flex flex-col justify-between ${BACKGROUND_COLORS[settings.backgroundCanvas]} select-none border border-slate-300 rounded-lg overflow-hidden`}
                  style={{
                    boxSizing: 'border-box'
                  }}
                >
                  
                  {/* BRANDING HEADER */}
                  <header className={headerTheme.wrapper}>
                    {settings.headerStyle === 'minimal' ? (
                      <div className="flex justify-between items-baseline w-full">
                        <span 
                          className={headerTheme.title}
                          style={{
                            color: settings.headerColor || '#000000',
                            fontSize: `${settings.headerFontSize || 14}px`,
                            fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                            fontWeight: settings.headerFontWeight || 'bold'
                          }}
                        >
                          {cleanFolderName}
                        </span>
                        <span 
                          className={headerTheme.subtitle}
                          style={{
                            color: settings.headerColor || '#000000',
                            fontSize: `${settings.headerFontSize || 14}px`,
                            fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                            fontWeight: settings.headerFontWeight || 'bold'
                          }}
                        >
                          {settings.minimalRightTitle || 'Photo Research'}
                        </span>
                      </div>
                    ) : settings.headerStyle === 'academic' ? (
                      <>
                        <div>
                          <h4 
                            className={headerTheme.title}
                            style={{
                              color: settings.headerColor || '#000000',
                              fontSize: `${(settings.headerFontSize || 14) * 1.3}px`,
                              fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                              fontWeight: settings.headerFontWeight || 'bold'
                            }}
                          >
                            {cleanFolderName}
                          </h4>
                          <p className={headerTheme.subtitle}>{settings.customSubtitle}</p>
                        </div>
                        <div 
                          className={headerTheme.meta}
                          style={{
                            color: settings.headerColor || '#000000',
                            fontSize: `${settings.headerFontSize || 14}px`,
                            fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                            fontWeight: settings.headerFontWeight || 'bold'
                          }}
                        >
                          <div><strong>Folder:</strong> {cleanFolderName}</div>
                          <div><strong>Date:</strong> {settings.customDate}</div>
                        </div>
                      </>
                    ) : settings.headerStyle === 'classic' ? (
                      <div className="w-full text-center">
                        <h4 
                          className={headerTheme.title}
                          style={{
                            color: settings.headerColor || '#000000',
                            fontSize: `${(settings.headerFontSize || 14) * 1.8}px`,
                            fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                            fontWeight: settings.headerFontWeight || 'bold'
                          }}
                        >
                          {cleanFolderName}
                        </h4>
                        <p className={headerTheme.subtitle}>{settings.customSubtitle}</p>
                        <div 
                          className={`${headerTheme.meta} mt-2 text-center`}
                          style={{
                            color: settings.headerColor || '#000000',
                            fontSize: `${settings.headerFontSize || 14}px`,
                            fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                            fontWeight: settings.headerFontWeight || 'normal'
                          }}
                        >
                          Folder: {cleanFolderName} | {settings.customDate}
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 
                          className={headerTheme.title}
                          style={{
                            color: settings.headerColor || '#000000',
                            fontSize: `${(settings.headerFontSize || 14) * 2.2}px`,
                            fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                            fontWeight: settings.headerFontWeight || 'bold'
                          }}
                        >
                          {cleanFolderName}
                        </h4>
                        <div className="flex justify-between items-end">
                          <p className={headerTheme.subtitle}>{settings.customSubtitle}</p>
                          <span 
                            className={headerTheme.meta || 'text-xs text-slate-400 font-mono'}
                            style={{
                              color: settings.headerColor || '#000000',
                              fontSize: `${settings.headerFontSize || 14}px`,
                              fontFamily: settings.headerFontFamily || 'Calibri, sans-serif',
                              fontWeight: settings.headerFontWeight || 'bold'
                            }}
                          >
                            Folder: {cleanFolderName} | {settings.customDate}
                          </span>
                        </div>
                      </>
                    )}
                  </header>

                  {/* DYNAMIC ASSETS GRID */}
                  <div 
                    className="flex-grow grid gap-2 items-stretch justify-items-stretch min-h-0 mt-2 mb-2"
                    style={{
                      gridTemplateColumns: `repeat(${settings.gridCols || 4}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${settings.gridRows || 5}, minmax(0, 1fr))`
                    }}
                  >
                    {!isLoaded ? (
                      <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-xs font-mono">Loading assets...</span>
                      </div>
                    ) : (
                      Array.from({ length: (settings.gridCols || 4) * (settings.gridRows || 5) }).map((_, slotIndex) => {
                        const image = sheet.images[slotIndex];
                        
                        if (!image) {
                          return (
                            <div 
                              key={`empty-${slotIndex}`}
                              className={`h-full min-h-0 rounded-md flex items-center justify-center ${
                                isDark 
                                  ? 'bg-slate-900/10' 
                                  : CELL_BACKGROUND_COLORS[settings.cellBackgroundColor as keyof typeof CELL_BACKGROUND_COLORS]
                              }`}
                            />
                          );
                        }

                        return (
                          <div 
                            key={image.id}
                            className={`group relative h-full min-h-0 min-w-0 rounded flex flex-col justify-between overflow-hidden ${
                              isDark 
                                ? 'bg-slate-950/20' 
                                : CELL_BACKGROUND_COLORS[settings.cellBackgroundColor as keyof typeof CELL_BACKGROUND_COLORS]
                            }`}
                          >
                            {/* Hover Operations overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col justify-between p-1.5 pointer-events-auto">
                              <div className="flex justify-between w-full">
                                <button
                                  onClick={() => handleMoveImage(index, image.id, 'left')}
                                  disabled={slotIndex === 0}
                                  className="p-1 bg-white/10 hover:bg-white/30 rounded text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                  title="Move Left"
                                >
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveImage(index, image.id)}
                                  className="p-1 bg-red-600 hover:bg-red-700 rounded text-white cursor-pointer"
                                  title="Remove Image"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMoveImage(index, image.id, 'right')}
                                  disabled={slotIndex === sheet.images.length - 1}
                                  className="p-1 bg-white/10 hover:bg-white/30 rounded text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                  title="Move Right"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="text-[9px] text-white font-mono truncate w-full" title={image.name}>
                                {image.name}
                              </div>
                            </div>

                            {/* Image display */}
                            <div className="flex-grow w-full h-0 relative flex items-center justify-center overflow-hidden min-h-0">
                              <img
                                src={image.dataUrl}
                                alt={image.name}
                                className={`w-full h-full ${
                                  settings.imageFit === 'contain' 
                                    ? 'object-contain object-center' 
                                    : 'object-cover object-center'
                                }`}
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            {/* Optional visual label */}
                            {settings.showLabels && (
                              <div 
                                className={`py-1 px-1 text-center select-all break-all overflow-hidden shrink-0 flex flex-col justify-center items-center bg-transparent`}
                                style={{ 
                                  fontSize: `${settings.labelFontSize}px`,
                                  color: settings.labelColor,
                                  fontFamily: settings.labelFontFamily,
                                  fontWeight: settings.labelFontWeight,
                                  lineHeight: '1.2'
                                }}
                                title={image.name}
                              >
                                {image.name.replace(/\.[^/.]+$/, "")}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* SPECIFICATION FOOTER */}
                  {settings.showFooter && (
                    <footer className={`border-t pt-2 mt-2 flex justify-between items-center text-xs font-sans ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-400'
                    }`}>
                      <span className="truncate max-w-[70%]">{settings.footerCustomText}</span>
                      {settings.footerShowPageNumber && (
                        <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Page {index + 1} of {sheets.length}
                        </span>
                      )}
                    </footer>
                  )}

                </div>
              </div>
            );
          })}
        </div>
        )}


          </main>

          {/* Right Handle Resizer */}
          <div
            className="w-1 hover:w-1.5 bg-slate-200 hover:bg-blue-500 cursor-col-resize select-none transition-all duration-150 self-stretch z-10 shrink-0"
            onMouseDown={startResizingSpecs}
            title="Drag to resize Specs Sidebar"
          />

          {/* Specs Sidebar (Right) */}
          <motion.aside
            key="specs-sidebar"
            initial={false}
            animate={{ 
              width: effectiveSpecsWidth,
            }}
            transition={isResizingSpecs ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' }}
            className="border-l border-slate-200 bg-white flex flex-col flex-shrink-0 h-full overflow-hidden relative"
          >
            <div className={`px-4 h-[35px] pt-[10px] pb-[10px] border-b border-slate-200 bg-slate-50/50 flex items-center ${effectiveIsSpecsCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
              <button
                onClick={() => setIsPagesSidebarCollapsed(!isPagesSidebarCollapsed)}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                title={effectiveIsSpecsCollapsed ? "Expand Specs" : "Collapse Specs"}
              >
                {effectiveIsSpecsCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <span className={`text-xs font-bold tracking-widest text-slate-400 uppercase flex items-center gap-1.5 whitespace-nowrap transition-opacity duration-200 ${effectiveIsSpecsCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                <BookOpen className="w-3.5 h-3.5" />
                Specs ({specGroups.length})
              </span>
            </div>

            <div 
              className={`flex-grow p-2 space-y-1 overflow-y-auto bg-slate-50/30 transition-opacity duration-200 ${effectiveIsSpecsCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              style={{ width: specsWidth }}
            >
                {specGroups.map((group, groupIdx) => {
                  const isSpecActive = group.pages.some(p => p.sheetIndex === activeSheetIndex);
                  
                  // Single page Spec -> render compact block
                  if (group.pages.length === 1) {
                    const page = group.pages[0];
                    const isActive = page.sheetIndex === activeSheetIndex;
                    return (
                      <button
                        key={page.sheet.id}
                        onClick={() => scrollToPage(page.sheetIndex)}
                        className={`w-full text-left px-2 py-1 rounded-md border transition-all flex items-center justify-between gap-2 group cursor-pointer ${
                          isActive
                            ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center min-w-0 w-full gap-2">
                          <span className={`text-xs truncate ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-700'}`} title={group.specName}>
                            {group.specName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                            {page.sheet.images.length}/{settings.gridRows && settings.gridCols ? settings.gridRows * settings.gridCols : 20}
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" title="Current Spec" />
                          )}
                        </div>
                      </button>
                    );
                  }
                  
                  // Multi-page Spec -> render grouped list
                  return (
                    <div 
                      key={`spec-group-${groupIdx}-${group.specName}`}
                      className={`border rounded-md bg-white overflow-hidden shadow-sm transition-all ${
                        isSpecActive ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                      }`}
                    >
                      <div className={`px-2 py-1 border-b flex items-center justify-between ${
                        isSpecActive ? 'bg-blue-50/40 border-blue-100' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <div className="flex items-center min-w-0 pr-2">
                          <span className={`text-xs truncate ${
                            isSpecActive ? 'text-slate-900 font-bold' : 'text-slate-800'
                          }`} title={group.specName}>
                            {group.specName}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded shrink-0">
                          {group.pages.length} pgs
                        </span>
                      </div>
                      <div className="p-0.5 space-y-0.5 bg-slate-50/20">
                        {group.pages.map((p, pIdx) => {
                          const isPageActive = p.sheetIndex === activeSheetIndex;
                          return (
                            <button
                              key={p.sheet.id}
                              onClick={() => scrollToPage(p.sheetIndex)}
                              className={`w-full text-left px-2 py-1 rounded transition-all flex items-center justify-between gap-2 group cursor-pointer text-xs ${
                                isPageActive
                                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                              }`}
                            >
                              <span className="truncate">Page {pIdx + 1}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                                  {p.sheet.images.length}/{settings.gridRows && settings.gridCols ? settings.gridRows * settings.gridCols : 20}
                                </span>
                                {isPageActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.aside>

        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-50 rounded-full text-rose-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Clear Workspace?</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Are you sure you want to clear your current workspace? This will erase all uploaded contact sheets, layout settings, and image assets permanently. This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleWipeWorkspace}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
