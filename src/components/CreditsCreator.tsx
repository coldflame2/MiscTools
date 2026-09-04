import React, { useState, useRef, useEffect } from 'react';
import { CopyIcon } from './icons/CopyIcon';
import { FileWordIcon } from './icons/FileWordIcon';
import { UploadIcon } from './icons/UploadIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ArrowLeft, ArrowRight, ArrowLeftRight, Check, Copy, Trash2, Eye, Edit3, Sparkles } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import saveAs from "file-saver";

interface ParsedCredit {
  original: string;
  vendor: string;
  acknowledgement: string;
}

interface VendorGroup {
  vendor: string;
  acknowledgements: string[];
}

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
  'adobe',
  'dreamstime',
  'depositphotos',
  '123rf'
];

const cleanAcknowledgement = (ack: string, source: string): string => {
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

const standardizeVendor = (vendor: string): string => {
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

const getVendorScore = (part: string): number => {
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

/**
 * Parses individual credit lines (e.g. Dan/OUP, Kevin) into grouped credits
 */
export function parseListToCredits(
  text: string,
  vendorPosition: 'auto' | 'start' | 'end'
): { parsed: ParsedCredit[]; groups: VendorGroup[]; creditsString: string } {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const parsed: ParsedCredit[] = [];

  lines.forEach(line => {
    const parts = line.split(/[\/|\\\t]/).map(p => p.trim()).filter(p => p);
    
    let vendor = "";
    let ack = line;

    if (parts.length >= 2) {
      if (vendorPosition === 'start') {
        vendor = parts[0].replace(/\s*\/\s*/g, '/');
        ack = parts.slice(1).join('/');
      } else if (vendorPosition === 'end') {
        vendor = parts[parts.length - 1].replace(/\s*\/\s*/g, '/');
        ack = parts.slice(0, -1).join('/');
      } else {
        let bestIndex = 0;
        let maxScore = -1;
        for (let i = 0; i < parts.length; i++) {
          const score = getVendorScore(parts[i]);
          if (score > maxScore) {
            maxScore = score;
            bestIndex = i;
          }
        }
        
        vendor = standardizeVendor(parts[bestIndex]);
        const remainingParts = parts.filter((_, idx) => idx !== bestIndex);
        ack = remainingParts.join('/');
      }
    } else {
      if (vendorPosition !== 'auto') {
        vendor = line.trim().replace(/\s*\/\s*/g, '/');
        ack = line.trim();
      } else {
        const score = getVendorScore(line);
        if (score > 0) {
          vendor = standardizeVendor(line);
          ack = line;
        } else {
          // Direct / standalone item with no vendor
          vendor = "";
          ack = line;
        }
      }
    }

    const cleanedAck = vendor ? cleanAcknowledgement(ack, vendor) : ack;
    const cleanedOriginal = line.replace(/\s*\/\s*/g, '/');

    parsed.push({
      original: cleanedOriginal,
      vendor: vendor || "Direct",
      acknowledgement: (cleanedAck || ack).replace(/\s*\/\s*/g, '/')
    });
  });

  // Grouping
  const groupedMap = new Map<string, Set<string>>();
  parsed.forEach(item => {
    const vKey = item.vendor === "Direct" ? "" : item.vendor;
    if (!groupedMap.has(vKey)) {
      groupedMap.set(vKey, new Set());
    }
    groupedMap.get(vKey)!.add(item.acknowledgement);
  });

  // Sort vendors alphabetically, placing non-direct agencies first and direct/standalone at the end
  const sortedKeys = Array.from(groupedMap.keys()).sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  const groups: VendorGroup[] = sortedKeys.map(key => {
    const acksSet = groupedMap.get(key)!;
    const sortedAcks = Array.from(acksSet).sort((a, b) => a.localeCompare(b));
    return {
      vendor: key,
      acknowledgements: sortedAcks
    };
  });

  const creditsString = groups.map((group, index) => {
    const suffix = index === groups.length - 1 ? '.' : '; ';
    const ackString = group.acknowledgements.join(', ');
    if (!group.vendor || group.vendor === 'Direct') {
      return `${ackString}${suffix}`;
    }
    return `${group.vendor} (${ackString})${suffix}`;
  }).join('');

  return { parsed, groups, creditsString };
}

/**
 * Reverse parses grouped credits (e.g. OUP (Dan, John); Kevin; Shutterstock (Casey, Anna Stills/ViewPics).)
 * into a list of single-line credits:
 * Dan/OUP
 * John/OUP
 * Kevin
 * Casey/Shutterstock
 * Anna Stills/ViewPics/Shutterstock
 */
export function parseCreditsToReverseList(creditsText: string): string[] {
  if (!creditsText || !creditsText.trim()) return [];

  // Parse into groups separated by semicolon or newline when outside brackets/parentheses
  const rawGroups: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < creditsText.length; i++) {
    const char = creditsText[i];
    if (char === '(' || char === '[') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']') {
      depth = Math.max(0, depth - 1);
      current += char;
    } else if ((char === ';' || char === '\n' || char === '\r') && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) {
        rawGroups.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }
  const lastTrimmed = current.trim();
  if (lastTrimmed) {
    rawGroups.push(lastTrimmed);
  }

  const result: string[] = [];

  for (let group of rawGroups) {
    // Strip trailing semicolons, periods and whitespace
    group = group.replace(/[;\s]+$/, '').replace(/\.\s*$/, '').trim();
    if (!group) continue;

    // Matches Agency before "(" or "[" and the contents inside
    const match = group.match(/^(.*?)\s*[\(\[]([^()\[\]]+)[\)\]]\s*$/);
    if (match) {
      const agency = match[1].trim();
      const inside = match[2].trim();

      // Split credits inside brackets by comma
      const items = inside
        .split(',')
        .map(it => it.trim().replace(/\.\s*$/, ''))
        .filter(Boolean);

      if (items.length === 0) {
        if (agency) result.push(agency);
      } else {
        for (const it of items) {
          if (agency) {
            // Avoid duplicate suffix if item already ends with /agency
            const lowerAgency = agency.toLowerCase();
            if (it.toLowerCase().endsWith('/' + lowerAgency)) {
              result.push(it);
            } else {
              result.push(`${it}/${agency}`);
            }
          } else {
            result.push(it);
          }
        }
      }
    } else {
      // Credits not in brackets (e.g. "Kevin")
      // Written directly without slash
      result.push(group);
    }
  }

  return result;
}

export const CreditsCreator: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [creditsText, setCreditsText] = useState('');
  const [creditsViewMode, setCreditsViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [vendorPosition, setVendorPosition] = useState<'auto' | 'start' | 'end'>('auto');
  const [parsedData, setParsedData] = useState<ParsedCredit[]>([]);
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [copyListStatus, setCopyListStatus] = useState(false);
  const [copyCreditsStatus, setCopyCreditsStatus] = useState(false);
  const [reverseNotice, setReverseNotice] = useState<string | null>(null);
  const [isDraggingList, setIsDraggingList] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [isMappingsCollapsed, setIsMappingsCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = previewHeight;
  };

  const handleResizeTouchStart = (e: React.TouchEvent) => {
    setIsResizing(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = previewHeight;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaY = e.clientY - dragStartY.current;
      const newHeight = Math.max(80, Math.min(800, dragStartHeight.current + deltaY));
      setPreviewHeight(newHeight);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing) return;
      const deltaY = e.touches[0].clientY - dragStartY.current;
      const newHeight = Math.max(80, Math.min(800, dragStartHeight.current + deltaY));
      setPreviewHeight(newHeight);
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

  // Forward parse: List to Credits
  const handleListChange = (newVal: string, pos = vendorPosition) => {
    setInputText(newVal);
    const { parsed, groups, creditsString } = parseListToCredits(newVal, pos);
    setParsedData(parsed);
    setVendorGroups(groups);
    setCreditsText(creditsString);
    setReverseNotice(null);
  };

  // Reverse parse: Credits to List
  const handleCreditsChange = (newVal: string) => {
    setCreditsText(newVal);
    const lines = parseCreditsToReverseList(newVal);
    const listText = lines.join('\n');
    setInputText(listText);

    const { parsed, groups } = parseListToCredits(listText, vendorPosition);
    setParsedData(parsed);
    setVendorGroups(groups);

    if (lines.length > 0) {
      setReverseNotice(`Unpacked ${lines.length} credit items into the list`);
      setTimeout(() => setReverseNotice(null), 4000);
    } else {
      setReverseNotice(null);
    }
  };

  // Handle explicit vendor position selection
  const handleVendorPositionChange = (newPos: 'auto' | 'start' | 'end') => {
    setVendorPosition(newPos);
    handleListChange(inputText, newPos);
  };

  // Direct paste on Credits section (whether in formatted preview or textarea)
  const handleCreditsPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && pasted.trim()) {
      handleCreditsChange(pasted);
    }
  };

  // Paste from clipboard button on Credits section
  const handlePasteCreditsFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.trim()) {
        handleCreditsChange(clipText);
      }
    } catch (err) {
      console.error("Could not read clipboard:", err);
      alert("Please press Ctrl+V directly into the Credits box to paste.");
    }
  };

  const handleCopyList = () => {
    if (!inputText.trim()) return;
    navigator.clipboard.writeText(inputText).then(() => {
      setCopyListStatus(true);
      setTimeout(() => setCopyListStatus(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard.');
    });
  };

  const handleCopyCredits = () => {
    if (!creditsText.trim()) return;
    navigator.clipboard.writeText(creditsText).then(() => {
      setCopyCreditsStatus(true);
      setTimeout(() => setCopyCreditsStatus(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard.');
    });
  };

  const handleDownloadWord = async () => {
    if (vendorGroups.length === 0 && !creditsText.trim()) return;

    try {
      const defaultStyles = { font: "Calibri", size: 22 }; // 11pt
      const runs: TextRun[] = [];

      vendorGroups.forEach((group, index) => {
        const ackString = group.acknowledgements.join(', ');
        const suffix = index === vendorGroups.length - 1 ? '.' : '; ';

        if (!group.vendor || group.vendor === 'Direct') {
          runs.push(new TextRun({ text: ackString, ...defaultStyles }));
        } else {
          runs.push(new TextRun({ text: group.vendor, bold: true, ...defaultStyles }));
          runs.push(new TextRun({ text: " ", ...defaultStyles }));
          runs.push(new TextRun({ text: "(", bold: true, ...defaultStyles }));
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

  // Drag and Drop for List input
  const handleDragOverList = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingList(true);
  };

  const handleDragLeaveList = () => {
    setIsDraggingList(false);
  };

  const handleDropList = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingList(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/plain" || file.name.endsWith('.txt'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const content = event.target.result as string;
          // Check if file content is grouped credits format
          if (content.includes(';') && (content.includes('(') || content.includes('['))) {
            handleCreditsChange(content);
          } else {
            handleListChange(content);
          }
        }
      };
      reader.readAsText(file);
    } else {
      alert("Please upload a valid plain text (.txt) file.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const content = event.target.result as string;
          if (content.includes(';') && (content.includes('(') || content.includes('['))) {
            handleCreditsChange(content);
          } else {
            handleListChange(content);
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const loadExample1 = () => {
    handleListChange(`Shutterstock/Monkey Business Images
Getty Images/Morphart Creation
Alamy/National Geographic
Shutterstock/Rawpixel.com
Alamy/John Smith`, 'start');
    setVendorPosition('start');
  };

  const loadExample2 = () => {
    handleListChange(`Monkey Business Images/Shutterstock
Morphart Creation/Getty Images
National Geographic/Alamy
Rawpixel.com/Shutterstock
Jane Doe/iStock`, 'end');
    setVendorPosition('end');
  };

  const loadReverseExample = () => {
    const sample = `OUP (Dan, John); Kevin; Shutterstock (Casey, Anna Stills/ViewPics).`;
    handleCreditsChange(sample);
  };

  // Check if text in list box looks like formatted credits (e.g. user pasted formatted credits in left box)
  const looksLikeGroupedCredits = inputText.includes(';') && (inputText.includes('(') || inputText.includes('['));

  return (
    <div className="bg-white rounded-xl shadow-md p-2.5 sm:p-3 text-left max-w-7xl mx-auto" id="credits-creator-root">
      {/* Header & Toolbelt */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pb-2 mb-2.5 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800 shrink-0">Credits Creator</h2>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              <ArrowLeftRight className="w-3 h-3" />
              Two-Way Reverse
            </span>
          </div>
          
          {/* Vendor Position selector for List parsing */}
          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 self-start md:self-center">
            <button
              type="button"
              onClick={() => handleVendorPositionChange('auto')}
              className={`px-2 py-1 text-[10px] font-semibold rounded-sm transition-all ${
                vendorPosition === 'auto'
                  ? 'bg-white text-blue-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Auto-Detect (Smart Scoring)"
            >
              Auto-Detect
            </button>
            <button
              type="button"
              onClick={() => handleVendorPositionChange('start')}
              className={`px-2 py-1 text-[10px] font-semibold rounded-sm transition-all ${
                vendorPosition === 'start'
                  ? 'bg-white text-blue-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Start of line (e.g. Alamy/Contributor)"
            >
              Vendor First
            </button>
            <button
              type="button"
              onClick={() => handleVendorPositionChange('end')}
              className={`px-2 py-1 text-[10px] font-semibold rounded-sm transition-all ${
                vendorPosition === 'end'
                  ? 'bg-white text-blue-600 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="End of line (e.g. Contributor/Alamy)"
            >
              Vendor Last
            </button>
          </div>
        </div>

        {/* Samples & Upload */}
        <div className="flex items-center gap-1.5 self-end sm:self-center flex-wrap">
          <span className="text-[10px] text-slate-400 mr-0.5 hidden lg:inline">Samples:</span>
          <button 
            onClick={loadExample1}
            className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200 transition-colors"
            title="Load list sample: Vendor/Credit"
          >
            Sample 1
          </button>
          <button 
            onClick={loadExample2}
            className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200 transition-colors"
            title="Load list sample: Credit/Vendor"
          >
            Sample 2
          </button>
          <button 
            onClick={loadReverseExample}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded border border-amber-200 transition-colors"
            title="Load grouped credits sample: OUP (Dan, John); Kevin; Shutterstock (Casey, Anna Stills/ViewPics)."
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            Reverse Sample
          </button>
          <span className="h-4 w-[1px] bg-slate-200 mx-0.5"></span>
          <input
            type="file"
            accept=".txt"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
            title="Upload .txt file"
          >
            <UploadIcon className="w-3 h-3 text-slate-500" />
            Upload
          </button>
        </div>
      </div>

      {/* Main workspace layout: 2 columns with clear bidirectional sync */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Left Column: Credit List */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1 px-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-800">Credits List</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.2 rounded">
                {inputText.trim() ? inputText.split('\n').filter(l => l.trim()).length : 0} items
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyList}
                disabled={!inputText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
                title="Copy single-line credits list"
              >
                {copyListStatus ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                <span>{copyListStatus ? 'Copied' : 'Copy List'}</span>
              </button>
              {inputText.trim() && (
                <button
                  type="button"
                  onClick={() => handleListChange('')}
                  className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Clear list"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div 
            onDragOver={handleDragOverList}
            onDragLeave={handleDragLeaveList}
            onDrop={handleDropList}
            className={`flex-grow flex flex-col rounded-lg border border-dashed p-1.5 transition-colors ${
              isDraggingList ? 'border-blue-500 bg-blue-50/40' : 'border-slate-250'
            }`}
          >
            {/* Helpful banner if user pasted grouped credits into the list box */}
            {looksLikeGroupedCredits && (
              <div className="mb-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-center justify-between gap-2">
                <span>Grouped credits detected in list!</span>
                <button
                  type="button"
                  onClick={() => handleCreditsChange(inputText)}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded transition-colors shrink-0"
                >
                  Unpack to List
                </button>
              </div>
            )}

            <textarea
              className="w-full h-[300px] md:h-[400px] p-2 border border-slate-200 rounded-md focus:ring-1.5 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs md:text-sm resize-none mb-1.5 leading-relaxed"
              placeholder={`Enter or paste credits here (one per line). Format examples:
Dan/OUP
John/OUP
Kevin
Casey/Shutterstock
Anna Stills/ViewPics/Shutterstock`}
              value={inputText}
              onChange={(e) => handleListChange(e.target.value)}
            />

            <button
              onClick={() => handleListChange(inputText)}
              disabled={!inputText.trim()}
              className="w-full py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Generate Credits</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Grouped Credits (Editable & Reverse Generation) */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1 px-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-800">Credits (Grouped)</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.2 rounded">
                {vendorGroups.length} groups
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Toggle view mode: Formatted vs Raw Edit/Paste */}
              <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreditsViewMode('formatted')}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-all flex items-center gap-1 ${
                    creditsViewMode === 'formatted'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Formatted preview with bold vendors"
                >
                  <Eye className="w-2.5 h-2.5" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreditsViewMode('raw')}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-all flex items-center gap-1 ${
                    creditsViewMode === 'raw'
                      ? 'bg-white text-blue-600 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Direct editable text / paste area"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Edit / Paste</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyCredits}
                disabled={!creditsText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
                title="Copy grouped credits"
              >
                {copyCreditsStatus ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                <span>{copyCreditsStatus ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadWord}
                disabled={!creditsText.trim()}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-40 transition-colors"
                title="Download Word Document"
              >
                <FileWordIcon className="w-3 h-3 text-blue-500" />
                <span>Word</span>
              </button>

              {creditsText.trim() && (
                <button
                  type="button"
                  onClick={() => handleCreditsChange('')}
                  className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Clear credits"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Credits Content Box */}
          <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-200 flex flex-col flex-grow">
            {/* Reverse notification toast */}
            {reverseNotice && (
              <div className="mb-1.5 p-1 px-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800 font-semibold flex items-center gap-1 animate-fade-in">
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>{reverseNotice}</span>
              </div>
            )}

            {/* Display Mode: Raw Edit/Paste OR Formatted Preview */}
            {creditsViewMode === 'raw' || !creditsText.trim() ? (
              <div className="flex flex-col flex-grow">
                <textarea
                  className="w-full h-[300px] md:h-[400px] p-2 border border-slate-200 rounded-md focus:ring-1.5 focus:ring-emerald-500 focus:border-emerald-500 font-sans text-xs md:text-sm resize-none mb-1.5 leading-relaxed bg-white text-slate-800"
                  placeholder={`Paste grouped credits here to generate reverse list:
OUP (Dan, John); Kevin; Shutterstock (Casey, Anna Stills/ViewPics).

Items separated by semicolons; agency prefix outside brackets attaches to credits with /; credits without brackets are preserved directly.`}
                  value={creditsText}
                  onChange={(e) => handleCreditsChange(e.target.value)}
                  onPaste={handleCreditsPaste}
                />
              </div>
            ) : (
              <div className="flex flex-col flex-grow">
                <div 
                  tabIndex={0}
                  onPaste={handleCreditsPaste}
                  style={{ height: `${previewHeight}px` }}
                  className="bg-white p-2.5 rounded-t border-t border-x border-slate-200 text-xs md:text-sm leading-relaxed text-slate-800 select-all font-sans overflow-y-auto flex-grow focus:outline-none focus:ring-1 focus:ring-blue-400"
                  title="Click to select all, or paste new credits to reverse"
                >
                  {vendorGroups.map((group, index) => {
                    const ackString = group.acknowledgements.join(', ');
                    const suffix = index === vendorGroups.length - 1 ? '.' : '; ';

                    if (!group.vendor || group.vendor === 'Direct') {
                      return (
                        <span key={index}>
                          <span>{ackString}</span>
                          <strong className="text-slate-900">{suffix}</strong>
                        </span>
                      );
                    }

                    return (
                      <span key={index}>
                        <strong className="text-slate-900">{group.vendor}</strong>
                        <span> </span>
                        <strong className="text-slate-900">(</strong>
                        <span>{ackString}</span>
                        <strong className="text-slate-900">)</strong>
                        <strong className="text-slate-900">{suffix}</strong>
                      </span>
                    );
                  })}
                </div>

                {/* Drag resize handle */}
                <div 
                  onMouseDown={handleResizeMouseDown}
                  onTouchStart={handleResizeTouchStart}
                  className={`h-2 w-full border-b border-x rounded-b cursor-ns-resize flex items-center justify-center transition-colors group select-none ${
                    isResizing 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                  }`}
                  title="Drag up or down to resize preview"
                >
                  <div className="w-8 h-0.5 bg-slate-300 group-hover:bg-slate-400 group-active:bg-slate-500 rounded-full transition-colors flex gap-0.5 justify-center items-center">
                    <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                    <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                    <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom action for Credits Section: Generate Reverse List */}
            <div className="mt-1.5 flex gap-1.5">
              <button
                onClick={() => handleCreditsChange(creditsText)}
                disabled={!creditsText.trim()}
                className="flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                title="Convert grouped credits into one credit per line in the list"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Generate List (Reverse)</span>
              </button>

              <button
                type="button"
                onClick={handlePasteCreditsFromClipboard}
                className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-200 transition-colors flex items-center gap-1"
                title="Paste from clipboard and unpack"
              >
                <span>Paste</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Parsed Mapping Table */}
      <div className="mt-3 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => setIsMappingsCollapsed(!isMappingsCollapsed)}
          className="flex items-center justify-between w-full text-left py-1 px-1.5 hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-slate-100"
        >
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1">
            {isMappingsCollapsed ? (
              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5 text-slate-500" />
            )}
            View Detailed Mappings ({parsedData.length})
          </h3>
          <span className="text-[10px] text-blue-600 font-semibold hover:underline">
            {isMappingsCollapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
        
        {!isMappingsCollapsed && parsedData.length > 0 && (
          <div className="overflow-auto border border-slate-200 rounded max-h-[160px] mt-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-2.5 py-1 text-[10px] font-bold text-slate-600">Vendor / Agency</th>
                  <th className="px-2.5 py-1 text-[10px] font-bold text-slate-600">Acknowledgement</th>
                  <th className="px-2.5 py-1 text-[10px] font-bold text-slate-600">Original Item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {parsedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-2.5 py-1 text-[10px] text-slate-800 font-semibold">
                      {row.vendor === 'Direct' ? <span className="text-slate-400 italic">Direct</span> : row.vendor}
                    </td>
                    <td className="px-2.5 py-1 text-[10px] text-slate-800">{row.acknowledgement}</td>
                    <td className="px-2.5 py-1 text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={row.original}>
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
