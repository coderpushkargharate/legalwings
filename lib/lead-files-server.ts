import { ObjectId, type Db } from 'mongodb';

// ============================================================================
// 📎 Server-side guards for lead file references.
// Files are uploaded separately via /api/files (chunked) and the agreement only
// holds a reference (fileId / pvrFileId / otherFileId + names). Those fields are
// owned by /api/files: a form save can never change or clear them — a file only
// leaves a lead through its explicit Remove button (DELETE /api/files).
// ============================================================================

const AGREEMENT_FILE_FIELDS = [
  'fileId', 'fileName', 'fileData', 'agreementFile', 'agreementFileName',
  'pvrFileId', 'pvrFileName', 'pvrFileData',
  'otherFileId', 'otherFileName', 'otherFileData',
];

// Overwrite the file fields of an incoming agreement with what is stored on the
// lead, so a stale/stripped form copy can never wipe (or resurrect) a file.
export async function preserveAgreementFiles(db: Db, leadId: string, incoming: unknown) {
  if (!incoming || typeof incoming !== 'object' || !ObjectId.isValid(leadId)) return;
  const existing = await db.collection('leads').findOne(
    { _id: new ObjectId(leadId) },
    { projection: Object.fromEntries(AGREEMENT_FILE_FIELDS.map(f => [`agreement.${f}`, 1])) },
  );
  const prev = ((existing?.agreement as Record<string, unknown>) || {});
  const next = incoming as Record<string, unknown>;
  for (const field of AGREEMENT_FILE_FIELDS) {
    if (prev[field] !== undefined) next[field] = prev[field];
    else delete next[field];
  }
}

// Heavy legacy base64 blobs are never shipped with a lead (Netlify caps responses at
// ~6MB); /api/files serves them on demand. Keep a name so the UI knows a file exists.
export function stripAgreementBlobs<T extends Record<string, any>>(lead: T): T {
  const ag = lead.agreement;
  if (!ag || typeof ag !== 'object') return lead;
  const out = { ...ag };
  if ((out.fileData || out.agreementFile) && !out.fileName) out.fileName = out.agreementFileName || 'agreement';
  if (out.pvrFileData && !out.pvrFileName) out.pvrFileName = 'pvr-file';
  if (out.otherFileData && !out.otherFileName) out.otherFileName = 'other-file';
  delete out.fileData; delete out.agreementFile; delete out.pvrFileData; delete out.otherFileData;
  return { ...lead, agreement: out };
}
