import React, { useState } from 'react';
import {
  X,
  Sliders,
  Check,
  FileArchive,
  Copy,
  Eye,
  RotateCcw,
  Sparkles,
  Layers,
  FileText
} from 'lucide-react';
import {
  NamingOptions,
  NAMING_PRESETS,
  DEFAULT_NAMING_OPTIONS,
  formatCustomImageFileName,
  AssetRecord
} from '../services/csExtractorService';

interface DownloadNamingModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: NamingOptions;
  onChangeOptions: (newOptions: NamingOptions) => void;
  sampleAssets: AssetRecord[];
  onDownloadZip: (options: NamingOptions) => void;
  isZipping: boolean;
  totalAssetsToDownload: number;
}

export const DownloadNamingModal: React.FC<DownloadNamingModalProps> = ({
  isOpen,
  onClose,
  options,
  onChangeOptions,
  sampleAssets,
  onDownloadZip,
  isZipping,
  totalAssetsToDownload
}) => {
  const [localOptions, setLocalOptions] = useState<NamingOptions>({ ...options });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    const preset = NAMING_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const updated: NamingOptions = {
      ...localOptions,
      presetId: preset.id,
      pattern: preset.pattern,
      caseTransform: preset.caseTransform || localOptions.caseTransform,
      spaceReplacement: preset.spaceReplacement || localOptions.spaceReplacement,
      extension: preset.extension || localOptions.extension
    };
    setLocalOptions(updated);
  };

  const handleInsertToken = (token: string) => {
    setLocalOptions(prev => ({
      ...prev,
      presetId: 'custom',
      pattern: prev.pattern + token
    }));
  };

  const handleApply = () => {
    onChangeOptions(localOptions);
    onClose();
  };

  const handleDownloadClick = () => {
    onChangeOptions(localOptions);
    onDownloadZip(localOptions);
  };

  const handleReset = () => {
    setLocalOptions({ ...DEFAULT_NAMING_OPTIONS });
  };

  const handleCopyPreview = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const validSampleAssets = sampleAssets.filter(a => a.selectedImage).slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Customize Image File Naming</h3>
              <p className="text-xs text-slate-500">
                Choose or design the exact naming format for downloaded image files and ZIP archives.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          
          {/* Section 1: Presets Selection */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Naming Format Presets</span>
              </label>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {NAMING_PRESETS.map((preset) => {
                const isSelected = localOptions.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 text-xs">{preset.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{preset.description}</p>
                    </div>
                    <code className="mt-2 text-[10px] text-indigo-700 font-mono bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/80 truncate block">
                      {preset.example}
                    </code>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Pattern Customization & Tokens */}
          <div className="space-y-2 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <label className="font-semibold text-slate-900 flex items-center justify-between">
              <span>Custom Pattern Template</span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">tokens: &#123;page3&#125;, &#123;asset_code&#125;, etc.</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={localOptions.pattern}
                onChange={(e) => {
                  setLocalOptions(prev => ({
                    ...prev,
                    presetId: 'custom',
                    pattern: e.target.value
                  }));
                }}
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs font-semibold text-slate-900 focus:outline-indigo-600 focus:ring-1 focus:ring-indigo-600"
                placeholder="e.g. P{page3}. {asset_code}_{selected_image}"
              />
            </div>

            {/* Quick Token Inserters */}
            <div className="pt-1">
              <p className="text-[11px] text-slate-500 mb-1.5">Click to append dynamic token:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { token: '{page3}', label: '{page3} (035)' },
                  { token: '{page}', label: '{page} (35)' },
                  { token: '{asset_code}', label: '{asset_code}' },
                  { token: '{selected_image}', label: '{selected_image}' },
                  { token: '{vendor}', label: '{vendor}' },
                  { token: '{index3}', label: '{index3} (001)' },
                  { token: '{date}', label: '{date}' }
                ].map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => handleInsertToken(item.token)}
                    className="px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded text-[11px] font-mono text-indigo-700 transition-colors cursor-pointer"
                    title={`Insert ${item.token}`}
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Fine-Tuning Format Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Letter Case */}
            <div>
              <label className="font-semibold text-slate-900 block mb-1">Letter Case</label>
              <select
                value={localOptions.caseTransform}
                onChange={(e) => setLocalOptions(prev => ({ ...prev, caseTransform: e.target.value as any }))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-indigo-600"
              >
                <option value="as-is">As-Is (Preserve)</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="lowercase">lowercase</option>
              </select>
            </div>

            {/* Space Handling */}
            <div>
              <label className="font-semibold text-slate-900 block mb-1">Space Character</label>
              <select
                value={localOptions.spaceReplacement}
                onChange={(e) => setLocalOptions(prev => ({ ...prev, spaceReplacement: e.target.value as any }))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-indigo-600"
              >
                <option value="preserve">Preserve Spaces (" ")</option>
                <option value="underscore">Underscore ("_")</option>
                <option value="hyphen">Hyphen ("-")</option>
                <option value="remove">Remove Spaces</option>
              </select>
            </div>

            {/* Prefix */}
            <div>
              <label className="font-semibold text-slate-900 block mb-1">Add Prefix</label>
              <input
                type="text"
                value={localOptions.prefix || ''}
                onChange={(e) => setLocalOptions(prev => ({ ...prev, prefix: e.target.value }))}
                placeholder="e.g. ART_"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-indigo-600 font-mono"
              />
            </div>

            {/* Suffix */}
            <div>
              <label className="font-semibold text-slate-900 block mb-1">Add Suffix</label>
              <input
                type="text"
                value={localOptions.suffix || ''}
                onChange={(e) => setLocalOptions(prev => ({ ...prev, suffix: e.target.value }))}
                placeholder="e.g. _FINAL"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-indigo-600 font-mono"
              />
            </div>
          </div>

          {/* Section 4: Live Real-Time Preview */}
          <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/30">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Live Real-Time Preview ({sampleAssets.filter(a => a.selectedImage).length} images will use this scheme)</span>
              </span>
              <span className="text-[11px] text-indigo-700 font-medium">Extension: .{localOptions.extension}</span>
            </div>

            <div className="space-y-1.5">
              {validSampleAssets.length > 0 ? (
                validSampleAssets.map((asset, idx) => {
                  const previewName = formatCustomImageFileName(asset, idx, localOptions);
                  return (
                    <div
                      key={asset.id}
                      className="bg-white px-3 py-2 rounded-lg border border-slate-200 flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-500 font-mono text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-xs font-semibold text-indigo-950 truncate select-all">
                          {previewName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">
                          Page {asset.selectedPageNum || asset.pages[0]}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPreview(previewName, idx)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Copy preview filename"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-3 text-slate-400 text-xs">
                  Upload a contact sheet or load sample data to see live previews with actual image assets.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              Apply & Save Format
            </button>

            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={isZipping || totalAssetsToDownload === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <FileArchive className="w-4 h-4" />
              <span>
                {isZipping ? 'Downloading...' : `Download ZIP Now (${totalAssetsToDownload} images)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
