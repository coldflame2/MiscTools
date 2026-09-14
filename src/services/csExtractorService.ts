import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is configured
// @ts-ignore
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // @ts-ignore
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.mjs';
}

export interface ExtractedComment {
  id: string;
  pageNum: number;
  content: string;
  author?: string;
  rect?: number[];
  subtype?: string;
  date?: string;
}

export interface DetectedPdfImage {
  index: number;
  imgKey?: string;
  pdfRect: number[]; // [minX, minY, maxX, maxY]
  viewportRect: { x: number; y: number; width: number; height: number };
}

export interface ExtractedImageInfo {
  fileName: string; // e.g. "P035. VIBE3_WS_G_4_2c_iStock_633240466.jpg"
  pageNum: number;
  dataUrl: string;
  blob?: Blob;
  width: number;
  height: number;
  cropSource: 'pdf_paint_object' | 'pdf_comment_region' | 'synthesized_sample';
  box?: { x: number; y: number; width: number; height: number };
  rawImageFound?: boolean;
}

export interface PageCandidateOption {
  text: string;
  x: number;
  y: number;
  vendor?: string;
}

export interface RawPageData {
  pageNum: number;
  detectedAssetCode?: string;
  rawHeader?: string;
  comments: ExtractedComment[];
  candidateOptions: PageCandidateOption[];
  detectedImages: DetectedPdfImage[];
  allPageText: string[];
}

export interface AssetRecord {
  id: string;
  assetCode: string;
  pages: number[];
  pageDisplay: string;
  selectedPageNum: number;
  selectedImage: string;
  status: 'Selected' | 'Missing Selection' | 'Multiple Selections';
  comments: ExtractedComment[];
  candidateOptions: string[];
  vendor?: string;
  userEdited?: boolean;
  notes?: string;
  extractedImage?: ExtractedImageInfo;
}

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  phase: 'loading' | 'parsing' | 'grouping' | 'completed' | 'error';
  statusMessage: string;
}

export interface ExtractionResult {
  assets: AssetRecord[];
  totalPages: number;
  rawPages: RawPageData[];
  pdfDocument?: any;
  summary: {
    totalPages: number;
    totalAssets: number;
    totalSelected: number;
    totalMissing: number;
    totalMultiPage: number;
  };
}

export interface ExtractionOptions {
  assetPrefix?: string; // Default: 'VIBE'
  customRegex?: string;
  autoDetectContinuation?: boolean; // If page has no asset code, inherit from previous
  onProgress?: (progress: ExtractionProgress) => void;
}

export interface NamingOptions {
  presetId?: string;
  pattern: string; // e.g. "P{page3}. {asset_code}_{selected_image}"
  caseTransform: 'as-is' | 'uppercase' | 'lowercase';
  spaceHandling: 'preserve' | 'underscore' | 'hyphen' | 'remove';
  extension: 'jpg' | 'png';
  customPrefix?: string;
  customSuffix?: string;
}

export interface NamingPreset {
  id: string;
  name: string;
  pattern: string;
  description: string;
  example: string;
}

export const NAMING_PRESETS: NamingPreset[] = [
  {
    id: 'standard_page_code_image',
    name: 'Standard Contact Sheet (P001. Code_Image)',
    pattern: 'P{page3}. {asset_code}_{selected_image}',
    description: 'Includes 3-digit page prefix, asset code, and candidate image name',
    example: 'P035. VIBE3_WS_G_4_2c_iStock_633240466.jpg'
  },
  {
    id: 'code_and_image',
    name: 'Asset Code + Image Name',
    pattern: '{asset_code}_{selected_image}',
    description: 'Clean publisher pairing without page prefix',
    example: 'VIBE3_WS_G_4_2c_iStock_633240466.jpg'
  },
  {
    id: 'asset_code_only',
    name: 'Asset Code Only',
    pattern: '{asset_code}',
    description: 'Direct 1-to-1 match with asset identifier for layout replacement',
    example: 'VIBE3_WS_G_4_2c.jpg'
  },
  {
    id: 'page_and_code',
    name: 'Page Prefix + Asset Code',
    pattern: 'P{page3}_{asset_code}',
    description: 'Sortable by PDF page sequence followed by code',
    example: 'P035_VIBE3_WS_G_4_2c.jpg'
  },
  {
    id: 'vendor_code_image',
    name: 'Vendor + Asset Code + Image',
    pattern: '{vendor}_{asset_code}_{selected_image}',
    description: 'Includes stock photo agency/vendor at the start',
    example: 'iStock_VIBE3_WS_G_4_2c_iStock_633240466.jpg'
  },
  {
    id: 'page_word_and_image',
    name: 'Page Word + Image Name',
    pattern: 'Page_{page}_{selected_image}',
    description: 'Includes literal page word and original image filename',
    example: 'Page_35_iStock_633240466.jpg'
  },
  {
    id: 'original_image_only',
    name: 'Original Research Image Name',
    pattern: '{selected_image}',
    description: 'Preserves the exact stock photo filename as noted in the PDF',
    example: 'iStock_633240466.jpg'
  },
  {
    id: 'sequential_and_code',
    name: 'Sequential Index + Asset Code',
    pattern: '{index3}_{asset_code}',
    description: 'Numbered sequentially from 001 to total assets',
    example: '001_VIBE3_WS_G_1_1a.jpg'
  },
  {
    id: 'bms_art_standard',
    name: 'BMS Art Asset Format',
    pattern: '{asset_code}-art',
    description: 'Publishing production standard format with -art suffix',
    example: 'VIBE3_WS_G_4_2c-art.jpg'
  }
];

export const DEFAULT_NAMING_OPTIONS: NamingOptions = {
  presetId: 'standard_page_code_image',
  pattern: 'P{page3}. {asset_code}_{selected_image}',
  caseTransform: 'as-is',
  spaceHandling: 'preserve',
  extension: 'jpg',
  customPrefix: '',
  customSuffix: ''
};

/**
 * Clean and normalize comment text or image caption to extract the filename.
 */
export function cleanImageFileName(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Remove surrounding quotes
  cleaned = cleaned.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();

  // Remove common prefix markers like "Use:", "Selected:", "Option:", "File:", etc.
  cleaned = cleaned.replace(/^(?:selected|use this|use|approved|choice|option\s*\d*:?|file:?|image:?)\s*[:=-]?\s*/i, '').trim();

  // If there are multiple lines, take the line that looks like a filename (or the first non-empty)
  const lines = cleaned.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const filenameLine = lines.find(l => 
      /(?:\.jpg|\.jpeg|\.png|\.tif|\.tiff|\.eps|shutterstock|getty|alamy|istock|goby)/i.test(l)
    );
    if (filenameLine) {
      cleaned = filenameLine;
    } else {
      cleaned = lines[0];
    }
  }

  // Remove ellipsis if at the end but preserve filename stem
  cleaned = cleaned.replace(/\.{3,}$/, '').trim();

  return cleaned;
}

/**
 * Formats extracted image filename according to custom naming rules and pattern tokens.
 */
export function formatCustomImageFileName(
  asset: {
    assetCode: string;
    selectedImage: string;
    selectedPageNum?: number;
    pages?: number[];
    vendor?: string;
  },
  index: number = 0,
  options: Partial<NamingOptions> = {}
): string {
  const merged: NamingOptions = { ...DEFAULT_NAMING_OPTIONS, ...options };
  const pattern = (merged.pattern || DEFAULT_NAMING_OPTIONS.pattern).trim();

  const pageNum = asset.selectedPageNum || (asset.pages && asset.pages[0]) || 1;
  const page3 = String(pageNum).padStart(3, '0');
  const pageRaw = String(pageNum);

  const cleanAsset = (asset.assetCode || 'Asset').trim().replace(/[/\\?%*:|"<>]/g, '_');

  let cleanImg = (asset.selectedImage || 'selected_image').trim().replace(/[/\\?%*:|"<>]/g, '_');
  cleanImg = cleanImg.replace(/\.(jpg|jpeg|png|webp|tif|tiff|eps)$/i, '');

  const vendorClean = (asset.vendor || 'Vendor').trim().replace(/[/\\?%*:|"<>]/g, '_');
  const indexRaw = String(index + 1);
  const index3 = String(index + 1).padStart(3, '0');
  const today = new Date().toISOString().split('T')[0];

  let formatted = pattern
    .replace(/\{page3\}/gi, page3)
    .replace(/\{page\}/gi, pageRaw)
    .replace(/\{pageNum\}/gi, pageRaw)
    .replace(/\{asset_code\}/gi, cleanAsset)
    .replace(/\{code\}/gi, cleanAsset)
    .replace(/\{selected_image\}/gi, cleanImg)
    .replace(/\{image\}/gi, cleanImg)
    .replace(/\{vendor\}/gi, vendorClean)
    .replace(/\{index3\}/gi, index3)
    .replace(/\{index\}/gi, indexRaw)
    .replace(/\{date\}/gi, today);

  // Apply Prefix and Suffix
  if (merged.customPrefix) {
    formatted = `${merged.customPrefix.trim()}${formatted}`;
  }
  if (merged.customSuffix) {
    formatted = `${formatted}${merged.customSuffix.trim()}`;
  }

  // Handle Spaces
  if (merged.spaceHandling === 'underscore') {
    formatted = formatted.replace(/\s+/g, '_');
  } else if (merged.spaceHandling === 'hyphen') {
    formatted = formatted.replace(/\s+/g, '-');
  } else if (merged.spaceHandling === 'remove') {
    formatted = formatted.replace(/\s+/g, '');
  }

  // Handle Case Transformation
  if (merged.caseTransform === 'uppercase') {
    formatted = formatted.toUpperCase();
  } else if (merged.caseTransform === 'lowercase') {
    formatted = formatted.toLowerCase();
  }

  // Sanitize illegal OS filename characters
  formatted = formatted.replace(/[/\\?%*:|"<>]/g, '_');

  const ext = (merged.extension || 'jpg').toLowerCase().replace(/^\./, '');
  return `${formatted}.${ext}`;
}

/**
 * Formats extracted image filename according to standard convention (backwards compatible):
 * "P001. {asset_code}_{selected image}"
 * e.g., "P035. VIBE3_WS_G_4_2c_iStock_633240466.jpg"
 */
export function formatExtractedImageFileName(
  pageNum: number,
  assetCode: string,
  selectedImage: string,
  extension: string = 'jpg'
): string {
  return formatCustomImageFileName(
    { assetCode, selectedImage, selectedPageNum: pageNum },
    0,
    { pattern: 'P{page3}. {asset_code}_{selected_image}', extension: extension as any }
  );
}

/**
 * Matrix multiplication helper for 2D affine transformations [a, b, c, d, e, f]
 */
function multiplyTransformMatrix(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

/**
 * Detect image vendor from filename or text
 */
export function detectVendor(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('shutterstock')) return 'Shutterstock';
  if (lower.includes('getty')) return 'Getty Images';
  if (lower.includes('alamy')) return 'Alamy';
  if (lower.includes('istock')) return 'iStock';
  if (lower.includes('goby')) return 'GOBY / Shutterstock';
  if (lower.includes('adobe')) return 'Adobe Stock';
  if (lower.includes('dreamstime')) return 'Dreamstime';
  if (lower.includes('depositphotos')) return 'Depositphotos';
  if (lower.includes('123rf')) return '123RF';
  return 'Direct / Agency';
}

/**
 * Parses a Contact Sheet PDF and extracts asset codes and selected images.
 */
export async function extractContactSheetPdf(
  fileOrBuffer: File | Blob | ArrayBuffer | Uint8Array | any,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const {
    assetPrefix = 'VIBE',
    customRegex,
    autoDetectContinuation = true,
    onProgress
  } = options;

  let pdf: any;
  // If caller already passed an initialized pdfjs PDFDocumentProxy
  if (fileOrBuffer && typeof fileOrBuffer.numPages === 'number' && typeof fileOrBuffer.getPage === 'function') {
    pdf = fileOrBuffer;
  } else {
    onProgress?.({
      currentPage: 0,
      totalPages: 0,
      phase: 'loading',
      statusMessage: 'Loading PDF document into memory...'
    });

    let data: Uint8Array;
    if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
      const buf = await fileOrBuffer.arrayBuffer();
      // Slice buffer copy to prevent detached buffer errors
      data = new Uint8Array(buf.slice(0));
    } else if (fileOrBuffer instanceof Uint8Array) {
      if (fileOrBuffer.buffer.byteLength === 0) {
        throw new Error('Provided Uint8Array buffer is detached.');
      }
      data = new Uint8Array(fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength));
    } else if (fileOrBuffer instanceof ArrayBuffer) {
      if (fileOrBuffer.byteLength === 0) {
        throw new Error('Provided ArrayBuffer is detached.');
      }
      data = new Uint8Array(fileOrBuffer.slice(0));
    } else {
      throw new Error('Invalid input for PDF extraction. Expected File, Blob, Uint8Array, or ArrayBuffer.');
    }

    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
    });
    pdf = await loadingTask.promise;
  }

  const totalPages = pdf.numPages;

  const rawPages: RawPageData[] = [];
  const prefixRegex = customRegex 
    ? new RegExp(customRegex, 'i') 
    : new RegExp(`\\b(${assetPrefix}[A-Za-z0-9_.-]+)`, 'i');

  // Process page by page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.({
      currentPage: pageNum,
      totalPages,
      phase: 'parsing',
      statusMessage: `Scanning page ${pageNum} of ${totalPages} for header & comments...`
    });

    const page = await pdf.getPage(pageNum);

    try {
      const viewport = page.getViewport({ scale: 1.0 });
      const pageHeight = viewport.height;
      const pageWidth = viewport.width;

      // 1. Extract text content with positions
      const textContent = await page.getTextContent();
      const rawTextItems: { str: string; x: number; y: number; width: number; height: number }[] = [];

      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const str = item.str.trim();
          if (str) {
            const transform = item.transform; // [scaleX, skewY, skewX, scaleY, x, y]
            rawTextItems.push({
              str,
              x: transform[4],
              y: transform[5],
              width: item.width || 0,
              height: item.height || 0,
            });
          }
        }
      }

      // Identify Header & Asset Code
      // In PDF coordinates, (0,0) is bottom-left, so header is at high Y (e.g., top 30% of page)
      const topCutoffY = pageHeight * 0.70;
      const headerItems = rawTextItems.filter(it => it.y >= topCutoffY);

      // Sort top items top-to-bottom, left-to-right
      headerItems.sort((a, b) => b.y - a.y || a.x - b.x);

      let detectedAssetCode: string | undefined;
      let rawHeader: string | undefined;

      // Try finding asset code via prefix regex in all text items, prioritizing header
      for (const item of headerItems) {
        const match = item.str.match(prefixRegex);
        if (match) {
          detectedAssetCode = match[1] || match[0];
          rawHeader = item.str;
          break;
        }
      }

      // If not in headerItems, check all text on page for the asset prefix
      if (!detectedAssetCode) {
        for (const item of rawTextItems) {
          const match = item.str.match(prefixRegex);
          if (match) {
            detectedAssetCode = match[1] || match[0];
            rawHeader = item.str;
            break;
          }
        }
      }

      // If still no asset code with prefix, check if there is a distinct top-left token before "Photo research"
      if (!detectedAssetCode && headerItems.length > 0) {
        const candidateHeader = headerItems.find(it => 
          it.x < pageWidth * 0.5 && 
          !/photo\s*research/i.test(it.str) &&
          !/^page\s*\d+/i.test(it.str) &&
          it.str.length > 3
        );
        if (candidateHeader) {
          rawHeader = candidateHeader.str;
          // Only use as asset code if it looks like an ID / code (e.g. contains numbers/underscores)
          if (/[0-9_-]/.test(candidateHeader.str)) {
            detectedAssetCode = candidateHeader.str;
          }
        }
      }

      // 2. Extract annotations (Comments, Sticky notes, FreeText, Popups)
      const annotations = await page.getAnnotations();
      const comments: ExtractedComment[] = [];
      const seenComments = new Set<string>();

      for (const annot of annotations) {
        // Skip invisible or widget annotations
        if (annot.subtype === 'Link' || annot.subtype === 'Widget') continue;

        // Contents can be on contents, contentsObj.str, richText, etc.
        let textContentStr = '';
        if (typeof annot.contents === 'string' && annot.contents.trim()) {
          textContentStr = annot.contents.trim();
        } else if (annot.contentsObj && typeof annot.contentsObj.str === 'string') {
          textContentStr = annot.contentsObj.str.trim();
        }

        // Avoid popup duplicates if the content and author match a Text annotation already recorded
        const commentKey = `${textContentStr}_${annot.author || ''}_${annot.rect ? Math.round(annot.rect[0]) : ''}`;
        if (textContentStr && !seenComments.has(commentKey)) {
          seenComments.add(commentKey);
          comments.push({
            id: annot.id || `annot-${pageNum}-${comments.length + 1}`,
            content: textContentStr,
            author: annot.titleObj?.str || annot.title || undefined,
            rect: annot.rect,
            subtype: annot.subtype,
            date: annot.modificationDate || undefined
          });
        }
      }

      // 3. Extract candidate image options / captions on this page
      const candidateOptions: PageCandidateOption[] = [];
      for (const item of rawTextItems) {
        // Skip header and labels
        if (/photo\s*research/i.test(item.str)) continue;
        if (detectedAssetCode && item.str.includes(detectedAssetCode)) continue;
        if (/^page\s*\d+/i.test(item.str)) continue;

        // Check if string looks like an image file name or stock agency asset
        const isImageCandidate = (
          /(?:\.jpg|\.jpeg|\.png|\.tif|\.tiff|\.eps)/i.test(item.str) ||
          /(?:shutterstock|getty|alamy|istock|goby|depositphotos|dreamstime)/i.test(item.str) ||
          /(?:redownload|stock_|_id\d+)/i.test(item.str)
        );

        if (isImageCandidate) {
          candidateOptions.push({
            text: cleanImageFileName(item.str),
            x: item.x,
            y: item.y,
            vendor: detectVendor(item.str)
          });
        }
      }

      // 4. Extract detected image operators on this page (to correlate thumbnail positions)
      const detectedImages: DetectedPdfImage[] = [];
      try {
        const opList = await page.getOperatorList();
        const matrixStack: number[][] = [];
        let currentMatrix = [1, 0, 0, 1, 0, 0];

        for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
          const fn = opList.fnArray[opIdx];
          const args = opList.argsArray[opIdx];

          if (fn === pdfjsLib.OPS.save) {
            matrixStack.push([...currentMatrix]);
          } else if (fn === pdfjsLib.OPS.restore) {
            if (matrixStack.length > 0) currentMatrix = matrixStack.pop()!;
          } else if (fn === pdfjsLib.OPS.transform) {
            currentMatrix = multiplyTransformMatrix(currentMatrix, args);
          } else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
            const p0 = [currentMatrix[4], currentMatrix[5]];
            const p1 = [currentMatrix[0] + currentMatrix[4], currentMatrix[1] + currentMatrix[5]];
            const p2 = [currentMatrix[0] + currentMatrix[2] + currentMatrix[4], currentMatrix[1] + currentMatrix[3] + currentMatrix[5]];
            const p3 = [currentMatrix[2] + currentMatrix[4], currentMatrix[3] + currentMatrix[5]];

            const xs = [p0[0], p1[0], p2[0], p3[0]];
            const ys = [p0[1], p1[1], p2[1], p3[1]];
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const wPt = maxX - minX;
            const hPt = maxY - minY;
            if (wPt > 40 && hPt > 40 && (wPt < pageWidth * 0.95 || hPt < pageHeight * 0.95)) {
              const vpRect = viewport.convertToViewportRectangle([minX, minY, maxX, maxY]);
              const vx = Math.min(vpRect[0], vpRect[2]);
              const vy = Math.min(vpRect[1], vpRect[3]);
              const vw = Math.abs(vpRect[2] - vpRect[0]);
              const vh = Math.abs(vpRect[3] - vpRect[1]);

              detectedImages.push({
                index: detectedImages.length,
                imgKey: args ? args[0] : undefined,
                pdfRect: [minX, minY, maxX, maxY],
                viewportRect: { x: vx, y: vy, width: vw, height: vh }
              });
            }
          }
        }
      } catch (opErr) {
        // Non-fatal if operator list cannot be parsed
      }

      rawPages.push({
        pageNum,
        detectedAssetCode,
        rawHeader,
        comments,
        candidateOptions,
        detectedImages,
        allPageText: rawTextItems.map(t => t.str)
      });
    } finally {
      page.cleanup();
    }
  }

  onProgress?.({
    currentPage: totalPages,
    totalPages,
    phase: 'grouping',
    statusMessage: 'Correlating pages, asset codes, and selected images...'
  });

  // Handle multi-page assets & continuation:
  // Group consecutive pages that share the same asset code or where continuation inherits code
  const assetGroups: {
    assetCode: string;
    pages: number[];
    comments: ExtractedComment[];
    candidateOptions: string[];
  }[] = [];

  let currentAsset: {
    assetCode: string;
    pages: number[];
    comments: ExtractedComment[];
    candidateOptions: string[];
  } | null = null;

  for (let i = 0; i < rawPages.length; i++) {
    const pageData = rawPages[i];
    let pageCode = pageData.detectedAssetCode;

    // Check if this page is continuation of previous
    if (!pageCode && autoDetectContinuation && currentAsset) {
      pageCode = currentAsset.assetCode;
    }

    // Fallback if still no asset code: assign an Unknown / Page reference
    if (!pageCode) {
      pageCode = `Asset_Page_${pageData.pageNum}`;
    }

    // Check if we can merge with current active asset group (same code)
    if (currentAsset && currentAsset.assetCode === pageCode) {
      currentAsset.pages.push(pageData.pageNum);
      currentAsset.comments.push(...pageData.comments);
      for (const opt of pageData.candidateOptions) {
        if (!currentAsset.candidateOptions.includes(opt.text)) {
          currentAsset.candidateOptions.push(opt.text);
        }
      }
    } else {
      // If code already appeared earlier (e.g. non-consecutive or new group)
      const existingGroup = assetGroups.find(g => g.assetCode === pageCode);
      if (existingGroup) {
        existingGroup.pages.push(pageData.pageNum);
        existingGroup.comments.push(...pageData.comments);
        for (const opt of pageData.candidateOptions) {
          if (!existingGroup.candidateOptions.includes(opt.text)) {
            existingGroup.candidateOptions.push(opt.text);
          }
        }
        currentAsset = existingGroup;
      } else {
        const newGroup = {
          assetCode: pageCode,
          pages: [pageData.pageNum],
          comments: [...pageData.comments],
          candidateOptions: pageData.candidateOptions.map(o => o.text)
        };
        assetGroups.push(newGroup);
        currentAsset = newGroup;
      }
    }
  }

  // Build final AssetRecord list
  const assets: AssetRecord[] = assetGroups.map((group, idx) => {
    // Determine selected image
    let selectedImage = '';
    let status: AssetRecord['status'] = 'Missing Selection';
    let winningComment: ExtractedComment | undefined;

    if (group.comments.length === 1) {
      winningComment = group.comments[0];
      selectedImage = cleanImageFileName(winningComment.content);
      status = 'Selected';
    } else if (group.comments.length > 1) {
      // Check if one matches candidate options directly
      const matching = group.comments.find(c => 
        group.candidateOptions.some(opt => opt.toLowerCase().includes(c.content.toLowerCase()) || c.content.toLowerCase().includes(opt.toLowerCase()))
      );
      if (matching) {
        winningComment = matching;
        selectedImage = cleanImageFileName(matching.content);
        status = 'Selected';
      } else {
        winningComment = group.comments[0];
        selectedImage = cleanImageFileName(group.comments[0].content);
        status = 'Multiple Selections';
      }
    }

    // If selectedImage is set, try matching with candidate options to get fullest filename
    if (selectedImage && group.candidateOptions.length > 0) {
      const bestCandidate = group.candidateOptions.find(opt => 
        opt.toLowerCase().includes(selectedImage.toLowerCase()) || 
        selectedImage.toLowerCase().includes(opt.toLowerCase())
      );
      if (bestCandidate && bestCandidate.length > selectedImage.length) {
        selectedImage = bestCandidate;
      }
    }

    // Determine the exact page of the selection
    const selectedPageNum = winningComment?.pageNum || group.pages[0] || 1;

    // Page range display: e.g. "1" or "1-2" or "1, 3"
    let pageDisplay = '';
    if (group.pages.length === 1) {
      pageDisplay = `${group.pages[0]}`;
    } else {
      const isSequential = group.pages.every((p, i, arr) => i === 0 || p === arr[i - 1] + 1);
      if (isSequential) {
        pageDisplay = `${group.pages[0]}–${group.pages[group.pages.length - 1]}`;
      } else {
        pageDisplay = group.pages.join(', ');
      }
    }

    return {
      id: `asset-${idx + 1}-${group.assetCode}`,
      assetCode: group.assetCode,
      pages: group.pages,
      pageDisplay,
      selectedPageNum,
      selectedImage,
      status,
      comments: group.comments,
      candidateOptions: group.candidateOptions,
      vendor: selectedImage ? detectVendor(selectedImage) : undefined
    };
  });

  const totalAssets = assets.length;
  const totalSelected = assets.filter(a => a.status === 'Selected' || a.status === 'Multiple Selections').length;
  const totalMissing = assets.filter(a => a.status === 'Missing Selection').length;
  const totalMultiPage = assets.filter(a => a.pages.length > 1).length;

  onProgress?.({
    currentPage: totalPages,
    totalPages,
    phase: 'completed',
    statusMessage: `Successfully extracted ${totalAssets} assets (${totalSelected} selected, ${totalMissing} missing).`
  });

  return {
    assets,
    totalPages,
    rawPages,
    pdfDocument: pdf,
    summary: {
      totalPages,
      totalAssets,
      totalSelected,
      totalMissing,
      totalMultiPage
    }
  };
}

/**
 * Convert base64 data URL to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(parts[1]);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8[i] = bin.charCodeAt(i);
  }
  return new Blob([u8], { type: mime });
}

/**
 * Generates an individual synthesized sample image with metadata stamp
 * named strictly as "P001. {asset_code}_{selected image}".
 */
export function generateSynthesizedSampleImage(
  pageNum: number,
  assetCode: string,
  selectedImage: string,
  vendor?: string
): ExtractedImageInfo {
  const fileName = formatExtractedImageFileName(pageNum, assetCode, selectedImage, 'jpg');
  const width = 720;
  const height = 480;

  if (typeof document === 'undefined') {
    return {
      fileName,
      pageNum,
      dataUrl: '',
      width,
      height,
      cropSource: 'synthesized_sample'
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Thematic background palette
  const v = (vendor || '').toLowerCase();
  let g1 = '#1e293b';
  let g2 = '#0f172a';
  let accent = '#3b82f6';

  if (v.includes('shutterstock') || v.includes('goby')) {
    g1 = '#1e3a8a';
    g2 = '#172554';
    accent = '#e11d48';
  } else if (v.includes('istock')) {
    g1 = '#14532d';
    g2 = '#052e16';
    accent = '#10b981';
  } else if (v.includes('getty')) {
    g1 = '#581c87';
    g2 = '#3b0764';
    accent = '#a855f7';
  } else if (v.includes('alamy')) {
    g1 = '#7c2d12';
    g2 = '#431407';
    accent = '#ea580c';
  }

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, g1);
  grad.addColorStop(1, g2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Photographic geometric composition
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.arc(width * 0.75, height * 0.35, 140, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.72);
  ctx.lineTo(width * 0.32, height * 0.44);
  ctx.lineTo(width * 0.65, height * 0.62);
  ctx.lineTo(width, height * 0.38);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Subtle contact sheet grid watermark
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 40; y < height; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Top Left Header: Asset Code & Page Pill
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(24, 24, 280, 48, 8);
  } else {
    ctx.rect(24, 24, 280, 48);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
  ctx.fillText(assetCode, 38, 54);

  // Page pill
  ctx.fillStyle = accent;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(230, 32, 62, 32, 6);
  } else {
    ctx.rect(230, 32, 62, 32);
  }
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`P.${pageNum}`, 261, 52);
  ctx.textAlign = 'left';
  ctx.restore();

  // Top Right: Approved Selection Seal
  ctx.save();
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(width - 200, 24, 176, 44, 22);
  } else {
    ctx.rect(width - 200, 24, 176, 44);
  }
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('✓ APPROVED SELECTION', width - 188, 51);
  ctx.restore();

  // Center: Vendor Watermark
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(vendor || 'STOCK PHOTO RESEARCH', width / 2, height / 2 + 10);
  ctx.restore();

  // Bottom Card Bar: Filename & Metadata
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(0, height - 90, width, 90);
  ctx.fillStyle = accent;
  ctx.fillRect(0, height - 90, width, 3);

  // Selected Image
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('SELECTED RESEARCH CANDIDATE', 28, height - 58);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px monospace, system-ui';
  ctx.fillText(selectedImage, 28, height - 34);

  // Target Extracted Filename on right
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('EXTRACTED FILE NAME', width - 28, height - 58);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(fileName, width - 28, height - 34);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const blob = dataUrlToBlob(dataUrl);

  return {
    fileName,
    pageNum,
    dataUrl,
    blob,
    width,
    height,
    cropSource: 'synthesized_sample'
  };
}

/**
 * Clips the selected image section from a real PDF page canvas.
 */
export async function renderAndClipSelectedImage(
  pdfDoc: any,
  asset: AssetRecord,
  rawPages: RawPageData[],
  options: {
    cropMode?: 'tight' | 'with_caption' | 'expanded';
    scale?: number;
  } = {}
): Promise<ExtractedImageInfo> {
  const { cropMode = 'tight', scale = 2.0 } = options;
  const pageNum = asset.selectedPageNum || asset.pages[0] || 1;
  const fileName = formatExtractedImageFileName(pageNum, asset.assetCode, asset.selectedImage, 'jpg');

  if (!pdfDoc) {
    return generateSynthesizedSampleImage(pageNum, asset.assetCode, asset.selectedImage, asset.vendor);
  }

  const page = await pdfDoc.getPage(pageNum);

  try {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const pageData = rawPages.find(p => p.pageNum === pageNum);

    // Identify comment position
    const comment = asset.comments.find(c => c.pageNum === pageNum) || asset.comments[0];
    let commentCenter: { x: number; y: number } | null = null;
    if (comment?.rect) {
      const annotVp = viewport.convertToViewportRectangle(comment.rect);
      commentCenter = {
        x: (annotVp[0] + annotVp[2]) / 2,
        y: (annotVp[1] + annotVp[3]) / 2
      };
    }

    // Identify caption position
    const opt = pageData?.candidateOptions.find(o =>
      o.text.toLowerCase() === asset.selectedImage.toLowerCase() ||
      asset.selectedImage.toLowerCase().includes(o.text.toLowerCase())
    );
    let captionVp: [number, number] | null = null;
    if (opt) {
      captionVp = viewport.convertToViewportPoint(opt.x, opt.y);
    }

    // Determine candidate image rectangle
    let cropBox: { x: number; y: number; width: number; height: number } | null = null;

    if (pageData?.detectedImages && pageData.detectedImages.length > 0) {
      // 1. Try finding image containing or near comment center
      if (commentCenter) {
        const match = pageData.detectedImages.find(img => {
          const bx = img.viewportRect.x * scale;
          const by = img.viewportRect.y * scale;
          const bw = img.viewportRect.width * scale;
          const bh = img.viewportRect.height * scale;
          return commentCenter!.x >= bx - 30 && commentCenter!.x <= bx + bw + 30 &&
                 commentCenter!.y >= by - 30 && commentCenter!.y <= by + bh + 30;
        });

        if (match) {
          cropBox = {
            x: match.viewportRect.x * scale,
            y: match.viewportRect.y * scale,
            width: match.viewportRect.width * scale,
            height: match.viewportRect.height * scale
          };
        }
      }

      // 2. Try finding image above caption
      if (!cropBox && captionVp) {
        const capX = captionVp[0];
        const capY = captionVp[1];
        const match = pageData.detectedImages.find(img => {
          const bx = img.viewportRect.x * scale;
          const by = img.viewportRect.y * scale;
          const bw = img.viewportRect.width * scale;
          const bh = img.viewportRect.height * scale;
          const imgCenter = bx + bw / 2;
          const imgBottom = by + bh;
          return Math.abs(imgCenter - capX) < 100 * scale &&
                 imgBottom <= capY + 30 * scale &&
                 imgBottom >= capY - 180 * scale;
        });

        if (match) {
          cropBox = {
            x: match.viewportRect.x * scale,
            y: match.viewportRect.y * scale,
            width: match.viewportRect.width * scale,
            height: match.viewportRect.height * scale
          };
        }
      }
    }

    // 3. Fallback: derive grid cell from comment center or caption
    if (!cropBox) {
      const estimatedWidth = Math.min(viewport.width * 0.28, Math.max(160 * scale, viewport.width / 4.2));
      const estimatedHeight = estimatedWidth * 0.72;

      if (captionVp) {
        cropBox = {
          x: Math.max(10, captionVp[0] - estimatedWidth / 2),
          y: Math.max(10, captionVp[1] - estimatedHeight - 15 * scale),
          width: estimatedWidth,
          height: estimatedHeight
        };
      } else if (commentCenter) {
        cropBox = {
          x: Math.max(10, commentCenter.x - estimatedWidth * 0.2),
          y: Math.max(10, commentCenter.y - estimatedHeight * 0.2),
          width: estimatedWidth,
          height: estimatedHeight
        };
      } else {
        cropBox = {
          x: viewport.width * 0.2,
          y: viewport.height * 0.2,
          width: viewport.width * 0.6,
          height: viewport.height * 0.5
        };
      }
    }

    if (cropMode === 'with_caption') {
      cropBox.height += 40 * scale;
    } else if (cropMode === 'expanded') {
      const padX = cropBox.width * 0.08;
      const padY = cropBox.height * 0.08;
      cropBox.x = Math.max(0, cropBox.x - padX);
      cropBox.y = Math.max(0, cropBox.y - padY);
      cropBox.width += padX * 2;
      cropBox.height += padY * 2;
    }

    cropBox.x = Math.max(0, Math.min(canvas.width - 60, cropBox.x));
    cropBox.y = Math.max(0, Math.min(canvas.height - 60, cropBox.y));
    cropBox.width = Math.min(canvas.width - cropBox.x, Math.max(100, cropBox.width));
    cropBox.height = Math.min(canvas.height - cropBox.y, Math.max(100, cropBox.height));

    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = Math.round(cropBox.width);
    targetCanvas.height = Math.round(cropBox.height);
    const targetCtx = targetCanvas.getContext('2d')!;

    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    targetCtx.drawImage(
      canvas,
      cropBox.x, cropBox.y, cropBox.width, cropBox.height,
      0, 0, targetCanvas.width, targetCanvas.height
    );

    const dataUrl = targetCanvas.toDataURL('image/jpeg', 0.92);
    const blob = dataUrlToBlob(dataUrl);

    return {
      fileName,
      pageNum,
      dataUrl,
      blob,
      width: targetCanvas.width,
      height: targetCanvas.height,
      cropSource: 'pdf_paint_object',
      box: cropBox
    };
  } finally {
    page.cleanup();
  }
}

/**
 * Generate a realistic simulated 82-page Contact Sheet extraction result
 * with synthesized individual images ready for export.
 */
export function generateSample82PageData(): {
  assets: AssetRecord[];
  totalPages: number;
  rawPages: RawPageData[];
  summary: {
    totalPages: number;
    totalAssets: number;
    totalSelected: number;
    totalMissing: number;
    totalMultiPage: number;
  };
} {
  const totalPages = 82;
  const assets: AssetRecord[] = [];
  const rawPages: RawPageData[] = [];

  const vendors = ['Shutterstock', 'GettyImages', 'Alamy', 'iStock', 'GOBY_Shutterstock'];
  let currentPage = 1;
  let assetIndex = 1;

  // Real-world sample codes matching user pattern: VIBE3_WS_G_2_1a, VIBE3_WS_G_2_1b, etc.
  const units = ['1_1', '1_2', '2_1', '2_2', '3_1', '3_2', '4_1', '4_2', '5_1', '5_2', '6_1', '6_2'];
  const suffixes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  while (currentPage <= totalPages) {
    const unit = units[(assetIndex - 1) % units.length];
    const suffix = suffixes[Math.floor((assetIndex - 1) / units.length) % suffixes.length];
    const assetCode = `VIBE3_WS_G_${unit}${suffix}`;

    // Some assets span 2 pages (every 8th asset spans 2 pages)
    const spansTwoPages = (assetIndex % 8 === 0) && (currentPage + 1 <= totalPages);
    const pagesForAsset = spansTwoPages ? [currentPage, currentPage + 1] : [currentPage];

    // Some assets have no selection (every 14th asset is missing selection)
    const isMissingSelection = (assetIndex % 14 === 0);

    const candidateOptions: string[] = [];
    const comments: ExtractedComment[] = [];
    let selectedPageNum = pagesForAsset[0];

    // Generate 6 to 8 candidate options per page
    for (const pageNum of pagesForAsset) {
      const pageCandidates: PageCandidateOption[] = [];
      const count = 6 + Math.floor(Math.random() * 3);
      for (let c = 1; c <= count; c++) {
        const vendor = vendors[Math.floor(Math.random() * vendors.length)];
        const id = Math.floor(100000000 + Math.random() * 900000000);
        const fileName = `${vendor}_${id}.jpg`;
        candidateOptions.push(fileName);
        pageCandidates.push({
          text: fileName,
          x: 50 + (c % 4) * 120,
          y: 600 - Math.floor(c / 4) * 150,
          vendor: detectVendor(fileName)
        });
      }

      // Add comment if this page contains the selected image
      if (!isMissingSelection && (pageNum === pagesForAsset[pagesForAsset.length - 1] || Math.random() > 0.5) && comments.length === 0) {
        const selectedOption = pageCandidates[Math.floor(Math.random() * pageCandidates.length)];
        selectedPageNum = pageNum;
        comments.push({
          id: `sample-annot-${pageNum}`,
          pageNum,
          content: selectedOption.text,
          author: 'Editorial Reviewer',
          rect: [selectedOption.x, selectedOption.y + 20, selectedOption.x + 20, selectedOption.y + 40],
          subtype: 'Text'
        });
      }

      rawPages.push({
        pageNum,
        detectedAssetCode: assetCode,
        rawHeader: `${assetCode} Photo research`,
        comments: [...comments],
        candidateOptions: pageCandidates,
        detectedImages: [],
        allPageText: [assetCode, 'Photo research', ...pageCandidates.map(p => p.text)]
      });
    }

    const selectedImage = comments.length > 0 ? comments[0].content : '';
    const status: AssetRecord['status'] = isMissingSelection ? 'Missing Selection' : 'Selected';
    const pageDisplay = pagesForAsset.length > 1 ? `${pagesForAsset[0]}–${pagesForAsset[1]}` : `${pagesForAsset[0]}`;
    const vendor = selectedImage ? detectVendor(selectedImage) : undefined;

    // Synthesize individual image card
    let extractedImage: ExtractedImageInfo | undefined;
    if (selectedImage) {
      extractedImage = generateSynthesizedSampleImage(
        selectedPageNum,
        assetCode,
        selectedImage,
        vendor
      );
    }

    assets.push({
      id: `sample-asset-${assetIndex}`,
      assetCode,
      pages: pagesForAsset,
      pageDisplay,
      selectedPageNum,
      selectedImage,
      status,
      comments,
      candidateOptions,
      vendor,
      extractedImage
    });

    currentPage += pagesForAsset.length;
    assetIndex++;
  }

  const totalAssets = assets.length;
  const totalSelected = assets.filter(a => a.status === 'Selected').length;
  const totalMissing = assets.filter(a => a.status === 'Missing Selection').length;
  const totalMultiPage = assets.filter(a => a.pages.length > 1).length;

  return {
    assets,
    totalPages,
    rawPages,
    summary: {
      totalPages,
      totalAssets,
      totalSelected,
      totalMissing,
      totalMultiPage
    }
  };
}

/**
 * Exports all extracted images into a ZIP archive with customizable naming rules.
 */
export async function exportAllExtractedImagesToZip(
  assets: AssetRecord[],
  zipBaseName: string,
  options?: {
    namingOptions?: NamingOptions;
    onProgress?: (current: number, total: number) => void;
  } | ((current: number, total: number) => void)
): Promise<void> {
  const onProgress = typeof options === 'function' ? options : options?.onProgress;
  const namingOptions = typeof options === 'object' ? options?.namingOptions : undefined;

  const JSZipModule = (await import('jszip')).default;
  const zip = new JSZipModule();

  const validAssets = assets.filter(a => a.selectedImage && a.extractedImage?.dataUrl);

  if (validAssets.length === 0) {
    throw new Error('No extracted images available to export.');
  }

  const manifestRows: string[] = ['Filename\tAsset Code\tPage\tSelected Image\tVendor'];

  for (let i = 0; i < validAssets.length; i++) {
    const a = validAssets[i];
    onProgress?.(i + 1, validAssets.length);
    const img = a.extractedImage!;
    const blob = img.blob || dataUrlToBlob(img.dataUrl);

    // Compute filename based on custom naming options if provided, else use default img.fileName
    const targetFileName = namingOptions
      ? formatCustomImageFileName(a, i, namingOptions)
      : img.fileName;

    zip.file(targetFileName, blob);
    manifestRows.push(`${targetFileName}\t${a.assetCode}\t${img.pageNum}\t${a.selectedImage}\t${a.vendor || '—'}`);
  }

  zip.file('manifest.txt', manifestRows.join('\n'));

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const cleanName = zipBaseName.replace(/\.[^/.]+$/, '').trim() || 'ContactSheet';
  const saveAsModule = (await import('file-saver')).default;
  saveAsModule(zipBlob, `${cleanName}_Selected_Images.zip`);
}

/**
 * Downloads a single individual image file, optionally with custom filename
 */
export async function downloadSingleImage(
  extractedImage: ExtractedImageInfo,
  customFileName?: string
) {
  const blob = extractedImage.blob || dataUrlToBlob(extractedImage.dataUrl);
  const saveAsModule = (await import('file-saver')).default;
  saveAsModule(blob, customFileName || extractedImage.fileName);
}

/**
 * Format asset rows as TSV for direct paste into Excel.
 * Starting with Page number, then Asset Code, then Selection, then Vendor, and Raw Comment.
 */
export function formatAssetsToTsv(assets: AssetRecord[], includeStatus = true): string {
  if (includeStatus) {
    const header = ['Page', 'Asset Code', 'Selection', 'Vendor', 'Raw Comment', 'Status'].join('\t');
    const rows = assets.map(a => [
      a.pageDisplay,
      a.assetCode,
      a.selectedImage || '—',
      a.vendor || '—',
      a.comments.map(c => c.content).join(' | ') || '—',
      a.status
    ].join('\t'));
    return [header, ...rows].join('\n');
  } else {
    const header = ['Page', 'Asset Code', 'Selection', 'Vendor', 'Raw Comment'].join('\t');
    const rows = assets.map(a => [
      a.pageDisplay,
      a.assetCode,
      a.selectedImage || '—',
      a.vendor || '—',
      a.comments.map(c => c.content).join(' | ') || '—'
    ].join('\t'));
    return [header, ...rows].join('\n');
  }
}

