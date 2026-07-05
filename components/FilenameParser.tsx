import React, { useState } from 'react';
import { CopyIcon } from './icons/CopyIcon';

interface ParsedImage {
  original: string;
  vendor: string;
  rightsType: string;
  imageId: string;
}

const parseImageFilenames = (text: string): ParsedImage[] => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  return lines.map(line => {
    let name = line.replace(/\.[^/.]+$/, ""); // Remove extension
    let vendor = "";
    let rightsType = "";
    let imageId = "";

    // Extract RM/RF
    const rightsMatch = name.match(/[-_\s](RM|RF)([-_\s]|$)/i);
    if (rightsMatch) {
      rightsType = rightsMatch[1].toUpperCase();
      name = name.replace(new RegExp(`[-_\\s]${rightsType}([-_\\s]|$)`, 'i'), '$1');
    }

    const parts = name.split(/[-_]/).map(p => p.trim()).filter(p => p);
    
    // Known vendors to help with parsing
    const knownVendors = ['getty', 'alamy', 'shutterstock', 'dam', 'istock', 'corbis', 'adobe'];
    
    if (parts.length > 1) {
      // Check if the first part is a known vendor
      const firstPartLower = parts[0].toLowerCase();
      const isFirstPartVendor = knownVendors.some(v => firstPartLower.includes(v));
      
      // Check if the last part is a known vendor
      const lastPartLower = parts[parts.length - 1].toLowerCase();
      const isLastPartVendor = knownVendors.some(v => lastPartLower.includes(v));

      if (isLastPartVendor && !isFirstPartVendor) {
        vendor = parts.pop() || "";
        imageId = parts.join("-");
      } else {
        imageId = parts.pop() || "";
        vendor = parts.join(" ");
      }
    } else {
      const match = name.match(/^([a-zA-Z\s]+)(.*)$/);
      if (match) {
        vendor = match[1].trim();
        imageId = match[2].trim();
      } else {
        vendor = name;
      }
    }

    // Standardize some common vendor names
    const vLower = vendor.toLowerCase().replace(/\s/g, '');
    if (vLower.includes('getty')) vendor = 'GettyImages';
    else if (vLower.includes('alamy')) vendor = 'Alamy';
    else if (vLower.includes('shutterstock')) vendor = 'Shutterstock';
    else if (vLower.includes('dam')) vendor = 'DAM';

    return {
      original: line,
      vendor,
      rightsType,
      imageId
    };
  });
};

export const FilenameParser: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedImage[]>([]);

  const handleParse = () => {
    const result = parseImageFilenames(inputText);
    setParsedData(result);
  };

  const handleCopy = () => {
    if (parsedData.length === 0) return;
    const header = "Vendor\tRights Type\tImage ID\tOriginal Filename\n";
    const rows = parsedData.map(row => `${row.vendor}\t${row.rightsType}\t${row.imageId}\t${row.original}`).join('\n');
    navigator.clipboard.writeText(header + rows).then(() => {
      alert("Copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy data to clipboard.');
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 text-left max-w-7xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Image Filename Parser</h2>
      <p className="text-sm text-slate-600 mb-4">
        Paste a list of image filenames below (one per line). The tool will extract the Vendor, Rights Type (RM/RF), and Image ID.
      </p>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Input */}
        <div className="flex-1 flex flex-col">
          <div className="mb-3 flex-grow">
            <textarea
              className="w-full h-full min-h-[300px] p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y"
              placeholder="Alamy_2tb9fn6&#10;GettyImages_139551127&#10;GettyImages-RM_139551156&#10;Shutterstock_RF_433009015&#10;DAM_43457"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleParse}
              disabled={!inputText.trim()}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Parse Filenames
            </button>
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="flex-[2] flex flex-col min-w-0">
          {parsedData.length > 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-semibold text-slate-800">Parsed Results ({parsedData.length})</h3>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                  Copy Table
                </button>
              </div>
              
              <div className="overflow-auto border border-slate-200 rounded-lg flex-grow max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-700">Vendor</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-700">Rights Type</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-700">Image ID</th>
                      <th className="px-2 py-1.5 text-xs font-semibold text-slate-700">Original Filename</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {parsedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-2 py-1.5 text-xs text-slate-800 font-medium">{row.vendor}</td>
                        <td className="px-2 py-1.5 text-xs text-slate-600">{row.rightsType}</td>
                        <td className="px-2 py-1.5 text-xs text-slate-800 font-mono">{row.imageId}</td>
                        <td className="px-2 py-1.5 text-xs text-slate-500 font-mono truncate max-w-xs" title={row.original}>{row.original}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
              <p className="text-slate-400 text-sm text-center px-4">
                Parsed results will appear here.<br/>Paste your filenames and click "Parse Filenames".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
