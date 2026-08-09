import React, { useState } from 'react';
import { CloseIcon } from './icons/CloseIcon';
import { SuccessIcon } from './icons/SuccessIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { CopyIcon } from './icons/CopyIcon';
import { Globe, Send, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  sourceUrl?: string | null;
  unsavedChangesCount: number;
  lastSyncedAt: string | null;
  onPerformSync: (webhookUrl?: string) => Promise<{ success: boolean; message?: string; webhookResult?: any }>;
  onDownloadUpdatedExcel: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  fileName,
  sourceUrl,
  unsavedChangesCount,
  lastSyncedAt,
  onPerformSync,
  onDownloadUpdatedExcel,
}) => {
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('amh_cloud_sync_webhook_url') || '';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);

  if (!isOpen) return null;

  const handleSyncClick = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      if (webhookUrl.trim()) {
        localStorage.setItem('amh_cloud_sync_webhook_url', webhookUrl.trim());
      }
      const res = await onPerformSync(webhookUrl.trim() || undefined);
      if (res.success) {
        let msg = res.message || 'Changes synced to online session cache successfully!';
        if (res.webhookResult) {
          if (res.webhookResult.ok) {
            msg += ' Webhook triggered and updated cloud drive!';
          } else {
            msg += ` (Note: Webhook returned status ${res.webhookResult.status})`;
          }
        }
        setSyncFeedback({ type: 'success', message: msg });
      } else {
        setSyncFeedback({ type: 'error', message: res.message || 'Failed to sync changes.' });
      }
    } catch (e: any) {
      setSyncFeedback({ type: 'error', message: e?.message || 'An error occurred during sync.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyLink = () => {
    const link = sourceUrl || window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-fast"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Online File Sync Manager
              </h2>
              <p className="text-xs text-slate-300 truncate max-w-xs">
                {fileName || 'Online_Log.xlsx'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Card */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
              unsavedChangesCount > 0
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            }`}
          >
            {unsavedChangesCount > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <h4 className="font-bold text-sm mb-0.5">
                {unsavedChangesCount > 0
                  ? `${unsavedChangesCount} Unsynced Local Edit(s)`
                  : 'All Local Edits Synced in App Session'}
              </h4>
              <p className="opacity-90">
                {unsavedChangesCount > 0
                  ? 'Your local cell edits are saved in your app workspace and ready to sync to the online session.'
                  : 'Your app session is up to date with all edited cells.'}
              </p>
              {lastSyncedAt && (
                <p className="mt-1 text-[11px] font-medium opacity-75">
                  Last synced in app: {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          {/* Educational Cloud Drive Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1.5">
            <h5 className="font-bold flex items-center gap-1.5 text-blue-950">
              <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Why changes aren't directly saved inside your Microsoft/Google link:</span>
            </h5>
            <p className="text-[11px] leading-relaxed text-blue-800">
              Sharing links (like OneDrive, SharePoint, or Google Sheets) are provided by Microsoft/Google as <strong>read-only / view links</strong>. External web apps cannot directly overwrite files inside your personal Microsoft 365 or Google account without OAuth cloud account permissions.
            </p>
            <div className="bg-white/80 p-2 rounded-lg border border-blue-200 text-[11px] font-medium text-slate-700">
              💡 <strong>Recommended way to update your online Excel spreadsheet:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                <li>Click <strong>Download .XLSX</strong> below to save your updated spreadsheet, then replace/upload it in Excel Online.</li>
                <li>Or click <strong>Copy TSV</strong> in Uploaded Log View and paste directly into your Excel Online spreadsheet.</li>
              </ul>
            </div>
          </div>

          {/* Feedback message */}
          {syncFeedback && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                syncFeedback.type === 'success'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {syncFeedback.type === 'success' ? <SuccessIcon className="w-4 h-4 flex-shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />}
              <span>{syncFeedback.message}</span>
            </div>
          )}

          {/* Sync Actions Grid */}
          <div className="space-y-3">
            <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Cloud Webhook Auto-Sync (Optional)</span>
                <span className="text-[10px] text-blue-600 font-normal">Power Automate / Apps Script / Zapier</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://prod-xx.cloud.logic.azure.com/workflows/..."
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                If configured, syncing will automatically push the updated Excel binary to your Microsoft Power Automate or Google Apps Script workflow.
              </p>
            </div>

            {/* Sync Now Button */}
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing to Online File...' : 'Sync Changes to Online File'}</span>
            </button>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <h4 className="text-xs font-bold text-slate-700">Alternative Cloud Export Options</h4>
            <div className="grid grid-cols-2 gap-2">
              {/* Download Updated Excel */}
              <button
                onClick={onDownloadUpdatedExcel}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
              >
                <DownloadIcon className="w-4 h-4 text-blue-600" />
                <span>Download .XLSX</span>
              </button>

              {/* Copy Source Link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
              >
                <Link2 className="w-4 h-4 text-slate-500" />
                <span>{copyStatus ? 'Link Copied!' : 'Copy Online Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
