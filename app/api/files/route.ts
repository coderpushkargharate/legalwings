import { NextResponse } from 'next/server';
import { Binary, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyToken, getTokenFromHeaders, JWTPayload } from '@/lib/auth';
import { FILE_SLOTS, MAX_FILE_BYTES, MAX_CHUNK_BYTES, type FileSlot } from '@/lib/lead-files';

// ============================================================================
// 📎 Lead file storage (Agreement / PVR / Other uploads)
//
// Files used to be stored as one base64 string INSIDE the lead document and sent
// in the same request as the whole agreement form. That broke in three ways:
//   • Netlify functions cap every request/response at ~6MB, so a big file (or
//     two medium ones) made "Save Agreement" / "View lead" fail outright.
//   • The client aborts requests after 30s, so slow uploads silently failed.
//   • MongoDB caps a document at 16MB, shared with all the lead's other data.
//
// Now each file lives in its own record (`lead_files`) with its bytes split into
// small chunks (`lead_file_chunks`), uploaded/downloaded one chunk per request.
// The lead only keeps a reference (agreement.<slot>FileId + name).
//
// Files are NEVER hard-deleted. Replacing a file marks the old one 'replaced';
// the Remove button marks it 'deleted'. Both stay in the database.
//
// POST  { action: 'init', leadId, slot, name, mimeType, size, chunkCount } → { fileId }
// POST  { action: 'chunk', fileId, n, data /* base64 */ }                   → { ok }
// POST  { action: 'complete', fileId }                                      → file meta
// GET   ?leadId=&slot=   → current file meta (migrates a legacy base64 blob first)
// GET   ?id=&chunk=n     → raw bytes of chunk n
// DELETE ?leadId=&slot=  → manual remove (soft delete)
// ============================================================================

function getAuth(request: Request): JWTPayload | null {
  const token = getTokenFromHeaders(request);
  if (!token) return null;
  return verifyToken(token);
}

const toObjectId = (id: unknown): ObjectId | null =>
  typeof id === 'string' && ObjectId.isValid(id) ? new ObjectId(id) : null;

const isSlot = (s: unknown): s is FileSlot => typeof s === 'string' && s in FILE_SLOTS;

type Db = Awaited<ReturnType<typeof connectToDatabase>>['db'];

const publicMeta = (f: Record<string, any>) => ({
  fileId: f._id.toString(),
  leadId: f.leadId,
  slot: f.slot,
  name: f.name,
  mimeType: f.mimeType,
  size: f.size,
  chunkCount: f.chunkCount,
  uploadedByName: f.uploadedByName,
  completedAt: f.completedAt,
});

// Point the lead's slot at `fileId` (or clear it when null). Also drops the legacy
// base64 blob for that slot so the lead document stays small.
async function setLeadSlot(db: Db, leadObjId: ObjectId, slot: FileSlot, file: { id: string; name: string } | null) {
  const { idField, nameField, legacyFields } = FILE_SLOTS[slot];
  const lead = await db.collection('leads').findOne({ _id: leadObjId }, { projection: { agreement: 1 } });
  if (!lead) return false;

  const unset: Record<string, ''> = {};
  for (const f of legacyFields) unset[`agreement.${f}`] = '';

  if (!lead.agreement || typeof lead.agreement !== 'object') {
    // No agreement saved yet — create it with just the file reference.
    if (!file) return true;
    await db.collection('leads').updateOne(
      { _id: leadObjId },
      { $set: { agreement: { [idField]: file.id, [nameField]: file.name }, updatedAt: new Date() } },
    );
    return true;
  }

  if (file) {
    await db.collection('leads').updateOne(
      { _id: leadObjId },
      {
        $set: { [`agreement.${idField}`]: file.id, [`agreement.${nameField}`]: file.name, updatedAt: new Date() },
        $unset: unset,
      },
    );
  } else {
    await db.collection('leads').updateOne(
      { _id: leadObjId },
      { $set: { updatedAt: new Date() }, $unset: { ...unset, [`agreement.${idField}`]: '', [`agreement.${nameField}`]: '' } },
    );
  }
  return true;
}

// Resolve the lead's current file for a slot. Legacy leads still hold the file as a
// base64 data URL inside the agreement — move it into chunked storage on first access
// (nothing is lost: the bytes are copied before the blob is removed from the lead).
async function resolveSlotFile(db: Db, leadObjId: ObjectId, slot: FileSlot, user: JWTPayload) {
  const { idField, nameField, legacyFields, defaultName } = FILE_SLOTS[slot];
  const projection: Record<string, 1> = { [`agreement.${idField}`]: 1, [`agreement.${nameField}`]: 1, 'agreement.agreementFileName': 1 };
  for (const f of legacyFields) projection[`agreement.${f}`] = 1;
  const lead = await db.collection('leads').findOne({ _id: leadObjId }, { projection });
  if (!lead) return null;
  const ag = (lead.agreement || {}) as Record<string, any>;

  const currentId = toObjectId(ag[idField]);
  if (currentId) {
    const file = await db.collection('lead_files').findOne({ _id: currentId, status: 'active' });
    if (file) return file;
  }

  const legacy = legacyFields.map((f) => ag[f]).find((v) => typeof v === 'string' && v.length > 0) as string | undefined;
  if (!legacy) return null;

  // data:<mime>;base64,<payload>
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(legacy);
  const mimeType = match?.[1] || 'application/octet-stream';
  const bytes = match
    ? (match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8'))
    : Buffer.from(legacy, 'base64');
  const name = ag[nameField] || (slot === 'agreement' ? ag.agreementFileName : '') || defaultName;
  const now = new Date();
  const chunkCount = Math.max(1, Math.ceil(bytes.length / MAX_CHUNK_BYTES));

  const { insertedId } = await db.collection('lead_files').insertOne({
    leadId: leadObjId.toString(), slot, name, mimeType, size: bytes.length, chunkCount,
    status: 'uploading', migratedFromLegacy: true,
    uploadedBy: user.userId, uploadedByName: `${user.firstName} ${user.lastName}`, createdAt: now,
  });
  for (let n = 0; n < chunkCount; n++) {
    await db.collection('lead_file_chunks').insertOne({
      fileId: insertedId, n, data: new Binary(bytes.subarray(n * MAX_CHUNK_BYTES, (n + 1) * MAX_CHUNK_BYTES)),
    });
  }
  await db.collection('lead_files').updateOne({ _id: insertedId }, { $set: { status: 'active', completedAt: now } });
  await setLeadSlot(db, leadObjId, slot, { id: insertedId.toString(), name });
  return db.collection('lead_files').findOne({ _id: insertedId });
}

let indexesEnsured = false;
async function ensureIndexes(db: Db) {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await Promise.all([
      db.collection('lead_file_chunks').createIndex({ fileId: 1, n: 1 }, { unique: true }),
      db.collection('lead_files').createIndex({ leadId: 1, slot: 1, status: 1 }),
    ]);
  } catch (err) {
    indexesEnsured = false;
    console.error('lead_files ensureIndexes failed (non-fatal):', err);
  }
}

export async function POST(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    void ensureIndexes(db);
    const body = await request.json();

    if (body.action === 'init') {
      const leadObjId = toObjectId(body.leadId);
      if (!leadObjId) return NextResponse.json({ error: 'Save the lead first, then upload files.' }, { status: 400 });
      if (!isSlot(body.slot)) return NextResponse.json({ error: 'Invalid file slot' }, { status: 400 });
      const size = Number(body.size);
      const chunkCount = Number(body.chunkCount);
      if (!body.name || !Number.isFinite(size) || size <= 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
      if (size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `File is too large. Maximum allowed is ${MAX_FILE_BYTES / (1024 * 1024)} MB.` }, { status: 400 });
      }
      if (!Number.isInteger(chunkCount) || chunkCount !== Math.ceil(size / MAX_CHUNK_BYTES)) {
        return NextResponse.json({ error: 'Invalid chunk count' }, { status: 400 });
      }
      const exists = await db.collection('leads').countDocuments({ _id: leadObjId }, { limit: 1 });
      if (!exists) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

      const { insertedId } = await db.collection('lead_files').insertOne({
        leadId: leadObjId.toString(), slot: body.slot, name: String(body.name).slice(0, 255),
        mimeType: String(body.mimeType || 'application/octet-stream'), size, chunkCount,
        status: 'uploading', uploadedBy: user.userId, uploadedByName: `${user.firstName} ${user.lastName}`,
        createdAt: new Date(),
      });
      return NextResponse.json({ fileId: insertedId.toString() }, { status: 201 });
    }

    if (body.action === 'chunk') {
      const fileObjId = toObjectId(body.fileId);
      const n = Number(body.n);
      if (!fileObjId || !Number.isInteger(n) || n < 0 || typeof body.data !== 'string') {
        return NextResponse.json({ error: 'Invalid chunk' }, { status: 400 });
      }
      const file = await db.collection('lead_files').findOne({ _id: fileObjId, status: 'uploading' });
      if (!file) return NextResponse.json({ error: 'Upload not found or already finished' }, { status: 404 });
      if (n >= file.chunkCount) return NextResponse.json({ error: 'Chunk index out of range' }, { status: 400 });
      const bytes = Buffer.from(body.data, 'base64');
      if (bytes.length === 0 || bytes.length > MAX_CHUNK_BYTES) return NextResponse.json({ error: 'Invalid chunk size' }, { status: 400 });
      // Upsert so a retried chunk simply overwrites itself.
      await db.collection('lead_file_chunks').updateOne(
        { fileId: fileObjId, n },
        { $set: { fileId: fileObjId, n, data: new Binary(bytes) } },
        { upsert: true },
      );
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'complete') {
      const fileObjId = toObjectId(body.fileId);
      if (!fileObjId) return NextResponse.json({ error: 'Invalid file id' }, { status: 400 });
      const file = await db.collection('lead_files').findOne({ _id: fileObjId });
      if (!file) return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
      if (file.status === 'active') return NextResponse.json(publicMeta(file));
      if (file.status !== 'uploading') return NextResponse.json({ error: 'Upload is no longer active' }, { status: 409 });

      // Verify every chunk arrived and the byte total matches before going live.
      const stats = await db.collection('lead_file_chunks').aggregate([
        { $match: { fileId: fileObjId } },
        { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: { $binarySize: '$data' } } } },
      ]).toArray();
      const got = stats[0] || { count: 0, bytes: 0 };
      if (got.count !== file.chunkCount || got.bytes !== file.size) {
        return NextResponse.json({ error: 'Upload incomplete — please try again.' }, { status: 409 });
      }

      const leadObjId = new ObjectId(file.leadId);
      const now = new Date();
      // Previous file for this slot is kept (status 'replaced'), never deleted.
      await db.collection('lead_files').updateMany(
        { leadId: file.leadId, slot: file.slot, status: 'active', _id: { $ne: fileObjId } },
        { $set: { status: 'replaced', replacedAt: now, replacedBy: fileObjId } },
      );
      // A legacy base64 blob in this slot is about to be dropped from the lead —
      // archive it first so it's never lost.
      await resolveSlotFile(db, leadObjId, file.slot, user).then((prev) =>
        prev && !prev._id.equals(fileObjId)
          ? db.collection('lead_files').updateOne({ _id: prev._id }, { $set: { status: 'replaced', replacedAt: now, replacedBy: fileObjId } })
          : null,
      );
      await db.collection('lead_files').updateOne({ _id: fileObjId }, { $set: { status: 'active', completedAt: now } });
      await setLeadSlot(db, leadObjId, file.slot, { id: fileObjId.toString(), name: file.name });
      return NextResponse.json(publicMeta({ ...file, status: 'active', completedAt: now }));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Files POST error:', error);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const fileObjId = toObjectId(searchParams.get('id'));
    const chunkParam = searchParams.get('chunk');
    if (fileObjId && chunkParam != null) {
      const n = parseInt(chunkParam, 10);
      const chunk = await db.collection('lead_file_chunks').findOne({ fileId: fileObjId, n });
      if (!chunk) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
      const buf = Buffer.from((chunk.data as Binary).buffer);
      return new NextResponse(buf, {
        headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable' },
      });
    }

    const leadObjId = toObjectId(searchParams.get('leadId'));
    const slot = searchParams.get('slot');
    if (!leadObjId || !isSlot(slot)) return NextResponse.json({ error: 'leadId and slot are required' }, { status: 400 });
    const file = await resolveSlotFile(db, leadObjId, slot, user);
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 404 });
    return NextResponse.json(publicMeta(file));
  } catch (error) {
    console.error('Files GET error:', error);
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
  }
}

// Manual remove — the ONLY way a file leaves a lead. Soft delete: the record and its
// bytes stay in `lead_files` / `lead_file_chunks` (status 'deleted') for recovery.
export async function DELETE(request: Request) {
  const user = getAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const leadObjId = toObjectId(searchParams.get('leadId'));
    const slot = searchParams.get('slot');
    if (!leadObjId || !isSlot(slot)) return NextResponse.json({ error: 'leadId and slot are required' }, { status: 400 });

    // Migrates a legacy blob first, so even old files are archived rather than lost.
    const file = await resolveSlotFile(db, leadObjId, slot, user);
    if (file) {
      await db.collection('lead_files').updateOne(
        { _id: file._id },
        { $set: { status: 'deleted', deletedAt: new Date(), deletedBy: user.userId, deletedByName: `${user.firstName} ${user.lastName}` } },
      );
    }
    await setLeadSlot(db, leadObjId, slot, null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Files DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove file' }, { status: 500 });
  }
}
