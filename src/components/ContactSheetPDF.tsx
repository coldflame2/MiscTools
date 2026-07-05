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
  const PADDING_TOP = 10;
  const PADDING_BOTTOM = 30;
  const PADDING_X = 20;
  const CONTENT_WIDTH = PAGE_WIDTH - PADDING_X * 2;
  const COLS = 5;
  const ROWS = 5;
  const GAP = 16.24; // ~2% of 812
  
  const getPdfFont = (family: string) => {
    const f = (family || '').toLowerCase();
    if (f.includes('mono') || f.includes('courier')) return 'courier';
    if (f.includes('times') || f.includes('serif')) return 'times';
    return 'helvetica';
  };

  const pdfFontFamily = getPdfFont(settings.headerFontFamily || '');
  const pdfFontWeight = settings.headerFontWeight === 'bold' || settings.headerFontWeight === '700' || settings.headerFontWeight === '900' ? 'bold' : 'normal';
  const headerColorRgb = hexToRgb(settings.headerColor || '#000000');
  const headerFontSize = settings.headerFontSize || 14;

  let headerHeight = 0;
  if (settings.headerStyle === 'minimal') headerHeight = 40;
  else if (settings.headerStyle === 'academic') headerHeight = 68;
  else if (settings.headerStyle === 'classic') headerHeight = 80;
  else if (settings.headerStyle === 'industrial') headerHeight = 75;
  else headerHeight = 50; // fallback / custom
  
  let footerSpace = settings.showFooter ? 30 : 0;
  const availableHeight = PAGE_HEIGHT - PADDING_TOP - PADDING_BOTTOM - headerHeight - footerSpace;
  const availableWidth = PAGE_WIDTH - PADDING_X * 2;
  
  const possibleCellWidth = (availableWidth - (COLS - 1) * GAP) / COLS;
  const possibleCellHeight = (availableHeight - (ROWS - 1) * GAP) / ROWS;
  
  const CELL_WIDTH = Math.min(possibleCellWidth, possibleCellHeight);
  const CELL_HEIGHT = CELL_WIDTH;
  
  // Center grid horizontally if CELL_WIDTH was constrained by height
  const gridWidth = CELL_WIDTH * COLS + GAP * (COLS - 1);
  const actualPaddingX = (PAGE_WIDTH - gridWidth) / 2;

  for (let s = 0; s < sheets.length; s++) {
    if (s > 0) doc.addPage();
    const sheet = sheets[s];
    const cleanFolderName = sheet.folderName.replace(/\s\(Part\s\d+\)$/, "");

    // Page Background
    doc.setFillColor(pageBgRgb.r, pageBgRgb.g, pageBgRgb.b);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');

    let currentY = PADDING_TOP;

    // Header
    if (settings.headerStyle === 'minimal') {
      doc.setFont(pdfFontFamily, pdfFontWeight);
      doc.setFontSize(headerFontSize);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      
      const leftTitle = cleanFolderName;
      doc.text(leftTitle, PADDING_X, currentY + 24);
      
      const rightTitle = settings.minimalRightTitle || 'Photo Research';
      doc.text(rightTitle, PAGE_WIDTH - PADDING_X, currentY + 24, { align: 'right' });

      currentY += 24 + 8;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING_X, currentY, PAGE_WIDTH - PADDING_X, currentY);
      currentY += 8;
    } else if (settings.headerStyle === 'academic') {
      doc.setFont(pdfFontFamily, pdfFontWeight);
      doc.setFontSize(headerFontSize * 1.3);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      
      const mainTitle = cleanFolderName;
      doc.text(mainTitle, PADDING_X, currentY + 18);
      
      currentY += 18 + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.text(settings.customSubtitle || 'Field Analysis & Asset Portfolio', PADDING_X, currentY + 12);
      
      // Right block (Folder name & Date)
      doc.setFont(pdfFontFamily, pdfFontWeight);
      doc.setFontSize(headerFontSize);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      doc.text(`Folder: ${cleanFolderName}`, PAGE_WIDTH - PADDING_X, currentY - 6, { align: 'right' });
      doc.text(`Date: ${settings.customDate || ''}`, PAGE_WIDTH - PADDING_X, currentY + 12, { align: 'right' });
      
      currentY += 12 + 8;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING_X, currentY, PAGE_WIDTH - PADDING_X, currentY);
      currentY += 8;
    } else if (settings.headerStyle === 'classic') {
      doc.setFont(pdfFontFamily, pdfFontWeight);
      doc.setFontSize(headerFontSize * 1.8);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      
      const mainTitle = cleanFolderName;
      doc.text(mainTitle, PAGE_WIDTH / 2, currentY + 24, { align: 'center' });
      
      currentY += 24 + 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(12);
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.text(settings.customSubtitle || 'Field Analysis & Asset Portfolio', PAGE_WIDTH / 2, currentY + 12, { align: 'center' });
      
      currentY += 12 + 4;
      doc.setFont(pdfFontFamily, 'normal');
      doc.setFontSize(headerFontSize);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      doc.text(`Folder: ${cleanFolderName} | ${settings.customDate || ''}`, PAGE_WIDTH / 2, currentY + 12, { align: 'center' });
      
      currentY += 12 + 8;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING_X, currentY - 2, PAGE_WIDTH - PADDING_X, currentY - 2);
      doc.line(PADDING_X, currentY + 1, PAGE_WIDTH - PADDING_X, currentY + 1);
      currentY += 8;
    } else if (settings.headerStyle === 'industrial') {
      doc.setFont(pdfFontFamily, pdfFontWeight);
      doc.setFontSize(headerFontSize * 2.2);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      
      const mainTitle = cleanFolderName;
      doc.text(mainTitle, PADDING_X, currentY + 30);
      
      currentY += 30 + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.text(settings.customSubtitle || 'Field Analysis & Asset Portfolio', PADDING_X, currentY + 12);
      
      // Right block Folder & Date
      doc.setFont(pdfFontFamily, pdfFontWeight);
      doc.setFontSize(headerFontSize);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      doc.text(`Folder: ${cleanFolderName} | ${settings.customDate || ''}`, PAGE_WIDTH - PADDING_X, currentY + 12, { align: 'right' });
      
      currentY += 12 + 10;
      doc.setFillColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.rect(PADDING_X, currentY, PAGE_WIDTH - PADDING_X * 2, 4, 'F');
      currentY += 8;
    } else {
      // fallback/custom
      doc.setFont(pdfFontFamily, pdfFontWeight);
      doc.setFontSize(headerFontSize);
      doc.setTextColor(headerColorRgb.r, headerColorRgb.g, headerColorRgb.b);
      doc.text(cleanFolderName, PADDING_X, currentY + 18);
      
      currentY += 18 + 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.text(settings.customSubtitle || '', PADDING_X, currentY + 12);
      
      doc.setFontSize(10);
      doc.text(`Folder: ${cleanFolderName} | ${settings.customDate || ''}`, PAGE_WIDTH - PADDING_X, currentY + 12, { align: 'right' });
      
      currentY += 12 + 8;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING_X, currentY, PAGE_WIDTH - PADDING_X, currentY);
      currentY += 8;
    }

    // Grid
    const startY = currentY;
    
    for (let i = 0; i < 25; i++) {
      const image = sheet.images[i];
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const x = actualPaddingX + col * (CELL_WIDTH + GAP);
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
        try {
          const imgObj = await getImgInfo(image.dataUrl);
          const imgRatio = imgObj.width / imgObj.height;

          // 1. Calculate the text height FIRST
          let labelHeight = 0;
          let linesToDraw: string[] = [];
          let lineHeight = 0;

          if (settings.showLabels) {
            // Set font early so splitTextToSize measures correctly
            doc.setFont('helvetica', settings.labelFontWeight === 'bold' ? 'bold' : 'normal');
            doc.setFontSize(settings.labelFontSize || 10);
            lineHeight = (settings.labelFontSize || 10) * 1.2;

            const filename = image.name.replace(/\.[^/.]+$/, "");
            linesToDraw = doc.splitTextToSize(filename, CELL_WIDTH - 8);
            
            // Allow all lines to render (removed the 3-line slice/truncation limit)
            // Calculate total label height, adding 8px for top/bottom padding
            labelHeight = (linesToDraw.length * lineHeight) + 8; 
          }

          // 2. Adjust available cell height for the image
          // Using Math.max to prevent negative heights if a filename is extremely long
          const AVAILABLE_IMG_HEIGHT = Math.max(10, CELL_HEIGHT - labelHeight);
          const cellRatio = CELL_WIDTH / AVAILABLE_IMG_HEIGHT;
          
          let drawW = CELL_WIDTH;
          let drawH = AVAILABLE_IMG_HEIGHT;
          let drawX = x;
          let drawY = y;

          // 3. Image Fit Logic (Contain)
          if (settings.imageFit === 'contain') {
            if (imgRatio > cellRatio) {
              // Image is wider than available space
              drawW = CELL_WIDTH;
              drawH = CELL_WIDTH / imgRatio;
              drawY = y + (AVAILABLE_IMG_HEIGHT - drawH) / 2;
            } else {
              // Image is taller than available space
              drawH = AVAILABLE_IMG_HEIGHT;
              drawW = AVAILABLE_IMG_HEIGHT * imgRatio;
              drawX = x + (CELL_WIDTH - drawW) / 2;
            }
          }
          
          // 4. Image Fit Logic (Cover) and Drawing
          if (settings.imageFit === 'cover') {
            doc.advancedAPI(doc => {
              // Clip to the available image area, avoiding the label space below
              doc.rect(x, y, CELL_WIDTH, AVAILABLE_IMG_HEIGHT);
              doc.clip();
              
              if (imgRatio > cellRatio) {
                drawH = AVAILABLE_IMG_HEIGHT;
                drawW = AVAILABLE_IMG_HEIGHT * imgRatio;
                drawX = x + (CELL_WIDTH - drawW) / 2;
              } else {
                drawW = CELL_WIDTH;
                drawH = CELL_WIDTH / imgRatio;
                drawY = y + (AVAILABLE_IMG_HEIGHT - drawH) / 2;
              }
              doc.addImage(image.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
            });
          } else {
            doc.addImage(image.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
          }

          // 5. Draw Labels below the image
          if (settings.showLabels && linesToDraw.length > 0) {
            let labelColorRgb = hexToRgb(settings.labelColor || '#000000');
            doc.setTextColor(labelColorRgb.r, labelColorRgb.g, labelColorRgb.b);
            
            // I removed the white background rectangle here because the entire cell 
            // is already painted with the cellBgColor earlier in your loop.
            
            // jsPDF draws text from the baseline. Start exactly below the image area, 
            // plus 4px padding, plus the height of one line.
            const textY = y + AVAILABLE_IMG_HEIGHT + 4 + (lineHeight * 0.8);
            
            doc.text(linesToDraw, x + CELL_WIDTH / 2, textY, { align: 'center' });
          }
        } catch (e) {
          console.error('Error drawing image in pdf', e);
        }
      }
    }

    // Footer
    if (settings.showFooter) {
      const footerY = PAGE_HEIGHT - PADDING_BOTTOM;
      doc.setDrawColor(borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      doc.line(PADDING_X, footerY - 10, PAGE_WIDTH - PADDING_X, footerY - 10);
      
      doc.setTextColor(textColorSecondaryRgb.r, textColorSecondaryRgb.g, textColorSecondaryRgb.b);
      doc.setFontSize(10);
      doc.text(settings.footerCustomText || '', PADDING_X, footerY);
      
      if (settings.footerShowPageNumber) {
        doc.text(`Page ${s + 1} of ${sheets.length}`, PAGE_WIDTH - PADDING_X, footerY, { align: 'right' });
      }
    }
  }

  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
};
