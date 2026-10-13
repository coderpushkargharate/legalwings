// ============================================================================
// 📎 Lead file uploads — shared by the /api/files route and the UI.
// See app/api/files/route.ts for why files are stored in chunks.
// ============================================================================

export type FileSlot = 'agreement' | 'pvr' | 'other';

// Where each slot's reference lives on lead.agreement. `legacyFields` hold the old
// inline base64 data URL (pre-chunked storage) — still readable, migrated on access.
export const FILE_SLOTS: Record<FileSlot, { idField: string; nameField: string; legacyFields: string[]; defaultName: string; label: string }> = {
  agreement: { idField: 'fileId', nameField: 'fileName', legacyFields: ['fileData', 'agreementFile'], defaultName: 'agreement', label: 'Agreement File' },
  pvr: { idField: 'pvrFileId', nameField: 'pvrFileName', legacyFields: ['pvrFileData'], defaultName: 'pvr-file', label: 'PVR File' },
  other: { idField: 'otherFileId', nameField: 'otherFileName', legacyFields: ['otherFileData'], defaultName: 'other-file', label: 'Other File' },
};

// Every inline base64 field — never sent back to the server on form saves (the
// server keeps the stored copy), so saves stay small.
export const LEGACY_BLOB_FIELDS = ['fileData', 'agreementFile', 'pvrFileData', 'otherFileData'];

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
// 1.5 MB raw ≈ 2 MB base64 per request — far below Netlify's ~6MB function limit.
export const MAX_CHUNK_BYTES = 1.5 * 1024 * 1024;

export interface LeadFileMeta {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  chunkCount: number;
}

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

// Does this agreement reference a file in `slot` (new reference, legacy blob, or just a name)?
export const slotHasFile = (agreement: Record<string, any> | null | undefined, slot: FileSlot): boolean => {
  if (!agreement) return false;
  const { idField, nameField, legacyFields } = FILE_SLOTS[slot];
  return !!(agreement[idField] || agreement[nameField] || legacyFields.some((f) => agreement[f]) ||
    (slot === 'agreement' && agreement.agreementFileName));
};

export const slotFileName = (agreement: Record<string, any> | null | undefined, slot: FileSlot): string => {
  const { nameField, defaultName } = FILE_SLOTS[slot];
  return agreement?.[nameField] || (slot === 'agreement' ? agreement?.agreementFileName : '') || defaultName;
};

// Strip the heavy inline base64 fields before sending an agreement to the server.
export const withoutLegacyBlobs = <T extends Record<string, any> | null | undefined>(agreement: T): T => {
  if (!agreement || typeof agreement !== 'object') return agreement;
  const copy: Record<string, any> = { ...agreement };
  for (const f of LEGACY_BLOB_FIELDS) delete copy[f];
  return copy as T;
};

const readError = async (res: Response, fallback: string) => {
  try { return (await res.json())?.error || fallback; } catch { return fallback; }
};

const chunkToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });

// Retry a request a few times — a single dropped request on a flaky mobile
// connection shouldn't fail the whole upload.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

// Upload `file` into `slot` of the lead. The lead is updated server-side as soon as
// the upload completes — no separate "Save" needed for the file itself.
export async function uploadLeadFile(
  apiFetch: ApiFetch,
  leadId: string,
  slot: FileSlot,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<LeadFileMeta> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`);
  }
  if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
  const chunkCount = Math.ceil(file.size / MAX_CHUNK_BYTES);

  const initRes = await apiFetch('/api/files', {
    method: 'POST',
    body: JSON.stringify({ action: 'init', leadId, slot, name: file.name, mimeType: file.type, size: file.size, chunkCount }),
  });
  if (!initRes.ok) throw new Error(await readError(initRes, 'Could not start upload'));
  const { fileId } = await initRes.json();

  for (let n = 0; n < chunkCount; n++) {
    const data = await chunkToBase64(file.slice(n * MAX_CHUNK_BYTES, (n + 1) * MAX_CHUNK_BYTES));
    await withRetry(async () => {
      const res = await apiFetch('/api/files', { method: 'POST', body: JSON.stringify({ action: 'chunk', fileId, n, data }) });
      if (!res.ok) throw new Error(await readError(res, 'Upload failed'));
    });
    onProgress?.(Math.round(((n + 1) / chunkCount) * 100));
  }

  const done = await withRetry(async () => {
    const res = await apiFetch('/api/files', { method: 'POST', body: JSON.stringify({ action: 'complete', fileId }) });
    if (!res.ok) throw new Error(await readError(res, 'Upload failed'));
    return res.json();
  });
  return done as LeadFileMeta;
}

// Fetch a lead's current file for `slot` as a Blob (for view / download).
export async function fetchLeadFile(apiFetch: ApiFetch, leadId: string, slot: FileSlot): Promise<{ blob: Blob; meta: LeadFileMeta }> {
  const metaRes = await apiFetch(`/api/files?leadId=${encodeURIComponent(leadId)}&slot=${slot}`);
  if (!metaRes.ok) throw new Error(await readError(metaRes, 'File not found'));
  const meta: LeadFileMeta = await metaRes.json();
  const parts: ArrayBuffer[] = [];
  for (let n = 0; n < meta.chunkCount; n++) {
    parts.push(await withRetry(async () => {
      const res = await apiFetch(`/api/files?id=${meta.fileId}&chunk=${n}`);
      if (!res.ok) throw new Error(await readError(res, 'Download failed'));
      return res.arrayBuffer();
    }));
  }
  return { blob: new Blob(parts, { type: meta.mimeType || 'application/octet-stream' }), meta };
}

export async function removeLeadFile(apiFetch: ApiFetch, leadId: string, slot: FileSlot): Promise<void> {
  const res = await apiFetch(`/api/files?leadId=${encodeURIComponent(leadId)}&slot=${slot}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, 'Failed to remove file'));
}
