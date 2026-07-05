import { jsPDF } from 'jspdf';

const BACKGROUND_COLORS_HEX: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  charcoal: '#0f172a',
  transparent: '#ffffff'
};

const CELL_BACKGROUND_COLORS_HEX: Record<string, string> = {
  white: '#ffffff',
  transparent: '#ffffff',
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-800': '#1e293b',
  black: '#000000'
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
};

const getImgInfo = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

export const generatePdfBlob = async (sheets: any[], settings: any): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [864, 864]
  });

  const isDark = settings.backgroundCanvas === 'black' || settings.backgroundCanvas === 'charcoal';
  const pageBgColor = BACKGROUND_COLORS_HEX[settings.backgroundCanvas] || '#ffffff';
  const cellBgColor = CELL_BACKGROUND_COLORS_HEX[settings.cellBackgroundColor] || '#ffffff';
  
  const pageBgRgb = hexToRgb(pageBgColor);
  const cellBgRgb = hexToRgb(cellBgColor);
  
  const borderColorRgb = isDark ? hexToRgb('#1e293b') : hexToRgb('#e2e8f0');
  const textColorPrimaryRgb = isDark ? hexToRgb('#ffffff') : hexToRgb('#0f172a');
  const textColorSecondaryRgb = isDark ? hexToRgb('#94a3b8') : hexToRgb('#64748b');

  const PAGE_WIDTH = 864;
  const PAGE_HEIGHT = 864;
  const PADDING = 20;
  const CONTENT_WIDTH = PAGE_WIDTH - PADDING * 2;
  const COLS = 5;
  const ROWS = 5;
  const GAP = 16.24; // ~2% of 812
  const CELL_WIDTH = (CONTENT_WIDTH - (COLS - 1) * GAP) / COLS;
  
  let headerHeight = 0;
  if (settings.headerStyle === 'minimal') headerHeight = 40;
  else if (settings.headerStyle === 'academic') headerHeight = 68;
  else if (settings.headerStyle === 'custom') headerHeight = 50;
  
  let footerSpace = settings.showFooter ? 30 : 0;
  const availableHeight = PAGE_HEIGHT - (PADDING * 2) - headerHeight - footerSpace;
  const CELL_HEIGHT = (availableHeight - (ROWS - 1) * GAP) / ROWS;

  for (let s = 0; s < sheets.length; s++) {
    if (s > 0) doc.addPage();
    const sheet = sheets[s];
    const cleanFolderName = sheet.folderName.replace(/\s\(Part\s\d+\)$/, "");

    // Page Background
    doc.setFillColor(pageBgRgb.r, pageBgRgb.g, pageBgRgb.b);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

    let currentY = PADDING;

    // Header
    if (settings.headerStyle === 'minimal') {
      doc.setFont('arial', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(textColorPrimaryRgb.r, textColorPrimaryRgb.g, textColorPrimaryRgb.b);
      doc.text(cleanFolderName, PADDING, currentY + 24);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.text(settings.minimalRightTitle || 'PHOTO RESEARCH', PAGE_WIDTH - PADDING, currentY + 24, { align: 'right' });

      currentY += 24 + 8;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING, currentY, PAGE_WIDTH - PADDING, currentY);
      currentY += 8;
    } else if (settings.headerStyle === 'academic') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(textColorPrimaryRgb.r, textColorPrimaryRgb.g, textColorPrimaryRgb.b);
      doc.text(settings.customTitle || '', PADDING, currentY + 18);
      
      currentY += 18 + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.text(settings.customSubtitle || '', PADDING, currentY + 12);
      
      currentY += 12 + 8;
      doc.setFontSize(10);
      doc.text(`Folder: ${cleanFolderName}     Date: ${settings.customDate || ''}`, PADDING, currentY + 10);
      
      currentY += 10 + 8;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING, currentY, PAGE_WIDTH - PADDING, currentY);
      currentY += 8;
    } else if (settings.headerStyle === 'custom') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(textColorPrimaryRgb.r, textColorPrimaryRgb.g, textColorPrimaryRgb.b);
      doc.text(settings.customTitle || '', PADDING, currentY + 18);
      
      currentY += 18 + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.text(settings.customSubtitle || '', PADDING, currentY + 12);
      
      doc.setFontSize(10);
      doc.text(`Folder: ${cleanFolderName} | ${settings.customDate || ''}`, PAGE_WIDTH - PADDING, currentY + 12, { align: 'right' });
      
      currentY += 12 + 8;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING, currentY, PAGE_WIDTH - PADDING, currentY);
      currentY += 8;
    }

    // Grid
    const startY = currentY;
    
    for (let i = 0; i < 25; i++) {
      const image = sheet.images[i];
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const x = PADDING + col * (CELL_WIDTH + GAP);
      const y = startY + row * (CELL_HEIGHT + GAP);
      
      // Draw cell background
      if (isDark) {
        doc.setFillColor(255, 255, 255); // We can't do rgba easily, just use cell bg
        doc.rect(x, y, CELL_WIDTH, CELL_HEIGHT, 'F');
      } else {
        doc.setFillColor(cellBgRgb.r, cellBgRgb.g, cellBgRgb.b);
        doc.rect(x, y, CELL_WIDTH, CELL_HEIGHT, 'F');
      }
      
      if (image && image.dataUrl) {
        // We need to fetch image dimensions to properly contain/cover it
        try {
          const imgObj = await getImgInfo(image.dataUrl);
          const imgRatio = imgObj.width / imgObj.height;
          const cellRatio = CELL_WIDTH / CELL_HEIGHT;
          
          let drawW = CELL_WIDTH;
          let drawH = CELL_HEIGHT;
          let drawX = x;
          let drawY = y;

          // For 'contain', calculate dimensions
          if (settings.imageFit === 'contain') {
            if (imgRatio > cellRatio) {
              // Image is wider
              drawW = CELL_WIDTH;
              drawH = CELL_WIDTH / imgRatio;
              drawY = y + (CELL_HEIGHT - drawH) / 2;
            } else {
              // Image is taller
              drawH = CELL_HEIGHT;
              drawW = CELL_HEIGHT * imgRatio;
              drawX = x + (CELL_WIDTH - drawW) / 2;
            }
          }
          
          // Note: for 'cover' in jsPDF we'd need clipping paths, which are tricky. 
          // For simplicity, we just use contain-like math for cover too, or we can use clipping!
          if (settings.imageFit === 'cover') {
            doc.advancedAPI(doc => {
              doc.rect(x, y, CELL_WIDTH, CELL_HEIGHT);
              doc.clip();
              
              if (imgRatio > cellRatio) {
                drawH = CELL_HEIGHT;
                drawW = CELL_HEIGHT * imgRatio;
                drawX = x + (CELL_WIDTH - drawW) / 2;
              } else {
                drawW = CELL_WIDTH;
                drawH = CELL_WIDTH / imgRatio;
                drawY = y + (CELL_HEIGHT - drawH) / 2;
              }
              doc.addImage(image.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
            });
          } else {
            doc.addImage(image.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
          }

          if (settings.showLabels) {
            let labelColorRgb = hexToRgb(settings.labelColor || '#000000');
            doc.setTextColor(labelColorRgb.r, labelColorRgb.g, labelColorRgb.b);
            doc.setFont('helvetica', settings.labelFontWeight === 'bold' ? 'bold' : 'normal');
            doc.setFontSize(settings.labelFontSize || 10);
            
            const filename = image.name.replace(/\.[^/.]+$/, "");
            const textLines = doc.splitTextToSize(filename, CELL_WIDTH - 8);
            
            // Limit to 2 lines for aesthetics (like earlier)
            const linesToDraw = textLines.slice(0, 2);
            if (textLines.length > 2) {
                linesToDraw[1] = linesToDraw[1].substring(0, Math.max(0, linesToDraw[1].length - 3)) + '...';
            }
            
            const lineHeight = (settings.labelFontSize || 10) * 1.2;
            // Draw background for text to make it readable? No, react-pdf didn't have bg.
            const textY = y + CELL_HEIGHT - (linesToDraw.length * lineHeight) + (lineHeight * 0.8);
            
            // Background for text (semi-transparent white?)
            doc.setFillColor(255, 255, 255);
            doc.rect(x, textY - lineHeight * 0.8, CELL_WIDTH, linesToDraw.length * lineHeight + 4, 'F');
            
            doc.text(linesToDraw, x + CELL_WIDTH / 2, textY, { align: 'center' });
          }
        } catch (e) {
          console.error('Error drawing image in pdf', e);
        }
      }
    }

    // Footer
    if (settings.showFooter) {
      const footerY = PAGE_HEIGHT - PADDING - 10;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING, footerY - 10, PAGE_WIDTH - PADDING, footerY - 10);
      
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.setFontSize(10);
      doc.text(settings.footerCustomText || '', PADDING, footerY);
      
      if (settings.footerShowPageNumber) {
        doc.text(`Page ${s + 1} of ${sheets.length}`, PAGE_WIDTH - PADDING, footerY, { align: 'right' });
      }
    }
  }

  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
};
