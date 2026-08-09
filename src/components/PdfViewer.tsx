import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, ChevronDown, RefreshCw, Check } from 'lucide-react';

// Set workerSrc for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  pageNumber: number;
}

const PRESET_ZOOMS = [
  { label: '25%', value: 0.25 },
  { label: '35%', value: 0.35 },
  { label: '50%', value: 0.50 },
  { label: '65%', value: 0.65 },
  { label: '75%', value: 0.75 },
  { label: '85%', value: 0.85 },
  { label: '90%', value: 0.90 },
  { label: '95%', value: 0.95 },
  { label: '100% (Actual)', value: 1.00 },
  { label: '110%', value: 1.10 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.50 },
  { label: '175%', value: 1.75 },
  { label: '200%', value: 2.00 },
  { label: '250%', value: 2.50 },
  { label: '300%', value: 3.00 },
];

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, pageNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isPresetOpen, setIsPresetOpen] = useState<boolean>(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

  const BASE_WIDTH = 750;

  // Render PDF page onto canvas at high resolution
  useEffect(() => {
    let active = true;
    let renderTask: any = null;
    setIsLoading(true);
    setError(null);

    const renderPage = async () => {
      if (!url || !canvasRef.current) return;
      
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        if (!active) return;

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        if (!active) return;
        
        const validPageNum = Math.min(Math.max(1, pageNumber), pdf.numPages);
        const page = await pdf.getPage(validPageNum);
        if (!active) return;
        
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        setPageDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });

        // Render at high resolution (3.0 scale) so zoomed view remains crisp
        const renderScale = 3.0;
        const viewport = page.getViewport({ scale: renderScale });
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        renderTask = page.render(renderContext);
        await renderTask.promise;
        if (active) {
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') return;
        console.error('Error rendering PDF:', err);
        if (active) {
          setError(String(err?.message || err));
          setIsLoading(false);
        }
      }
    };
    
    renderPage();
    
    return () => {
      active = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [url, pageNumber]);

  // Click outside listener for preset menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom(z => Math.min(3.0, Math.round((z + 0.05) * 100) / 100));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(z => Math.max(0.25, Math.round((z - 0.05) * 100) / 100));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(3.0, Math.round((z + 0.05) * 100) / 100));
  const handleZoomOut = () => setZoom(z => Math.max(0.25, Math.round((z - 0.05) * 100) / 100));
  const handleZoomReset = () => setZoom(1.0);

  // Fit Page: calculates zoom so whole page height and width fit inside container
  const handleFitPage = useCallback(() => {
    if (!containerRef.current || !pageDimensions) return;
    const padding = 64;
    const cw = Math.max(100, containerRef.current.clientWidth - padding);
    const ch = Math.max(100, containerRef.current.clientHeight - padding);
    
    const scaleX = cw / pageDimensions.width;
    const scaleY = ch / pageDimensions.height;
    const fitScale = Math.min(scaleX, scaleY);
    
    const baseScale = BASE_WIDTH / pageDimensions.width;
    const calculatedZoom = fitScale / baseScale;
    
    setZoom(Math.min(3.0, Math.max(0.25, Math.round(calculatedZoom * 100) / 100)));
  }, [pageDimensions]);

  // Fit Width: calculates zoom so page width fills container
  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !pageDimensions) return;
    const padding = 64;
    const cw = Math.max(100, containerRef.current.clientWidth - padding);
    
    const fitScale = cw / pageDimensions.width;
    const baseScale = BASE_WIDTH / pageDimensions.width;
    const calculatedZoom = fitScale / baseScale;
    
    setZoom(Math.min(3.0, Math.max(0.25, Math.round(calculatedZoom * 100) / 100)));
  }, [pageDimensions]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoom(z => Math.min(3.0, Math.max(0.25, Math.round((z + delta) * 100) / 100)));
    }
  };

  // Compute CSS dimensions
  const aspectRatio = pageDimensions ? pageDimensions.height / pageDimensions.width : 1.0;
  const displayWidth = Math.round(BASE_WIDTH * zoom);
  const displayHeight = Math.round(displayWidth * aspectRatio);

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 p-6 rounded-xl border border-red-200 flex flex-col items-center justify-center h-full max-w-md mx-auto my-auto text-center">
        <p className="font-semibold text-sm mb-1">Failed to Render PDF</p>
        <p className="text-xs text-red-500 font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-300 overflow-hidden select-none">
      {/* Scrollable Canvas Workspace */}
      <div 
        ref={containerRef}
        className="flex-grow overflow-auto p-6 sm:p-10 relative flex flex-col min-h-0 min-w-0"
        onWheel={handleWheel}
      >
        <div 
          className="m-auto shrink-0 bg-white shadow-2xl rounded border border-slate-400 relative transition-[width,height] duration-150 ease-out"
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
          }}
        >
            <canvas 
              ref={canvasRef} 
              className="w-full h-full block rounded"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded">
                <div className="flex items-center gap-2 bg-slate-900 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Rendering PDF...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      
      {/* Sleek Floating Granular Zoom Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/95 text-white backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-slate-700/80 z-30 transition-all duration-200">
        
        {/* Zoom Out Button */}
        <button 
          onClick={handleZoomOut}
          disabled={zoom <= 0.25}
          className="p-1.5 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          title="Zoom Out ( - / 5% steps )"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Granular Zoom Range Slider */}
        <div className="flex items-center gap-2 px-1">
          <input
            type="range"
            min={25}
            max={300}
            step={1}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(parseFloat(e.target.value) / 100)}
            className="w-24 sm:w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
            title="Drag for precise zoom adjustment (25% - 300%)"
          />
        </div>

        {/* Zoom In Button */}
        <button 
          onClick={handleZoomIn}
          disabled={zoom >= 3.0}
          className="p-1.5 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          title="Zoom In ( + / 5% steps )"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Vertical Divider */}
        <div className="w-px h-4 bg-slate-700 mx-0.5" />

        {/* Preset Selector Dropdown Trigger */}
        <div className="relative" ref={presetDropdownRef}>
          <button
            onClick={() => setIsPresetOpen(!isPresetOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-slate-800 rounded-lg text-xs font-semibold font-mono text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Select Preset Zoom"
          >
            <span>{Math.round(zoom * 100)}%</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isPresetOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Preset Dropdown Popover */}
          {isPresetOpen && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 w-44 z-40 max-h-64 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                Quick Actions
              </div>
              <button
                onClick={() => {
                  handleFitPage();
                  setIsPresetOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
              >
                <span>Fit Page</span>
                <Maximize className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                onClick={() => {
                  handleFitWidth();
                  setIsPresetOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors"
              >
                <span>Fit Width</span>
                <span className="text-[10px] text-slate-400">↔</span>
              </button>
              <button
                onClick={() => {
                  handleZoomReset();
                  setIsPresetOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-600 hover:text-white flex items-center justify-between transition-colors border-b border-slate-800 mb-1"
              >
                <span>100% (Actual Size)</span>
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Preset Levels
              </div>
              {PRESET_ZOOMS.map((preset) => {
                const isSelected = Math.abs(zoom - preset.value) < 0.01;
                return (
                  <button
                    key={preset.value}
                    onClick={() => {
                      setZoom(preset.value);
                      setIsPresetOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1 text-xs flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-blue-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-4 bg-slate-700 mx-0.5" />

        {/* Fit Page Quick Button */}
        <button 
          onClick={handleFitPage}
          className="p-1.5 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Fit Page to Screen"
        >
          <Maximize className="w-4 h-4" />
        </button>

        {/* Reset 100% Button */}
        <button 
          onClick={handleZoomReset}
          className="p-1.5 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="Reset Zoom to 100%"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
