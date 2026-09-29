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
  cx?: number;
  cy?: number;
  locationDescription?: string;
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
  source?: string;
  imageId?: string;
  status: 'Selected' | 'Missing Selection' | 'Multiple Selections';
  comments: ExtractedComment[];
  candidateOptions: string[];
  vendor?: string;
  userEdited?: boolean;
  notes?: string;
  extractedImage?: ExtractedImageInfo;

  // Review & Separation flags
  hasTwoCommentsOnPage?: boolean;
  hasAdditionalComments: boolean;
  additionalComments: ExtractedComment[];
  selectionCommentText?: string;
  additionalCommentsText?: string;
  additionalCommentReason?: string;
  isTwoCommentsDifferentPlaces?: boolean;
  hasHeaderComment?: boolean;
  hasClippedExtension: boolean;
  clippedSuggestedOption?: string;
}

/**
 * Common image file extensions in photo research and publishing (case-insensitive)
 */
export const VALID_IMAGE_EXTENSIONS_REGEX = /\.(jpe?g|png|webp|tif|tiff|eps|gif|svg|bmp)$/i;

/**
 * Checks if a filename has a recognized image file extension (e.g. .jpg, .png, etc.)
 */
export function hasValidImageExtension(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') return false;
  return VALID_IMAGE_EXTENSIONS_REGEX.test(fileName.trim());
}

export interface ClassifiedCommentsResult {
  winningComment?: ExtractedComment;
  selectedImage: string;
  status: 'Selected' | 'Missing Selection' | 'Multiple Selections';
  hasAdditionalComments: boolean;
  additionalComments: ExtractedComment[];
  selectionCommentText: string;
  additionalCommentsText?: string;
  additionalCommentReason?: string;
  hasTwoCommentsOnPage: boolean;
  isTwoCommentsDifferentPlaces?: boolean;
  hasHeaderComment?: boolean;
  hasClippedExtension: boolean;
  clippedSuggestedOption?: string;
}

/**
 * Classifies comments for an asset:
 * 1. Uses the comment with a valid image file extension (.jpg, .png, etc.) as the main selection if it exists.
 * 2. Flags pages that have 2 or more comments on the same page for review.
 * 3. Never treats single image selection comments as editorial notes.
 */
export function classifyAssetComments(
  comments: ExtractedComment[],
  candidateOptions: string[]
): ClassifiedCommentsResult {
  if (!comments || comments.length === 0) {
    return {
      selectedImage: '',
      status: 'Missing Selection',
      hasAdditionalComments: false,
      additionalComments: [],
      selectionCommentText: '',
      hasTwoCommentsOnPage: false,
      hasClippedExtension: false
    };
  }

  // 1. Identify main comment: prioritize comment that has a valid image file extension
  const commentsWithExt = comments.filter(c => hasValidImageExtension(c.content));

  let winningComment: ExtractedComment;

  if (commentsWithExt.length > 0) {
    // If one or more comments have a file extension (.jpg, etc.)
    if (commentsWithExt.length === 1) {
      winningComment = commentsWithExt[0];
    } else {
      // Multiple comments have file extensions: check if one matches page candidates
      const matchingCandidate = commentsWithExt.find(c => {
        const lower = c.content.toLowerCase();
        return candidateOptions.some(opt => opt.toLowerCase().includes(lower) || lower.includes(opt.toLowerCase()));
      });
      winningComment = matchingCandidate || commentsWithExt[0];
    }
  } else {
    // No comment has an extension: check if any comment matches candidate options on the page
    const matchingCandidate = comments.find(c => {
      const lower = c.content.toLowerCase();
      return candidateOptions.some(opt => {
        const oLower = opt.toLowerCase();
        const stemLower = oLower.replace(/\.[^/.]+$/, '');
        return oLower.includes(lower) || lower.includes(oLower) || (stemLower.length >= 6 && lower.includes(stemLower));
      });
    });
    winningComment = matchingCandidate || comments[0];
  }

  // Extract clean selected filename
  const rawSelectedName = cleanImageFileName(winningComment.content);
  let selectedImage = rawSelectedName;

  // Correlate with candidate options on the page to retrieve the fullest filename if available
  if (candidateOptions.length > 0) {
    const matched = candidateOptions.find(opt => {
      const optLower = opt.toLowerCase();
      const rawLower = rawSelectedName.toLowerCase();
      const stemLower = rawLower.replace(/\.[^/.]+$/, '');
      return optLower.includes(rawLower) || rawLower.includes(optLower) ||
        (stemLower.length >= 6 && optLower.includes(stemLower));
    });
    if (matched && matched.length >= selectedImage.length) {
      selectedImage = matched;
    }
  }

  // Check if filename is clipped (no image file extension)
  const hasClipped = Boolean(selectedImage && !hasValidImageExtension(selectedImage));
  let clippedSuggestedOption: string | undefined;
  if (hasClipped && candidateOptions.length > 0) {
    const match = candidateOptions.find(opt =>
      hasValidImageExtension(opt) &&
      (opt.toLowerCase().startsWith(selectedImage.toLowerCase()) ||
       selectedImage.toLowerCase().startsWith(opt.replace(/\.[^/.]+$/, '').toLowerCase()))
    );
    if (match) {
      clippedSuggestedOption = match;
    }
  }

  // 2. Evaluate remaining comments & flag 2 comments on the same page
  const remaining = comments.filter(c => c.id !== winningComment.id);
  const hasTwoCommentsOnPage = comments.length >= 2;

  // If there are 0 remaining comments, it's a single clean comment:
  if (remaining.length === 0) {
    return {
      winningComment,
      selectedImage,
      status: selectedImage ? 'Selected' : 'Missing Selection',
      hasAdditionalComments: false,
      additionalComments: [],
      selectionCommentText: winningComment.content,
      hasTwoCommentsOnPage: false,
      hasClippedExtension: hasClipped,
      clippedSuggestedOption
    };
  }

  // If there are multiple comments that BOTH have image file extensions with different names:
  let status: 'Selected' | 'Missing Selection' | 'Multiple Selections' = 'Selected';
  if (commentsWithExt.length >= 2) {
    const uniqueNames = new Set(commentsWithExt.map(c => cleanImageFileName(c.content).toLowerCase()));
    if (uniqueNames.size > 1) {
      status = 'Multiple Selections';
    }
  }

  const additionalCommentsText = remaining
    .map(c => `[p. ${c.pageNum}] ${c.content}`)
    .join(' | ');

  const additionalCommentReason = status === 'Multiple Selections'
    ? `Multiple conflicting selections on page: "${winningComment.content}" vs "${remaining[0].content}"`
    : `2 comments on page: Primary "${winningComment.content}" | Note "${remaining[0].content}"`;

  return {
    winningComment,
    selectedImage,
    status,
    hasAdditionalComments: true,
    additionalComments: remaining,
    selectionCommentText: winningComment.content,
    additionalCommentsText,
    additionalCommentReason,
    hasTwoCommentsOnPage: true,
    isTwoCommentsDifferentPlaces: true,
    hasClippedExtension: hasClipped,
    clippedSuggestedOption
  };
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
    totalWithAdditionalComments: number;
    totalWithClippedExtension: number;
    totalNeedsReview: number;
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

export interface SourceAndImageId {
  source: string;
  imageId: string;
}

/**
 * Extracts Source (Vendor) and Image ID from a filename or selection string.
 *
 * Rules:
 * 1. Recognizes known agencies: Shutterstock, Getty Images, iStock, Alamy, Adobe Stock, GOBY, Dreamstime, Depositphotos, 123RF.
 * 2. If no source is present and image ID is numeric (e.g. "2167493181.jpg", "14283921"), source is "Shutterstock / Getty".
 * 3. Extracts the specific numerical or alphanumeric ID (e.g. Shutterstock_RF_2167493181.jpg -> 2167493181).
 */
export function extractSourceAndImageId(fileNameOrText: string): SourceAndImageId {
  if (!fileNameOrText) {
    return { source: '—', imageId: '—' };
  }

  const raw = fileNameOrText.trim();
  if (!raw || raw === '—' || raw.toLowerCase() === '(none)') {
    return { source: '—', imageId: '—' };
  }

  // Strip file extension (.jpg, .jpeg, .png, etc.)
  const stem = raw.replace(/\.[^/.]+$/, '').trim();
  const lower = raw.toLowerCase();

  // 1. Detect Source
  let source = '';
  if (lower.includes('shutterstock')) {
    source = 'Shutterstock';
  } else if (lower.includes('getty')) {
    source = 'Getty Images';
  } else if (lower.includes('istock')) {
    source = 'iStock';
  } else if (lower.includes('alamy')) {
    source = 'Alamy';
  } else if (lower.includes('goby')) {
    source = 'GOBY / Shutterstock';
  } else if (lower.includes('adobe')) {
    source = 'Adobe Stock';
  } else if (lower.includes('dreamstime')) {
    source = 'Dreamstime';
  } else if (lower.includes('depositphotos')) {
    source = 'Depositphotos';
  } else if (lower.includes('123rf')) {
    source = '123RF';
  }

  // 2. Extract Image ID
  let imageId = '';

  // Clean numeric stem by removing leading/trailing punctuation or license tokens like _rf, _rm
  const cleanNumericCandidate = stem
    .replace(/^(?:#|[_-])+/g, '')
    .replace(/(?:[_-](?:rf|rm|creative|editorial))+$/i, '')
    .trim();

  if (/^\d+$/.test(cleanNumericCandidate)) {
    imageId = cleanNumericCandidate;
  } else {
    // Look for explicit numeric sequences (e.g., 5 to 12 digits) commonly used by stock agencies
    const digitMatch = stem.match(/\b\d{5,12}\b/) || stem.match(/(?:_|-|id|#)(\d{5,12})(?:_|-|\b)/i) || stem.match(/(\d{5,12})/);
    if (digitMatch) {
      imageId = digitMatch[1] || digitMatch[0];
    } else if (source === 'Alamy') {
      // Alamy alphanumeric ID (e.g. Alamy_2D9A4B1 or Alamy_F4X7Y2)
      const alamyMatch = stem.match(/alamy[_ \-]+([A-Za-z0-9]{5,10})/i);
      if (alamyMatch) {
        imageId = alamyMatch[1];
      }
    }

    // If still no imageId, check if stripping vendor and licensing prefixes yields an ID
    if (!imageId && source) {
      const withoutVendor = stem
        .replace(/(?:shutterstock(?:_rf|_rm)?|getty(?:images)?(?:_rf|_rm)?|istock(?:photo)?|alamy|adobestock|adobe_stock|dreamstime|depositphotos|123rf|goby)[_ \-]+/i, '')
        .replace(/^(?:rf|rm|creative|editorial)[_ \-]+/i, '')
        .trim();
      if (withoutVendor && withoutVendor !== stem) {
        imageId = withoutVendor;
      }
    }
  }

  // 3. User Rule:
  // "if no source is there, and image id is just numeric, it is either shutterstock or getty. Provide both as source separated by slash"
  const isNumericId = Boolean(imageId && /^\d+$/.test(imageId));
  if (!source) {
    if (isNumericId) {
      source = 'Shutterstock / Getty';
    } else {
      source = '—';
    }
  }

  if (!imageId) {
    imageId = '—';
  }

  return { source, imageId };
}

/**
 * Detect image vendor from filename or text
 */
export function detectVendor(fileName: string): string {
  const { source } = extractSourceAndImageId(fileName);
  return source;
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

      // 2. Extract annotations (Comments, Rectangles, Sticky notes, FreeText, Popups)
      const annotations = await page.getAnnotations();
      
      // Separate markup annotations from popup notes
      const markupAnnots: any[] = [];
      const popupAnnots: any[] = [];

      for (const annot of annotations) {
        if (!annot || annot.subtype === 'Link' || annot.subtype === 'Widget') continue;
        if (annot.subtype === 'Popup') {
          popupAnnots.push(annot);
        } else {
          markupAnnots.push(annot);
        }
      }

      // If a markup annotation has empty or short contents, resolve text from its associated popup bubble
      for (const markup of markupAnnots) {
        let text = '';
        if (typeof markup.contents === 'string' && markup.contents.trim()) {
          text = markup.contents.trim();
        } else if (markup.contentsObj && typeof markup.contentsObj.str === 'string') {
          text = markup.contentsObj.str.trim();
        }

        if (!text) {
          const relatedPopup = popupAnnots.find(p => 
            p.parentId === markup.id || 
            p.inReplyTo === markup.id || 
            (p.rect && markup.rect && Math.abs(p.rect[0] - markup.rect[0]) < 50 && Math.abs(p.rect[1] - markup.rect[1]) < 50)
          );
          if (relatedPopup) {
            const pText = typeof relatedPopup.contents === 'string'
              ? relatedPopup.contents.trim()
              : (relatedPopup.contentsObj?.str?.trim() || '');
            if (pText) {
              text = pText;
            }
          }
        }
        markup._resolvedText = text;
      }

      const rawExtracted: {
        id: string;
        content: string;
        author?: string;
        rect?: number[];
        subtype?: string;
        date?: string;
      }[] = [];

      for (const markup of markupAnnots) {
        if (markup._resolvedText) {
          rawExtracted.push({
            id: markup.id || `annot-${pageNum}-${rawExtracted.length + 1}`,
            content: markup._resolvedText,
            author: markup.titleObj?.str || markup.title || undefined,
            rect: markup.rect,
            subtype: markup.subtype,
            date: markup.modificationDate || undefined
          });
        }
      }

      // Also include standalone popups that have non-empty text not already present in markup annotations
      for (const popup of popupAnnots) {
        if (popup.parentId || popup.inReplyTo) continue;
        const pText = typeof popup.contents === 'string' ? popup.contents.trim() : (popup.contentsObj?.str?.trim() || '');
        if (pText && !rawExtracted.some(m => m.content.toLowerCase() === pText.toLowerCase())) {
          rawExtracted.push({
            id: popup.id || `popup-${pageNum}-${rawExtracted.length + 1}`,
            content: pText,
            author: popup.titleObj?.str || popup.title || undefined,
            rect: popup.rect,
            subtype: 'Popup',
            date: popup.modificationDate || undefined
          });
        }
      }

      // Calculate spatial positions and deduplicate identical text on the same page
      const comments: ExtractedComment[] = [];
      const seenCommentTexts = new Set<string>();

      for (const item of rawExtracted) {
        const norm = item.content.toLowerCase().replace(/[\r\n\s]+/g, ' ').trim();
        if (!norm || seenCommentTexts.has(norm)) continue;
        seenCommentTexts.add(norm);

        let cx = 0;
        let cy = 0;

        if (item.rect && item.rect.length === 4) {
          cx = (item.rect[0] + item.rect[2]) / 2;
          cy = (item.rect[1] + item.rect[3]) / 2;
        }

        const locationDescription = item.subtype === 'Square'
          ? 'Rectangle around candidate image'
          : 'Page comment';

        comments.push({
          id: item.id,
          pageNum,
          content: item.content,
          author: item.author,
          rect: item.rect,
          subtype: item.subtype,
          date: item.date,
          cx,
          cy,
          locationDescription
        });
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
    const classified = classifyAssetComments(group.comments, group.candidateOptions);

    // Determine the exact page of the selection
    const selectedPageNum = classified.winningComment?.pageNum || group.pages[0] || 1;

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

    const meta = extractSourceAndImageId(classified.selectedImage);
    const source = meta.source !== '—' ? meta.source : undefined;
    const imageId = meta.imageId !== '—' ? meta.imageId : undefined;

    return {
      id: `asset-${idx + 1}-${group.assetCode}`,
      assetCode: group.assetCode,
      pages: group.pages,
      pageDisplay,
      selectedPageNum,
      selectedImage: classified.selectedImage,
      source,
      imageId,
      status: classified.status,
      comments: group.comments,
      candidateOptions: group.candidateOptions,
      vendor: source,
      hasTwoCommentsOnPage: classified.hasTwoCommentsOnPage,
      hasAdditionalComments: classified.hasAdditionalComments,
      additionalComments: classified.additionalComments,
      selectionCommentText: classified.selectionCommentText,
      additionalCommentsText: classified.additionalCommentsText,
      additionalCommentReason: classified.additionalCommentReason,
      isTwoCommentsDifferentPlaces: classified.isTwoCommentsDifferentPlaces,
      hasHeaderComment: classified.hasHeaderComment,
      hasClippedExtension: classified.hasClippedExtension,
      clippedSuggestedOption: classified.clippedSuggestedOption
    };
  });

  const totalAssets = assets.length;
  const totalSelected = assets.filter(a => a.status === 'Selected' || a.status === 'Multiple Selections').length;
  const totalMissing = assets.filter(a => a.status === 'Missing Selection').length;
  const totalMultiPage = assets.filter(a => a.pages.length > 1).length;
  const totalWithAdditionalComments = assets.filter(a => a.hasAdditionalComments).length;
  const totalWithClippedExtension = assets.filter(a => a.hasClippedExtension).length;
  const totalNeedsReview = assets.filter(a =>
    a.hasAdditionalComments || a.hasClippedExtension || a.status === 'Missing Selection' || a.status === 'Multiple Selections'
  ).length;

  onProgress?.({
    currentPage: totalPages,
    totalPages,
    phase: 'completed',
    statusMessage: `Successfully extracted ${totalAssets} assets (${totalSelected} selected, ${totalMissing} missing, ${totalNeedsReview} needing review).`
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
      totalMultiPage,
      totalWithAdditionalComments,
      totalWithClippedExtension,
      totalNeedsReview
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

      // Generate comments based on specific test scenarios
      if (!isMissingSelection) {
        const selectedOption = pageCandidates[Math.floor(Math.random() * pageCandidates.length)];
        selectedPageNum = pageNum;

        // Special Scenario A: Asset 8 has a secondary editorial note
        if (assetIndex === 8) {
          comments.push({
            id: `sample-header-note-${pageNum}`,
            pageNum,
            content: 'Editorial Note: Verify licensing rights with Getty Images before layout',
            author: 'Art Director',
            rect: [50, 720, 300, 750],
            subtype: 'Text',
            cx: 175,
            cy: 735,
            locationDescription: 'Editorial note'
          });
        }

        // Special Scenario B: Asset 16 has two comments on page (Selection + Alt option note)
        if (assetIndex === 16) {
          const optAlt = pageCandidates[Math.min(pageCandidates.length - 1, 4)];
          comments.push({
            id: `sample-annot-alt-${pageNum}`,
            pageNum,
            content: 'Alternative selection if author prefers horizontal orientation',
            author: 'Photo Editor',
            rect: [optAlt.x, optAlt.y + 40, optAlt.x + 30, optAlt.y + 60],
            subtype: 'Text',
            cx: optAlt.x + 15,
            cy: optAlt.y + 50,
            locationDescription: 'Alt option note'
          });
        }

        // Special Scenario C: Asset 24 has a clipped filename (missing .jpg)
        let commentText = selectedOption.text;
        if (assetIndex === 24) {
          commentText = selectedOption.text.replace(/\.jpe?g$/i, '');
        }

        // Standard Primary Selection Comment (Rectangle around image)
        comments.push({
          id: `sample-annot-rect-${pageNum}`,
          pageNum,
          content: commentText,
          author: 'Editorial Reviewer',
          rect: [selectedOption.x - 5, selectedOption.y - 5, selectedOption.x + 100, selectedOption.y + 80],
          subtype: 'Square',
          cx: selectedOption.x + 47,
          cy: selectedOption.y + 37,
          locationDescription: 'Rectangle around candidate image'
        });

        // Special Scenario D: Asset 48 has multiple conflicting selections
        if (assetIndex === 48 && pageCandidates.length > 2) {
          const secondOption = pageCandidates[1];
          comments.push({
            id: `sample-annot-second-${pageNum}`,
            pageNum,
            content: secondOption.text,
            author: 'Managing Editor',
            rect: [secondOption.x - 5, secondOption.y - 5, secondOption.x + 100, secondOption.y + 80],
            subtype: 'Square',
            cx: secondOption.x + 47,
            cy: secondOption.y + 37,
            locationDescription: 'Rectangle around candidate image'
          });
        }
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

    const classified = classifyAssetComments(comments, candidateOptions);
    const status = classified.status;
    const selectedImage = classified.selectedImage;
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

    const meta = extractSourceAndImageId(selectedImage);
    const source = meta.source !== '—' ? meta.source : vendor;
    const imageId = meta.imageId !== '—' ? meta.imageId : undefined;

    assets.push({
      id: `sample-asset-${assetIndex}`,
      assetCode,
      pages: pagesForAsset,
      pageDisplay,
      selectedPageNum,
      selectedImage,
      source,
      imageId,
      status,
      comments,
      candidateOptions,
      vendor: source,
      extractedImage,
      hasTwoCommentsOnPage: classified.hasTwoCommentsOnPage,
      hasAdditionalComments: classified.hasAdditionalComments,
      additionalComments: classified.additionalComments,
      selectionCommentText: classified.selectionCommentText,
      additionalCommentsText: classified.additionalCommentsText,
      additionalCommentReason: classified.additionalCommentReason,
      isTwoCommentsDifferentPlaces: classified.isTwoCommentsDifferentPlaces,
      hasHeaderComment: classified.hasHeaderComment,
      hasClippedExtension: classified.hasClippedExtension,
      clippedSuggestedOption: classified.clippedSuggestedOption
    });

    currentPage += pagesForAsset.length;
    assetIndex++;
  }

  const totalAssets = assets.length;
  const totalSelected = assets.filter(a => a.status === 'Selected').length;
  const totalMissing = assets.filter(a => a.status === 'Missing Selection').length;
  const totalMultiPage = assets.filter(a => a.pages.length > 1).length;
  const totalWithAdditionalComments = assets.filter(a => a.hasAdditionalComments).length;
  const totalWithClippedExtension = assets.filter(a => a.hasClippedExtension).length;
  const totalNeedsReview = assets.filter(a =>
    a.hasAdditionalComments || a.hasClippedExtension || a.status === 'Missing Selection' || a.status === 'Multiple Selections'
  ).length;

  return {
    assets,
    totalPages,
    rawPages,
    summary: {
      totalPages,
      totalAssets,
      totalSelected,
      totalMissing,
      totalMultiPage,
      totalWithAdditionalComments,
      totalWithClippedExtension,
      totalNeedsReview
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
 * Starting with Page number, then Asset Code, Selection, Source, Image ID, Additional Comments, Clipped Flag, and Status.
 * Note: Raw Comment column is removed per user request as Selection contains the primary filename.
 */
export function formatAssetsToTsv(assets: AssetRecord[], includeStatus = true): string {
  if (includeStatus) {
    const header = ['Page', 'Asset Code', 'Selection', 'Source', 'Image ID', 'Additional Comments', 'Clipped / Missing Ext?', 'Status'].join('\t');
    const rows = assets.map(a => {
      const meta = extractSourceAndImageId(a.selectedImage || a.selectionCommentText || '');
      const source = a.source || meta.source || '—';
      const imageId = a.imageId || meta.imageId || '—';
      return [
        a.pageDisplay,
        a.assetCode,
        a.selectedImage || '—',
        source,
        imageId,
        a.additionalCommentsText || (a.hasTwoCommentsOnPage || a.hasAdditionalComments ? 'Yes' : '—'),
        a.hasClippedExtension ? 'YES - Missing Extension' : 'OK',
        a.status
      ].join('\t');
    });
    return [header, ...rows].join('\n');
  } else {
    const header = ['Page', 'Asset Code', 'Selection', 'Source', 'Image ID', 'Additional Comments'].join('\t');
    const rows = assets.map(a => {
      const meta = extractSourceAndImageId(a.selectedImage || a.selectionCommentText || '');
      const source = a.source || meta.source || '—';
      const imageId = a.imageId || meta.imageId || '—';
      return [
        a.pageDisplay,
        a.assetCode,
        a.selectedImage || '—',
        source,
        imageId,
        a.additionalCommentsText || (a.hasTwoCommentsOnPage || a.hasAdditionalComments ? 'Yes' : '—')
      ].join('\t');
    });
    return [header, ...rows].join('\n');
  }
}

/**
 * Format only review-flagged rows (2 Comments on Page, Clipped Extension, or Missing) as TSV for direct paste into Excel
 */
export function formatReviewAssetsToTsv(assets: AssetRecord[]): string {
  const reviewRows = assets.filter(a => a.hasTwoCommentsOnPage || a.hasAdditionalComments || a.hasClippedExtension || a.status === 'Missing Selection' || a.status === 'Multiple Selections');
  const header = ['Page', 'Asset Code', 'Selection', 'Source', 'Image ID', 'Flag Reasons', 'Additional Comments', 'Clipped / Missing Ext?', 'Status'].join('\t');
  const rows = reviewRows.map(a => {
    const reasons: string[] = [];
    if (a.hasTwoCommentsOnPage) reasons.push('2 Comments on Page');
    if (a.additionalCommentReason) reasons.push(a.additionalCommentReason);
    if (a.hasClippedExtension) reasons.push('Clipped Filename (No Extension)');
    if (a.status === 'Missing Selection') reasons.push('Missing Selection');
    if (a.status === 'Multiple Selections') reasons.push('Multiple Selections');

    const meta = extractSourceAndImageId(a.selectedImage || a.selectionCommentText || '');
    const source = a.source || meta.source || '—';
    const imageId = a.imageId || meta.imageId || '—';

    return [
      a.pageDisplay,
      a.assetCode,
      a.selectedImage || '—',
      source,
      imageId,
      reasons.join('; '),
      a.additionalCommentsText || '—',
      a.hasClippedExtension ? 'YES - Missing Extension' : 'OK',
      a.status
    ].join('\t');
  });
  return [header, ...rows].join('\n');
}

