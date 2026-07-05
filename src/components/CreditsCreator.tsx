import React, { useState, useRef, useEffect } from 'react';
import { CopyIcon } from './icons/CopyIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { FileWordIcon } from './icons/FileWordIcon';
import { UploadIcon } from './icons/UploadIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
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
  
  // Title case capitalization as standard
  return vendor.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const getVendorScore = (part: string): number => {
  const lower = part.toLowerCase().trim();

  // OUP is the primary vendor - highest priority
  if (lower === 'oup' || lower.includes('oxford university press')) {
    return 1000;
  }

  let score = 0;

  // Exact matches in COMMON_VENDORS
  if (COMMON_VENDORS.includes(lower)) {
    score = 10;
  } else {
    // Check starts/ends with or is contained in common vendors
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

  // Mega-vendor priority bonus (e.g. Alamy, Getty, Shutterstock)
  // This ensures they win over other sub-vendors/agencies like "Associated Press" or "Reuters"
  for (const mv of MEGA_VENDORS) {
    if (lower.includes(mv)) {
      score += 100;
      break;
    }
  }

  return score;
};

export const CreditsCreator: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [vendorPosition, setVendorPosition] = useState<'auto' | 'start' | 'end'>('auto');
  const [parsedData, setParsedData] = useState<ParsedCredit[]>([]);
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [isDragging, setIsDragging] = useState(false);
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
      // Clamp between 80px and 800px
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

  const handleParse = () => {
    const lines = inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsed: ParsedCredit[] = [];

    lines.forEach(line => {
      // Split by common delimiters: /, |, \
      const parts = line.split(/[\/|\\\t]/).map(p => p.trim()).filter(p => p);
      
      let vendor = "Unknown";
      let ack = line;

      if (parts.length >= 2) {
        if (vendorPosition === 'start') {
          vendor = parts[0].replace(/\s*\/\s*/g, '/');
          ack = parts.slice(1).join('/');
        } else if (vendorPosition === 'end') {
          vendor = parts[parts.length - 1].replace(/\s*\/\s*/g, '/');
          ack = parts.slice(0, -1).join('/');
        } else {
          // Auto-detect based on score across all parts
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
        // Only one part
        if (vendorPosition !== 'auto') {
          vendor = line.trim().replace(/\s*\/\s*/g, '/');
          ack = line.trim();
        } else {
          // Only one part - check if it contains a known vendor name
          const score = getVendorScore(line);
          if (score > 0) {
            // If it matches a known vendor but has no separate acknowledgement,
            // treat it as the vendor and acknowledgment of the vendor.
            vendor = standardizeVendor(line);
            ack = line;
          } else {
            vendor = "Unknown";
            ack = line;
          }
        }
      }

      // Clean the acknowledgment
      const cleanedAck = cleanAcknowledgement(ack, vendor);
      const cleanedOriginal = line.replace(/\s*\/\s*/g, '/');

      parsed.push({
        original: cleanedOriginal,
        vendor,
        acknowledgement: (cleanedAck || ack).replace(/\s*\/\s*/g, '/') // fallback to original ack if cleaning emptied it
      });
    });

    setParsedData(parsed);

    // Group and Sort
    const groupedMap = new Map<string, Set<string>>();
    parsed.forEach(item => {
      if (!groupedMap.has(item.vendor)) {
        groupedMap.set(item.vendor, new Set());
      }
      groupedMap.get(item.vendor)!.add(item.acknowledgement);
    });

    // Sort vendors alphabetically
    const sortedVendors = Array.from(groupedMap.keys()).sort((a, b) => a.localeCompare(b));

    const groups: VendorGroup[] = sortedVendors.map(vendor => {
      const acksSet = groupedMap.get(vendor)!;
      // Sort acknowledgements alphabetically
      const sortedAcks = Array.from(acksSet).sort((a, b) => a.localeCompare(b));
      return {
        vendor,
        acknowledgements: sortedAcks
      };
    });

    setVendorGroups(groups);
  };

  // Run parsing reactively when input text or selection changes
  React.useEffect(() => {
    handleParse();
  }, [inputText, vendorPosition]);

  const getPlainTextOutput = () => {
    if (vendorGroups.length === 0) return '';
    return vendorGroups.map((group, index) => {
      const ackString = group.acknowledgements.join(', ');
      const suffix = index === vendorGroups.length - 1 ? '.' : '; ';
      return `${group.vendor} (${ackString})${suffix}`;
    }).join('');
  };

  const handleCopyText = () => {
    const text = getPlainTextOutput();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard.');
    });
  };

  const handleDownloadWord = async () => {
    if (vendorGroups.length === 0) return;

    try {
      const defaultStyles = { font: "Calibri", size: 22 }; // 11pt
      const runs: TextRun[] = [];

      vendorGroups.forEach((group, index) => {
        const ackString = group.acknowledgements.join(', ');

        runs.push(new TextRun({ text: group.vendor, bold: true, ...defaultStyles }));
        runs.push(new TextRun({ text: " ", ...defaultStyles }));
        runs.push(new TextRun({ text: "(", bold: true, ...defaultStyles }));
        runs.push(new TextRun({ text: ackString, ...defaultStyles }));
        runs.push(new TextRun({ text: ")", bold: true, ...defaultStyles }));

        if (index === vendorGroups.length - 1) {
          runs.push(new TextRun({ text: ".", ...defaultStyles }));
        } else {
          runs.push(new TextRun({ text: "; ", bold: true, ...defaultStyles }));
        }
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

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === "text/plain" || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setInputText(event.target.result as string);
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
          setInputText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const loadExample1 = () => {
    setInputText(`Shutterstock/Monkey Business Images
Getty Images/Morphart Creation
Alamy/National Geographic
Shutterstock/Rawpixel.com
Alamy/John Smith`);
    setVendorPosition('start');
  };

  const loadExample2 = () => {
    setInputText(`Monkey Business Images/Shutterstock
Morphart Creation/Getty Images
National Geographic/Alamy
Rawpixel.com/Shutterstock
Jane Doe/iStock`);
    setVendorPosition('end');
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-2.5 sm:p-3 text-left max-w-7xl mx-auto" id="credits-creator-root">
      {/* Compact Header & Toolbelt - Front and Top */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pb-2 mb-2.5 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <h2 className="text-base font-bold text-slate-800 shrink-0">Credits Creator</h2>
          
          {/* Extremely Compact Vendor Position selector */}
          <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 self-start md:self-center">
            <button
              type="button"
              onClick={() => setVendorPosition('auto')}
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
              onClick={() => setVendorPosition('start')}
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
              onClick={() => setVendorPosition('end')}
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

        {/* Compact controls on the right */}
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <span className="text-[10px] text-slate-400 mr-1 hidden lg:inline">Try samples:</span>
          <button 
            onClick={loadExample1}
            className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200 transition-colors"
            title="Load standard format sample"
          >
            Sample 1
          </button>
          <button 
            onClick={loadExample2}
            className="px-2 py-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200 transition-colors"
            title="Load reversed format sample"
          >
            Sample 2
          </button>
          <span className="h-4 w-[1px] bg-slate-200 mx-1"></span>
          <input
            type="file"
            accept=".txt"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
          >
            <UploadIcon className="w-3 h-3 text-slate-500" />
            Upload file
          </button>
        </div>
      </div>

      {/* Main workspace layout: 2 equal-width columns directly underneath */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Left Box: Input Zone */}
        <div className="flex flex-col min-w-0">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-grow flex flex-col rounded-lg border border-dashed p-1.5 transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50/40' : 'border-slate-250'
            }`}
          >
            <textarea
              className="w-full h-[300px] md:h-[420px] p-2 border border-slate-200 rounded-md focus:ring-1.5 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs md:text-sm resize-none mb-1.5"
              placeholder="Paste credits here (one per line). Format example:&#10;Shutterstock/Monkey Business Images&#10;Morphart Creation/Getty Images"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <button
              onClick={handleParse}
              disabled={!inputText.trim()}
              className="w-full py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Generate Credits
            </button>
          </div>
        </div>

        {/* Right Box: Output Zone */}
        <div className="flex flex-col min-w-0">
          {vendorGroups.length > 0 ? (
            <div className="flex flex-col h-full justify-between gap-3">
              {/* Output Preview Card */}
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 flex flex-col h-full">
                <div className="flex flex-row justify-between items-center gap-2 mb-2 px-1">
                  <h3 className="text-xs font-bold text-slate-800">Generated Credits</h3>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCopyText}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                    >
                      <CopyIcon className="w-3 h-3" />
                      {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleDownloadWord}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                    >
                      <FileWordIcon className="w-3 h-3 text-blue-500" />
                      Word
                    </button>
                  </div>
                </div>

                <div 
                  style={{ height: `${previewHeight}px` }}
                  className="bg-white p-2.5 rounded-t border-t border-x border-slate-200 text-xs md:text-sm leading-relaxed text-slate-800 select-all font-sans overflow-y-auto flex-grow"
                >
                  {vendorGroups.map((group, index) => {
                    const ackString = group.acknowledgements.join(', ');
                    const suffix = index === vendorGroups.length - 1 ? '.' : '; ';
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
                
                {/* Drag resize handle at the bottom edge */}
                <div 
                  onMouseDown={handleResizeMouseDown}
                  onTouchStart={handleResizeTouchStart}
                  className={`h-2 w-full border-b border-x rounded-b cursor-ns-resize flex items-center justify-center transition-colors group select-none ${
                    isResizing 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                  }`}
                  title="Drag up or down to resize"
                >
                  <div className="w-8 h-0.5 bg-slate-300 group-hover:bg-slate-400 group-active:bg-slate-500 rounded-full transition-colors flex gap-0.5 justify-center items-center">
                    <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                    <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                    <span className="w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
                  </div>
                </div>
              </div>

              {/* Parsed Mapping Table */}
              <div className="flex flex-col">
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
                  <span className="text-[10px] text-blue-600 font-semibold group-hover:underline">
                    {isMappingsCollapsed ? 'Expand' : 'Collapse'}
                  </span>
                </button>
                
                {!isMappingsCollapsed && (
                  <div className="overflow-auto border border-slate-200 rounded max-h-[140px] mt-1">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-2 py-1 text-[10px] font-bold text-slate-600">Vendor / Source</th>
                          <th className="px-2 py-1 text-[10px] font-bold text-slate-600">Acknowledgement</th>
                          <th className="px-2 py-1 text-[10px] font-bold text-slate-600">Original</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-2 py-1 text-[10px] text-slate-800 font-semibold">{row.vendor}</td>
                            <td className="px-2 py-1 text-[10px] text-slate-800">{row.acknowledgement}</td>
                            <td className="px-2 py-1 text-[10px] text-slate-400 font-mono truncate max-w-[150px]" title={row.original}>{row.original}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[250px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg bg-slate-50 p-4">
              <p className="text-slate-400 text-xs text-center leading-relaxed">
                Parsed and sorted credits will appear here in real-time.<br/>
                Paste credit strings in the input box to begin.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
