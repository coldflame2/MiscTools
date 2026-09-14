import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CopyIcon } from './icons/CopyIcon';
import { FileWordIcon } from './icons/FileWordIcon';
import { UploadIcon } from './icons/UploadIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { 
  ArrowLeft, 
  ArrowRight, 
  ArrowLeftRight, 
  Check, 
  Copy, 
  Trash2, 
  Eye, 
  Edit3, 
  Sparkles, 
  SlidersHorizontal, 
  RotateCcw, 
  HelpCircle,
  List,
  FileText,
  ClipboardPaste,
  Layers,
  CheckCircle2,
  ListOrdered
} from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import saveAs from "file-saver";

export interface ParsedCredit {
  original: string;
  vendor: string;
  acknowledgement: string;
}

export interface VendorGroup {
  vendor: string; // Agency name, or "" for direct/standalone credit
  acknowledgements: string[];
}

export interface ReverseParseResult {
  lines: string[];
  parsed: ParsedCredit[];
  groups: VendorGroup[];
}

export type ListFormat = 'credit-vendor' | 'vendor-credit' | 'vendor-bracket' | 'auto';

const COMMON_VENDORS = [
  'shutterstock',
  'getty',
  'gettyimages',
  'getty images',
  'alamy',
  'istock',
  'istockphoto',
  'adobe',
  'adobestock',
  'adobe stock',
  'sciencephoto',
  'science photo library',
  'dam',
  'dreamstime',
  'depositphotos',
  '123rf',
  'flaticon',
  'freepik',
  'unsplash',
  'pexels',
  'pixabay',
  'corbis',
  'superstock',
  'nature picture library',
  'bridgeman',
  'bridgeman images',
  'reuters',
  'ap',
  'associated press',
  'afp',
  'agefotostock',
  'age fotostock',
  'thinkstock',
  'minden',
  'minden pictures',
  'photo researchers',
  'science source',
  'national geographic',
  'nasa',
  'mary evans',
  'pantheon',
  'granger',
  'shutterstock.com',
  'alamy.com'
];

const MEGA_VENDORS = [
  'shutterstock',
  'getty',
  'alamy',
  'istock',
  '123rf'
];

export const cleanAcknowledgement = (ack: string, source: string): string => {
  const cleanedAck = ack.trim().replace(/\s*\/\s*/g, '/');
  const cleanedSource = source.trim();

  if (!cleanedSource) return cleanedAck;

  const escapedSource = cleanedSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexEnd = new RegExp(`\\/${escapedSource}$`, 'i');
  const regexStart = new RegExp(`^${escapedSource}\\/`, 'i');

  let result = cleanedAck;
  if (regexEnd.test(result)) {
    result = result.replace(regexEnd, '');
  } else if (regexStart.test(result)) {
    result = result.replace(regexStart, '');
  }
  return result.trim().replace(/\s*\/\s*/g, '/');
};

export const standardizeVendor = (vendor: string): string => {
  const lower = vendor.toLowerCase().trim();
  if (lower === 'oup' || lower.includes('oxford university press')) return 'OUP';
  if (lower.includes('getty')) return 'Getty Images';
  if (lower.includes('shutterstock')) return 'Shutterstock';
  if (lower.includes('alamy')) return 'Alamy Stock Photo';
  if (lower.includes('istock')) return 'iStock';
  if (lower.includes('adobe')) return 'Adobe Stock';
  if (lower.includes('dam')) return 'DAM';
  if (lower.includes('dreamstime')) return 'Dreamstime';
  if (lower.includes('depositphotos')) return 'Depositphotos';
  if (lower.includes('freepik')) return 'Freepik';
  if (lower.includes('science photo')) return 'Science Photo Library';
  if (lower.includes('nature picture')) return 'Nature Picture Library';
  
  return vendor.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const getVendorScore = (part: string): number => {
  const lower = part.toLowerCase().trim();

  if (lower === 'oup' || lower.includes('oxford university press')) {
    return 1000;
  }

  let score = 0;

  if (COMMON_VENDORS.includes(lower)) {
    score = 10;
  } else {
    for (const v of COMMON_VENDORS) {
      if (lower === v) {
        score = 10;
        break;
      } else if (lower.startsWith(v) || lower.endsWith(v)) {
        score = Math.max(score, 8);
      } else if (lower.includes(v)) {
        score = Math.max(score, 5);
      }
    }
  }

  for (const mv of MEGA_VENDORS) {
    if (lower.includes(mv)) {
      score += 100;
      break;
    }
  }

  return score;
};

export const DEFAULT_COMMA_EXCEPTIONS: string[] = [
  'LLC', 'L.L.C.', 'L.L.C',
  'Inc', 'Inc.', 'Incorporated',
  'Ltd', 'Ltd.', 'Limited',
  'Corp', 'Corp.', 'Corporation',
  'Co', 'Co.', 'Company',
  'Pty Ltd', 'Pty. Ltd.', 'Pty Ltd.', 'Pty',
  'GmbH', 'S.A.', 'SA', 'B.V.', 'BV', 'LLP', 'L.L.P.',
  'PLC', 'Plc', 'P.L.C.', 'LP', 'L.P.',
  'Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV'
];

/**
 * Checks if a token matches one of the comma exceptions (e.g. LLC, Inc., Ltd., Jr., etc.)
 * where a comma preceding the token should be kept as part of the previous credit.
 */
export function isCommaException(token: string, customExceptions: string[] = []): boolean {
  const clean = token.trim().replace(/^[\s,]+|[\s,;]+$/g, '');
  if (!clean) return false;

  const all = [
    ...DEFAULT_COMMA_EXCEPTIONS,
    ...customExceptions.map(x => x.trim()).filter(Boolean)
  ];

  const lowerClean = clean.toLowerCase();
  const lowerNoDots = lowerClean.replace(/\./g, '').trim();

  for (const exc of all) {
    const lowerExc = exc.toLowerCase().trim();
    const lowerExcNoDots = lowerExc.replace(/\./g, '').trim();

    if (lowerClean === lowerExc || lowerNoDots === lowerExcNoDots) {
      return true;
    }

    if (lowerNoDots.startsWith(lowerExcNoDots)) {
      const remainder = lowerNoDots.slice(lowerExcNoDots.length).trim();
      if (!remainder || remainder.startsWith('(') || remainder.startsWith('-')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Splits comma/and/& separated acknowledgements while preserving comma exceptions
 * like "LLC" or "Inc." as part of the previous item (e.g. "Company, LLC").
 */
export function splitAcknowledgementsWithExceptions(
  insideRaw: string,
  customExceptions: string[] = []
): string[] {
  const rawParts = insideRaw
    .replace(/\s+and\s+/gi, ', ')
    .replace(/\s*&\s*/g, ', ')
    .split(',')
    .map(it => it.trim())
    .filter(Boolean);

  const merged: string[] = [];
  for (const part of rawParts) {
    if (merged.length > 0 && isCommaException(part, customExceptions)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}, ${part}`;
    } else {
      merged.push(part);
    }
  }

  return merged;
}

/**
 * Parses individual credit lines into grouped credits.
 * 
 * Rules:
 * 1. If there's no slash in the list line (and no brackets), do NOT group in brackets. Just type the name.
 * 2. If line has brackets (e.g. "OUP (Dave)"), extract vendor "OUP" and ack "Dave".
 * 3. Standalone credits are kept as individual entries and separated by semicolons.
 * 4. All distinct entries are sorted alphabetically.
 */
export function parseListToCredits(
  text: string,
  vendorPosition: ListFormat = 'auto',
  customExceptions: string[] = []
): { parsed: ParsedCredit[]; groups: VendorGroup[]; creditsString: string } {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const parsed: ParsedCredit[] = [];
  const vendorMap = new Map<string, Set<string>>();
  const directList: string[] = [];

  lines.forEach(line => {
    // Check if line already has brackets: e.g. "OUP (Dave)" or "Shutterstock (Casey, Anna Stills)"
    const bracketMatch = line.match(/^([^(\[]+?)\s*[\(\[]([^()\[\]]+)[\)\]]\s*$/);
    if (bracketMatch) {
      const rawVendor = bracketMatch[1].trim();
      const rawInside = bracketMatch[2].trim();
      const vendor = standardizeVendor(rawVendor);
      const acks = splitAcknowledgementsWithExceptions(rawInside, customExceptions);
      
      if (acks.length === 0) {
        // Empty brackets, treat as direct name
        parsed.push({ original: line, vendor: "Direct", acknowledgement: rawVendor });
        directList.push(rawVendor);
      } else {
        if (!vendorMap.has(vendor)) vendorMap.set(vendor, new Set());
        for (const ack of acks) {
          const clean = cleanAcknowledgement(ack, vendor);
          parsed.push({ original: line, vendor, acknowledgement: clean });
          vendorMap.get(vendor)!.add(clean);
        }
      }
      return;
    }

    // Check if line has slashes or separators
    const parts = line.split(/[\/|\\\t]/).map(p => p.trim()).filter(Boolean);

    if (parts.length >= 2) {
      let vendor = "";
      let ack = "";

      if (vendorPosition === 'vendor-credit') {
        vendor = standardizeVendor(parts[0]);
        ack = parts.slice(1).join('/');
      } else if (vendorPosition === 'credit-vendor') {
        vendor = standardizeVendor(parts[parts.length - 1]);
        ack = parts.slice(0, -1).join('/');
      } else {
        // Auto-detect or bracket mode
        let bestIndex = 0;
        let maxScore = -1;
        for (let i = 0; i < parts.length; i++) {
          const score = getVendorScore(parts[i]);
          if (score > maxScore) {
            maxScore = score;
            bestIndex = i;
          }
        }

        if (maxScore > 0) {
          vendor = standardizeVendor(parts[bestIndex]);
          const remaining = parts.filter((_, idx) => idx !== bestIndex);
          ack = remaining.join('/');
        } else {
          // Standard photography convention: Contributor/Agency
          vendor = standardizeVendor(parts[parts.length - 1]);
          ack = parts.slice(0, -1).join('/');
        }
      }

      const cleanAck = cleanAcknowledgement(ack, vendor);
      parsed.push({
        original: line,
        vendor: vendor || "Direct",
        acknowledgement: cleanAck || ack
      });

      if (vendor) {
        if (!vendorMap.has(vendor)) vendorMap.set(vendor, new Set());
        vendorMap.get(vendor)!.add(cleanAck || ack);
      } else {
        directList.push(cleanAck || ack);
      }
      return;
    }

    // NO SLASH and NO BRACKETS: Standalone credit!
    // User Directive: "And if there's no slash in the list, then don't group them in brackets. Just type the name."
    const cleanItem = line.trim();
    parsed.push({
      original: cleanItem,
      vendor: "Direct",
      acknowledgement: cleanItem
    });
    directList.push(cleanItem);
  });

  // Build distinct credit entries
  interface CreditEntry {
    vendor: string;
    acknowledgements: string[];
    display: string;
    sortKey: string;
  }

  const allEntries: CreditEntry[] = [];

  // 1. Vendor / Agency groups
  for (const [vendor, acksSet] of vendorMap.entries()) {
    const sortedAcks = Array.from(acksSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const display = `${vendor} (${sortedAcks.join(', ')})`;
    allEntries.push({
      vendor,
      acknowledgements: sortedAcks,
      display,
      sortKey: vendor.toLowerCase()
    });
  }

  // 2. Standalone direct credits (preserve unique items)
  const uniqueDirect = Array.from(new Set(directList));
  for (const name of uniqueDirect) {
    allEntries.push({
      vendor: "",
      acknowledgements: [name],
      display: name,
      sortKey: name.toLowerCase()
    });
  }

  // Sort all credits alphabetically by sortKey
  allEntries.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }));

  const groups: VendorGroup[] = allEntries.map(e => ({
    vendor: e.vendor,
    acknowledgements: e.acknowledgements
  }));

  const creditsString = allEntries.map((entry, index) => {
    const suffix = index === allEntries.length - 1 ? '.' : '; ';
    return `${entry.display}${suffix}`;
  }).join('');

  return { parsed, groups, creditsString };
}

/**
 * Reverse parses grouped credits into single-line list items.
 * 
 * Rules:
 * 1. If there's a single name / no brackets in grouped credits, do NOT add a slash in the list.
 * 2. Unpack bracketed agency acknowledgements according to selected format (Credit/Agency, Agency/Credit, or Agency (Credit)).
 * 3. Standalone credits without brackets are kept directly without a slash.
 */
export function parseCreditsToDetailed(
  creditsText: string,
  format: ListFormat = 'credit-vendor',
  customExceptions: string[] = []
): ReverseParseResult {
  if (!creditsText || !creditsText.trim()) {
    return { lines: [], parsed: [], groups: [] };
  }

  // Normalize text: replace newlines inside brackets/parentheses with spaces
  let normalized = '';
  let pDepth = 0;
  for (let i = 0; i < creditsText.length; i++) {
    const c = creditsText[i];
    if (c === '(' || c === '[') {
      pDepth++;
      normalized += c;
    } else if (c === ')' || c === ']') {
      pDepth = Math.max(0, pDepth - 1);
      normalized += c;
    } else if ((c === '\n' || c === '\r') && pDepth > 0) {
      normalized += ' ';
    } else {
      normalized += c;
    }
  }

  // Split into credit groups by semicolon or newline outside brackets
  const rawGroups: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if ((char === ';' || char === '\n' || char === '\r') && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) rawGroups.push(trimmed);
      current = '';
    } else {
      current += char;
    }
  }
  const lastTrimmed = current.trim();
  if (lastTrimmed) rawGroups.push(lastTrimmed);

  const lines: string[] = [];
  const parsed: ParsedCredit[] = [];
  const vendorMap = new Map<string, Set<string>>();
  const directList: string[] = [];

  for (let rawGroup of rawGroups) {
    let group = rawGroup.replace(/[;\s]+$/, '').replace(/\.\s*$/, '').trim();
    if (!group) continue;

    const firstBracket = group.search(/[\(\[]/);
    const bracketChar = firstBracket !== -1 ? group.charAt(firstBracket) : '';
    const closingChar = bracketChar === '(' ? ')' : ']';
    const lastBracket = firstBracket !== -1 ? group.lastIndexOf(closingChar) : -1;

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const agencyRaw = group.substring(0, firstBracket).trim();
      const insideRaw = group.substring(firstBracket + 1, lastBracket).trim();
      const agency = agencyRaw.replace(/[:\-–—\s]+$/, '').trim();

      const rawItems = splitAcknowledgementsWithExceptions(insideRaw, customExceptions);

      if (rawItems.length === 0 && agency) {
        // Single name with empty brackets -> NO SLASH
        lines.push(agency);
        parsed.push({ original: agency, vendor: "Direct", acknowledgement: agency });
        directList.push(agency);
      } else {
        for (const it of rawItems) {
          const cleanItem = it.trim().replace(/\s*\/\s*/g, '/');
          if (!cleanItem) continue;

          let lineItem = cleanItem;
          if (agency) {
            if (format === 'vendor-bracket') {
              lineItem = `${agency} (${cleanItem})`;
            } else if (format === 'vendor-credit') {
              const lowerAgency = agency.toLowerCase();
              if (cleanItem.toLowerCase().startsWith(lowerAgency + '/')) {
                lineItem = cleanItem;
              } else if (cleanItem.toLowerCase().endsWith('/' + lowerAgency)) {
                lineItem = `${agency}/${cleanItem.slice(0, -('/' + lowerAgency).length)}`;
              } else {
                lineItem = `${agency}/${cleanItem}`;
              }
            } else {
              // 'credit-vendor' or 'auto'
              const lowerAgency = agency.toLowerCase();
              if (cleanItem.toLowerCase().endsWith('/' + lowerAgency)) {
                lineItem = cleanItem;
              } else if (cleanItem.toLowerCase().startsWith(lowerAgency + '/')) {
                lineItem = `${cleanItem.slice((lowerAgency + '/').length)}/${agency}`;
              } else {
                lineItem = `${cleanItem}/${agency}`;
              }
            }
            parsed.push({ original: lineItem, vendor: agency, acknowledgement: cleanItem });
            if (!vendorMap.has(agency)) vendorMap.set(agency, new Set());
            vendorMap.get(agency)!.add(cleanItem);
          } else {
            // Bracket with no agency -> Direct, NO SLASH
            lineItem = cleanItem;
            parsed.push({ original: lineItem, vendor: "Direct", acknowledgement: cleanItem });
            directList.push(cleanItem);
          }
          lines.push(lineItem);
        }
      }
    } else {
      // Credits not in brackets (e.g. "Kevin" or "Company, LLC")
      // User Directive: "If there's a single name/ no brackets in grouped credits, then don't add slash in the list."
      const standaloneItems = splitAcknowledgementsWithExceptions(group, customExceptions);

      for (const item of standaloneItems) {
        lines.push(item); // NO SLASH
        parsed.push({ original: item, vendor: "Direct", acknowledgement: item });
        directList.push(item);
      }
    }
  }

  // Construct vendor groups
  interface CreditEntry {
    vendor: string;
    acknowledgements: string[];
    sortKey: string;
  }

  const allEntries: CreditEntry[] = [];

  for (const [vendor, acksSet] of vendorMap.entries()) {
    const sortedAcks = Array.from(acksSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    allEntries.push({
      vendor,
      acknowledgements: sortedAcks,
      sortKey: vendor.toLowerCase()
    });
  }

  const uniqueDirect = Array.from(new Set(directList));
  for (const name of uniqueDirect) {
    allEntries.push({
      vendor: "",
      acknowledgements: [name],
      sortKey: name.toLowerCase()
    });
  }

  allEntries.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }));

  const groups: VendorGroup[] = allEntries.map(e => ({
    vendor: e.vendor,
    acknowledgements: e.acknowledgements
  }));

  return { lines, parsed, groups };
}

export function parseCreditsToReverseList(
  creditsText: string,
  format: ListFormat = 'credit-vendor',
  customExceptions: string[] = []
): string[] {
  return parseCreditsToDetailed(creditsText, format, customExceptions).lines;
}

export const CreditsCreator: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [creditsText, setCreditsText] = useState('');
  const [creditsViewMode, setCreditsViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [listFormat, setListFormat] = useState<ListFormat>('credit-vendor');
  const [parsedData, setParsedData] = useState<ParsedCredit[]>([]);
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [customExceptionsText, setCustomExceptionsText] = useState<string>(() => {
    return localStorage.getItem('credits_comma_exceptions') || 'LLC, Inc, Ltd, Corp, Co, GmbH, Jr, Sr, Pty Ltd';
  });
  const [showExceptionEditor, setShowExceptionEditor] = useState(false);

  const customExceptionsList = useMemo(() => {
    return customExceptionsText.split(',').map(s => s.trim()).filter(Boolean);
  }, [customExceptionsText]);

  const [copyListStatus, setCopyListStatus] = useState(false);
  const [copyCreditsStatus, setCopyCreditsStatus] = useState(false);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'list' | 'credits' } | null>(null);
  const [isDraggingList, setIsDraggingList] = useState(false);
  const [isDraggingCredits, setIsDraggingCredits] = useState(false);
  const [panelHeight, setPanelHeight] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [isMappingsCollapsed, setIsMappingsCollapsed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = panelHeight;
  };

  const handleResizeTouchStart = (e: React.TouchEvent) => {
    setIsResizing(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = panelHeight;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaY = e.clientY - dragStartY.current;
      const newHeight = Math.max(160, Math.min(800, dragStartHeight.current + deltaY));
      setPanelHeight(newHeight);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing) return;
      const deltaY = e.touches[0].clientY - dragStartY.current;
      const newHeight = Math.max(160, Math.min(800, dragStartHeight.current + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing]);

  // Forward parse: List to Credits (Real-time sync)
  const handleListChange = useCallback((
    newVal: string, 
    fmt: ListFormat = listFormat,
    exceptions: string[] = customExceptionsList
  ) => {
    setInputText(newVal);

    // If user pasted grouped credits directly into the list input (has ; and brackets)
    if (newVal.includes(';') && (newVal.includes('(') || newVal.includes('['))) {
      const { lines, parsed, groups } = parseCreditsToDetailed(newVal, fmt, exceptions);
      setInputText(lines.join('\n'));
      setCreditsText(newVal);
      setParsedData(parsed);
      setVendorGroups(groups);
      return;
    }

    const { parsed, groups, creditsString } = parseListToCredits(newVal, fmt, exceptions);
    setParsedData(parsed);
    setVendorGroups(groups);
    setCreditsText(creditsString);
  }, [listFormat, customExceptionsList]);

  // Reverse parse: Credits to List (Real-time sync)
  const handleCreditsChange = useCallback((
    newVal: string, 
    fmt: ListFormat = listFormat, 
    exceptions: string[] = customExceptionsList
  ) => {
    setCreditsText(newVal);
    const { lines, parsed, groups } = parseCreditsToDetailed(newVal, fmt, exceptions);
    const listText = lines.join('\n');
    setInputText(listText);
    setParsedData(parsed);
    setVendorGroups(groups);
  }, [listFormat, customExceptionsList]);

  // Handle format toggle across both sections
  const handleFormatChange = (newFmt: ListFormat) => {
    setListFormat(newFmt);
    if (inputText.trim()) {
      if (creditsText.trim()) {
        // Re-generate list from current credits using new format
        handleCreditsChange(creditsText, newFmt, customExceptionsList);
      } else {
        handleListChange(inputText, newFmt, customExceptionsList);
      }
    }
  };

  const handleExceptionsChange = (newVal: string) => {
    setCustomExceptionsText(newVal);
    localStorage.setItem('credits_comma_exceptions', newVal);
    const updatedList = newVal.split(',').map(s => s.trim()).filter(Boolean);
    if (creditsText.trim()) {
      handleCreditsChange(creditsText, listFormat, updatedList);
    } else if (inputText.trim()) {
      handleListChange(inputText, listFormat, updatedList);
    }
  };

  const handleResetExceptions = () => {
    const defaultVal = 'LLC, Inc, Ltd, Corp, Co, GmbH, Jr, Sr, Pty Ltd';
    handleExceptionsChange(defaultVal);
  };

  const handleCopyList = () => {
    if (!inputText.trim()) return;
    navigator.clipboard.writeText(inputText).then(() => {
      setCopyListStatus(true);
      setTimeout(() => setCopyListStatus(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleCopyCredits = () => {
    if (!creditsText.trim()) return;
    navigator.clipboard.writeText(creditsText).then(() => {
      setCopyCreditsStatus(true);
      setTimeout(() => setCopyCreditsStatus(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handlePasteToList = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        handleListChange(clipText);
      }
    } catch {
      // Fallback
    }
  };

  const handlePasteToCredits = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        handleCreditsChange(clipText);
      }
    } catch {
      // Fallback
    }
  };

  const handleDownloadWord = async () => {
    if (vendorGroups.length === 0 && !creditsText.trim()) return;

    try {
      const defaultStyles = { font: "Calibri", size: 22 }; // 11pt
      const runs: TextRun[] = [];

      vendorGroups.forEach((group, index) => {
        const suffix = index === vendorGroups.length - 1 ? '.' : '; ';

        if (!group.vendor || group.vendor === 'Direct') {
          // Direct / standalone name with NO brackets
          runs.push(new TextRun({ text: group.acknowledgements[0] || "", ...defaultStyles }));
        } else {
          // Agency group
          const ackString = group.acknowledgements.join(', ');
          runs.push(new TextRun({ text: group.vendor, bold: true, ...defaultStyles }));
          runs.push(new TextRun({ text: " (", bold: true, ...defaultStyles }));
          runs.push(new TextRun({ text: ackString, ...defaultStyles }));
          runs.push(new TextRun({ text: ")", bold: true, ...defaultStyles }));
        }

        runs.push(new TextRun({ text: suffix, bold: true, ...defaultStyles }));
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Acknowledgements", bold: true, ...defaultStyles })],
            }),
            new Paragraph({ children: [new TextRun({ text: "", ...defaultStyles })] }),
            new Paragraph({ children: runs })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, "Standalone_Credits.docx");
    } catch (err) {
      console.error("Failed to generate DOCX:", err);
      alert("Failed to generate Word document.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        if (content.includes(';') && (content.includes('(') || content.includes('['))) {
          handleCreditsChange(content);
        } else {
          handleListChange(content);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Samples
  const loadSample1User = () => {
    // User requested example: Alamy Stock Photo (), OUP (Dave, John/Shutterstock), Shutterstock (Joe/Images, Pro)
    handleListChange(`OUP (Dave)\nJoão Carvalho\nNada Badran`);
  };

  const loadSample2Slash = () => {
    // Contributor/Agency + direct names
    handleListChange(`Dan/OUP\nJohn/OUP\nJoão Carvalho\nNada Badran\nCasey/Shutterstock`);
  };

  const loadSample3Reverse = () => {
    // Grouped credits reverse sample
    handleCreditsChange(`João Carvalho; Nada Badran; OUP (Dave).`);
  };

  const loadSample4Exceptions = () => {
    // Comma exceptions example
    handleCreditsChange(`OUP (Company, LLC, Company2); Kevin; Shutterstock (Casey, Anna Stills/ViewPics).`);
  };

  const clearAll = () => {
    setInputText('');
    setCreditsText('');
    setParsedData([]);
    setVendorGroups([]);
  };

  const listItemCount = inputText.trim() ? inputText.split('\n').filter(l => l.trim()).length : 0;
  const creditsCount = vendorGroups.length;

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 sm:p-4 text-left max-w-7xl mx-auto flex flex-col gap-3" id="credits-creator-root">
      
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Credits Creator</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full shadow-2xs">
              <ArrowLeftRight className="w-3 h-3 text-blue-600" />
              <span>Two-Way Realtime Sync</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center text-[11px] text-slate-500 gap-1.5 border-l border-slate-200 pl-2.5">
            <span>Changes on either side update the other instantly</span>
          </div>
        </div>

        {/* Global Controls & Preset Samples */}
        <div className="flex items-center gap-1.5 flex-wrap self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-slate-400 mr-0.5 hidden xl:inline">Load Samples:</span>
            <button 
              type="button"
              onClick={loadSample1User}
              className="px-2 py-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded border border-amber-200 transition-colors"
              title="Load user example: OUP (Dave), João Carvalho, Nada Badran"
            >
              <Sparkles className="w-2.5 h-2.5 inline mr-1 text-amber-600" />
              User Example
            </button>
            <button 
              type="button"
              onClick={loadSample2Slash}
              className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 transition-colors"
              title="Load slash sample: Contributor/Agency"
            >
              Slash List
            </button>
            <button 
              type="button"
              onClick={loadSample3Reverse}
              className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 transition-colors"
              title="Load grouped credits sample: João Carvalho; Nada Badran; OUP (Dave)."
            >
              Grouped Reverse
            </button>
            <button 
              type="button"
              onClick={loadSample4Exceptions}
              className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded border border-slate-200 transition-colors"
              title="Load comma exception sample: Company, LLC"
            >
              LLC / Inc. Sample
            </button>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="file"
              accept=".txt"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              title="Upload text file (.txt)"
            >
              <UploadIcon className="w-3 h-3 text-slate-500" />
              <span>Upload</span>
            </button>

            {(inputText.trim() || creditsText.trim()) && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                title="Clear both inputs"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Symmetrical Workspace (Two Peer Panels) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        
        {/* ================= LEFT PANEL: Credits List ================= */}
        <div className="flex flex-col bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          {/* Panel Header */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-slate-50/80 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <List className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800">Credits List</h3>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold px-1.5 py-0.2 rounded-full">
                {listItemCount} {listItemCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Symmetrical Format Selector */}
            <div className="flex items-center gap-1 flex-wrap">
              <div className="flex bg-white p-0.5 rounded border border-slate-200 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleFormatChange('credit-vendor')}
                  className={`px-1.5 py-0.5 rounded-sm font-semibold transition-all ${
                    listFormat === 'credit-vendor'
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Credit/Agency (e.g. Dave/OUP)"
                >
                  Credit/Agency
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('vendor-credit')}
                  className={`px-1.5 py-0.5 rounded-sm font-semibold transition-all ${
                    listFormat === 'vendor-credit'
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Agency/Credit (e.g. OUP/Dave)"
                >
                  Agency/Credit
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('vendor-bracket')}
                  className={`px-1.5 py-0.5 rounded-sm font-semibold transition-all ${
                    listFormat === 'vendor-bracket'
                      ? 'bg-blue-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Agency (Credit) (e.g. OUP (Dave))"
                >
                  Agency (Credit)
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyList}
                disabled={!inputText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                title="Copy single-line list"
              >
                {copyListStatus ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                <span>{copyListStatus ? 'Copied' : 'Copy'}</span>
              </button>

              {inputText.trim() && (
                <button
                  type="button"
                  onClick={() => handleListChange('')}
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Clear list"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Panel Body: Textarea */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDraggingList(true); }}
            onDragLeave={() => setIsDraggingList(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingList(false);
              const file = e.dataTransfer.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const content = ev.target?.result as string;
                  if (content) handleListChange(content);
                };
                reader.readAsText(file);
              }
            }}
            className={`p-2 flex flex-col transition-colors flex-grow ${
              isDraggingList ? 'bg-blue-50/40' : 'bg-white'
            }`}
          >
            <textarea
              style={{ height: `${panelHeight}px` }}
              className="w-full p-2.5 border border-slate-200 rounded-md focus:ring-1.5 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs md:text-sm resize-none leading-relaxed text-slate-800 focus:outline-none"
              placeholder={`Enter or paste credits here (one per line). Format examples:
OUP (Dave)
João Carvalho
Nada Badran

(Or slash format: Dave/OUP, Casey/Shutterstock)
* Standalone names without slashes are not grouped in brackets.`}
              value={inputText}
              onChange={(e) => handleListChange(e.target.value)}
            />

            {/* Symmetrical Drag Resize Handle */}
            <div 
              onMouseDown={handleResizeMouseDown}
              onTouchStart={handleResizeTouchStart}
              className={`h-2.5 w-full cursor-ns-resize flex items-center justify-center transition-colors group select-none mt-1 rounded ${
                isResizing ? 'bg-blue-100' : 'hover:bg-slate-100'
              }`}
              title="Drag up or down to resize both panels"
            >
              <div className="w-10 h-0.5 bg-slate-300 group-hover:bg-slate-400 rounded-full transition-colors flex gap-0.5 justify-center items-center">
                <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
              </div>
            </div>
          </div>

          {/* Panel Footer Controls */}
          <div className="p-2 bg-slate-50 border-t border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-600">
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                <span>No slash on line = Direct credit, never wrapped in brackets</span>
              </span>
            </div>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleListChange(inputText)}
                disabled={!inputText.trim()}
                className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                title="Format and update grouped credits"
              >
                <span>Update Grouped Credits</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handlePasteToList}
                className="px-2.5 py-1.5 text-xs bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded border border-slate-200 transition-colors flex items-center gap-1 shadow-2xs"
                title="Paste from clipboard into list"
              >
                <ClipboardPaste className="w-3 h-3 text-slate-500" />
                <span>Paste</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================= RIGHT PANEL: Grouped Credits ================= */}
        <div className="flex flex-col bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          {/* Panel Header */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-slate-50/80 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-800">Grouped Credits</h3>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-1.5 py-0.2 rounded-full">
                {creditsCount} {creditsCount === 1 ? 'credit' : 'credits'}
              </span>
            </div>

            {/* Symmetrical View / Action Selector */}
            <div className="flex items-center gap-1 flex-wrap">
              <div className="flex bg-white p-0.5 rounded border border-slate-200 text-[10px]">
                <button
                  type="button"
                  onClick={() => setCreditsViewMode('formatted')}
                  className={`px-1.5 py-0.5 rounded-sm font-semibold transition-all flex items-center gap-1 ${
                    creditsViewMode === 'formatted'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Formatted preview with bold vendors"
                >
                  <Eye className="w-2.5 h-2.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreditsViewMode('raw')}
                  className={`px-1.5 py-0.5 rounded-sm font-semibold transition-all flex items-center gap-1 ${
                    creditsViewMode === 'raw'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Raw editable text"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Edit / Paste</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyCredits}
                disabled={!creditsText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
                title="Copy grouped credits"
              >
                {copyCreditsStatus ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                <span>{copyCreditsStatus ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadWord}
                disabled={!creditsText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-40 transition-colors shadow-2xs"
                title="Download formatted Word Document (.docx)"
              >
                <FileWordIcon className="w-3 h-3 text-blue-500" />
                <span>Word</span>
              </button>

              {creditsText.trim() && (
                <button
                  type="button"
                  onClick={() => handleCreditsChange('')}
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Clear credits"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Panel Body: Preview or Raw Textarea */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDraggingCredits(true); }}
            onDragLeave={() => setIsDraggingCredits(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingCredits(false);
              const file = e.dataTransfer.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const content = ev.target?.result as string;
                  if (content) handleCreditsChange(content);
                };
                reader.readAsText(file);
              }
            }}
            className={`p-2 flex flex-col transition-colors flex-grow ${
              isDraggingCredits ? 'bg-emerald-50/40' : 'bg-white'
            }`}
          >
            {creditsViewMode === 'raw' || !creditsText.trim() ? (
              <textarea
                style={{ height: `${panelHeight}px` }}
                className="w-full p-2.5 border border-slate-200 rounded-md focus:ring-1.5 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-xs md:text-sm resize-none leading-relaxed text-slate-800 focus:outline-none"
                placeholder={`Paste grouped credits here to reverse unpack into list:
João Carvalho; Nada Badran; OUP (Dave).

Or:
OUP (Dan, John); Kevin; Shutterstock (Casey, Anna Stills/ViewPics).

* Single names without brackets are unpacked with NO slashes.`}
                value={creditsText}
                onChange={(e) => handleCreditsChange(e.target.value)}
              />
            ) : (
              <div
                tabIndex={0}
                style={{ height: `${panelHeight}px` }}
                className="w-full p-2.5 border border-slate-200 rounded-md text-xs md:text-sm leading-relaxed text-slate-800 select-all font-sans overflow-y-auto bg-slate-50/30 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                title="Click to select all, or switch to Edit mode to modify"
              >
                {vendorGroups.map((group, index) => {
                  const suffix = index === vendorGroups.length - 1 ? '.' : '; ';

                  if (!group.vendor || group.vendor === 'Direct') {
                    // Direct standalone credit, NO BRACKETS!
                    return (
                      <span key={index} className="inline">
                        <span className="text-slate-800 font-medium">{group.acknowledgements[0]}</span>
                        <strong className="text-slate-900 font-bold">{suffix}</strong>
                        <span> </span>
                      </span>
                    );
                  }

                  const ackString = group.acknowledgements.join(', ');
                  return (
                    <span key={index} className="inline">
                      <strong className="text-slate-900 font-bold">{group.vendor}</strong>
                      <span> </span>
                      <strong className="text-slate-900 font-bold">(</strong>
                      <span className="text-slate-800">{ackString}</span>
                      <strong className="text-slate-900 font-bold">)</strong>
                      <strong className="text-slate-900 font-bold">{suffix}</strong>
                      <span> </span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Symmetrical Drag Resize Handle */}
            <div 
              onMouseDown={handleResizeMouseDown}
              onTouchStart={handleResizeTouchStart}
              className={`h-2.5 w-full cursor-ns-resize flex items-center justify-center transition-colors group select-none mt-1 rounded ${
                isResizing ? 'bg-emerald-100' : 'hover:bg-slate-100'
              }`}
              title="Drag up or down to resize both panels"
            >
              <div className="w-10 h-0.5 bg-slate-300 group-hover:bg-slate-400 rounded-full transition-colors flex gap-0.5 justify-center items-center">
                <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
              </div>
            </div>
          </div>

          {/* Panel Footer Controls */}
          <div className="p-2 bg-slate-50 border-t border-slate-200 flex flex-col gap-1.5">
            {/* Comma Exceptions Pill & Customizer */}
            <div className="flex flex-col text-[10px] bg-white rounded border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between p-1 px-1.5 bg-slate-50/70">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-semibold text-slate-700 shrink-0">Comma Exceptions:</span>
                  <span 
                    className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 font-mono px-1 py-0.2 rounded truncate max-w-[150px] sm:max-w-[200px]"
                    title={`Active exceptions: ${customExceptionsList.join(', ')}`}
                  >
                    {customExceptionsList.slice(0, 4).join(', ')}... ({customExceptionsList.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExceptionEditor(!showExceptionEditor)}
                  className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-semibold px-1 py-0.5 rounded hover:bg-blue-50 transition-colors ml-1 shrink-0"
                  title="View or edit corporate suffix exceptions"
                >
                  <SlidersHorizontal className="w-2.5 h-2.5" />
                  <span>{showExceptionEditor ? 'Hide' : 'Customize'}</span>
                </button>
              </div>

              {showExceptionEditor && (
                <div className="p-2 bg-amber-50/40 border-t border-slate-100 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-amber-950 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-amber-700" />
                      Words where comma is part of credit (e.g. LLC, Inc.):
                    </span>
                    <button
                      type="button"
                      onClick={handleResetExceptions}
                      className="flex items-center gap-0.5 text-[9px] text-amber-800 hover:text-amber-950 underline font-medium"
                      title="Reset to default exceptions"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Reset
                    </button>
                  </div>

                  <input
                    type="text"
                    value={customExceptionsText}
                    onChange={(e) => handleExceptionsChange(e.target.value)}
                    placeholder="e.g. LLC, Inc, Ltd, Corp, Co, GmbH, Jr, Sr, Pty Ltd"
                    className="w-full bg-white border border-amber-300 rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                  <div className="text-[9px] text-slate-500 leading-tight">
                    Example: <code className="font-mono bg-white px-1 py-0.2 rounded border border-amber-200">OUP(Company, LLC, Company2)</code> becomes 2 credits: <span className="font-semibold text-slate-700">Company, LLC</span> and <span className="font-semibold text-slate-700">Company2</span>.
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleCreditsChange(creditsText)}
                disabled={!creditsText.trim()}
                className="flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                title="Convert grouped credits into one credit per line in the list"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Update Credits List</span>
              </button>

              <button
                type="button"
                onClick={handlePasteToCredits}
                className="px-2.5 py-1.5 text-xs bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded border border-slate-200 transition-colors flex items-center gap-1 shadow-2xs"
                title="Paste from clipboard into credits"
              >
                <ClipboardPaste className="w-3 h-3 text-slate-500" />
                <span>Paste</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Parsed Mapping Details Collapsible Table */}
      <div className="border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => setIsMappingsCollapsed(!isMappingsCollapsed)}
          className="flex items-center justify-between w-full text-left py-1 px-1.5 hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-slate-100"
        >
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            {isMappingsCollapsed ? (
              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5 text-slate-500" />
            )}
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Parsed Record Breakdown ({parsedData.length} records)</span>
          </h3>
          <span className="text-[10px] text-blue-600 font-semibold hover:underline">
            {isMappingsCollapsed ? 'Show Table' : 'Hide Table'}
          </span>
        </button>
        
        {!isMappingsCollapsed && parsedData.length > 0 && (
          <div className="overflow-auto border border-slate-200 rounded max-h-[180px] mt-1 shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-1.5 text-[10px] font-bold text-slate-600">Vendor / Agency</th>
                  <th className="px-3 py-1.5 text-[10px] font-bold text-slate-600">Acknowledgement</th>
                  <th className="px-3 py-1.5 text-[10px] font-bold text-slate-600">Original Item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {parsedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-1 text-[10px] text-slate-800 font-semibold">
                      {row.vendor === 'Direct' ? <span className="text-slate-400 italic">Direct (No Vendor)</span> : row.vendor}
                    </td>
                    <td className="px-3 py-1 text-[10px] text-slate-800">{row.acknowledgement}</td>
                    <td className="px-3 py-1 text-[10px] text-slate-400 font-mono truncate max-w-[240px]" title={row.original}>
                      {row.original}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
