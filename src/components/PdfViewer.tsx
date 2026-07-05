import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

// Try to set workerSrc
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  pageNumber: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, pageNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let renderTask: any = null;
    setError(null);

    const renderPage = async () => {
      if (!url || !canvasRef.current) return;
      
      try {
        // Fetch the blob URL on the main thread to get the ArrayBuffer
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        if (!active) return;

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        if (!active) return;
        
        // Ensure pageNumber is within range
        const validPageNum = Math.min(Math.max(1, pageNumber), pdf.numPages);
        const page = await pdf.getPage(validPageNum);
        if (!active) return;
        
        // Render at a high resolution once, then we scale via CSS for zoom
        const scale = 3.0; // Render at 3x for crispness on zoom
        const viewport = page.getViewport({ scale });
        
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
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') {
            // expected
            return;
        }
        console.error('Error rendering PDF:', err);
        if (active) setError(String(err));
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

  if (error) {
    return <div className="text-red-500 flex items-center justify-center h-full">Error rendering PDF: {error}</div>;
  }

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-200">
      <div 
        ref={containerRef}
        className="flex-grow overflow-auto grid place-items-center"
      >
        <div 
          className="relative transition-all duration-200 origin-center flex items-center justify-center"
          style={{ 
            width: zoom <= 1 ? '100%' : `${100 * zoom}%`,
            height: zoom <= 1 ? '100%' : `${100 * zoom}%`,
          }}
        >
          <canvas 
            ref={canvasRef} 
            className="shadow-xl bg-white pl-0 pr-0 pt-0 mt-[10px] ml-[5px] mr-[5px] mb-[10px] w-[800px]" 
            style={{ 
              width: '800px',
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain' 
            }} 
          />
        </div>
      </div>
      
      {/* Zoom Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg border border-slate-200 z-10">
        <button 
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-600 disabled:opacity-50 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-slate-600 w-12 text-center select-none font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button 
          onClick={handleZoomIn}
          disabled={zoom >= 4}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-600 disabled:opacity-50 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <button 
          onClick={handleZoomReset}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
          title="Fit to Screen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
