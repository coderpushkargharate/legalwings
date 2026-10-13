'use client';

// ============================================================================
// 📎 One lead file slot (Agreement / PVR / Other): shows the stored file with
// View / Download / Remove, and — when editable — an upload input with progress.
// Uploads go straight to /api/files in small chunks and are attached to the lead
// as soon as they finish, so a file never depends on the form's Save button.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useApi } from '@/components/api-client';
import {
  FILE_SLOTS, MAX_FILE_BYTES, fetchLeadFile, removeLeadFile, slotFileName, slotHasFile, uploadLeadFile,
  type FileSlot,
} from '@/lib/lead-files';

interface Props {
  leadId?: string | null;
  slot: FileSlot;
  agreement: Record<string, any> | null | undefined;
  editable?: boolean;
  accept?: string;
  label?: string;
  // Called with the agreement fields to merge into the form after upload/remove.
  onChange?: (patch: Record<string, any>) => void;
  // Show an inline PDF/image preview toggle.
  preview?: boolean;
  // Hide the file name (just View / Download) — for narrow table cells.
  compact?: boolean;
  className?: string;
}

const isPdf = (type?: string, name?: string) => type === 'application/pdf' || /\.pdf$/i.test(name || '');
const isImage = (type?: string, name?: string) => !!type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');

export default function LeadFileField({ leadId, slot, agreement, editable = false, accept = 'application/pdf,image/*', label, onChange, preview = false, compact = false, className = '' }: Props) {
  const { apiFetch } = useApi();
  const [busy, setBusy] = useState<'upload' | 'view' | 'download' | 'remove' | 'preview' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { idField, nameField, legacyFields } = FILE_SLOTS[slot];
  const hasFile = slotHasFile(agreement, slot);
  const name = slotFileName(agreement, slot);
  // The file reference changed (new upload / removed) → drop the stale preview.
  const fileKey = `${agreement?.[idField] || ''}|${name}`;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { setPreviewUrl(null); }, [fileKey]);

  const getBlob = async () => {
    if (!leadId) throw new Error('Lead not saved yet');
    return fetchLeadFile(apiFetch, leadId, slot);
  };

  const handleView = async () => {
    setError(null);
    // Open the tab synchronously (inside the click) so popup blockers allow it.
    const win = window.open('', '_blank');
    setBusy('view');
    try {
      const { blob } = await getBlob();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      win?.close();
      setError(e?.message || 'Could not open file');
    } finally { setBusy(null); }
  };

  const handleDownload = async () => {
    setError(null);
    setBusy('download');
    try {
      const { blob, meta } = await getBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = meta.name || name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setError(e?.message || 'Could not download file');
    } finally { setBusy(null); }
  };

  const togglePreview = async () => {
    if (previewUrl) { setPreviewUrl(null); return; }
    setError(null);
    setBusy('preview');
    try {
      const { blob, meta } = await getBlob();
      setPreviewType(meta.mimeType);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setError(e?.message || 'Could not load preview');
    } finally { setBusy(null); }
  };

  const handleRemove = async () => {
    if (!leadId) return;
    if (!window.confirm(`Remove "${name}" from this lead?`)) return;
    setError(null);
    setBusy('remove');
    try {
      await removeLeadFile(apiFetch, leadId, slot);
      const cleared: Record<string, any> = { [idField]: '', [nameField]: '' };
      for (const f of legacyFields) cleared[f] = '';
      if (slot === 'agreement') cleared.agreementFileName = '';
      onChange?.(cleared);
    } catch (e: any) {
      setError(e?.message || 'Could not remove file');
    } finally { setBusy(null); }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !leadId) return;
    setError(null);
    setProgress(0);
    setBusy('upload');
    try {
      const meta = await uploadLeadFile(apiFetch, leadId, slot, file, setProgress);
      const patch: Record<string, any> = { [idField]: meta.fileId, [nameField]: meta.name };
      for (const f of legacyFields) patch[f] = '';
      onChange?.(patch);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const btn = 'inline-flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-50 disabled:no-underline';

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>}

      {hasFile ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
          {!compact && (
            <span className="inline-flex items-center gap-1 text-sm text-slate-700 max-w-[16rem] truncate" title={name}>
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" /> <span className="truncate">{name}</span>
            </span>
          )}
          <button type="button" onClick={handleView} disabled={!!busy || !leadId} className={`${btn} text-[#00843d]`}>
            {busy === 'view' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} View
          </button>
          <button type="button" onClick={handleDownload} disabled={!!busy || !leadId} className={`${btn} text-amber-600`}>
            {busy === 'download' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download
          </button>
          {preview && (
            <button type="button" onClick={togglePreview} disabled={(!!busy && busy !== 'preview') || !leadId} className={`${btn} text-slate-600`}>
              {busy === 'preview' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} {previewUrl ? 'Hide preview' : 'Preview'}
            </button>
          )}
          {editable && (
            <button type="button" onClick={handleRemove} disabled={!!busy || !leadId} className={`${btn} text-red-600`}>
              {busy === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove
            </button>
          )}
        </div>
      ) : (
        !editable && <p className="text-sm text-slate-500">No file uploaded</p>
      )}

      {editable && (
        leadId ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              disabled={!!busy}
              onChange={(e) => handleUpload(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!!busy}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy === 'upload' ? `Uploading… ${progress}%` : hasFile ? 'Replace file' : 'Upload file'}
            </button>
            <span className="text-xs text-slate-400">Max {MAX_FILE_BYTES / (1024 * 1024)} MB · saves automatically</span>
          </div>
        ) : (
          <p className="text-xs text-amber-600">Save the lead first, then upload files.</p>
        )
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {previewUrl && (
        <div className="mt-2">
          {isPdf(previewType, name) ? (
            <iframe src={previewUrl} title={name} className="w-full h-[600px] border border-slate-200 rounded-lg" />
          ) : isImage(previewType, name) ? (
            <img src={previewUrl} alt={name} className="max-w-full max-h-[600px] border border-slate-200 rounded-lg" />
          ) : (
            <p className="text-xs text-slate-500">Preview not available for this file type — use Download.</p>
          )}
        </div>
      )}
    </div>
  );
}
