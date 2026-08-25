// Standalone Document Scanner demo — no dependencies, runs on plain Node.js.
//
//   node server.js   ->  http://localhost:4100
//
// What it does:
//   - Serves a single-page UI (index.html).
//   - You upload ANY document image (Aadhaar, PAN, DL, Voter ID, bill, etc.);
//     the OCR runs *in the browser* (Tesseract.js from a CDN, English + Hindi +
//     Marathi), so the server stays dependency-free.
//   - The parsed fields auto-fill a form. You can then save the record here.
//
// Endpoints:
//   GET  /api/records                 -> all saved records
//   POST /api/records                 -> save one
//        { name, idNumber, dob, gender, phone, email, address, docType, fields }

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');

// In-memory data store (resets when the server restarts).
let records = [];
let nextId = 1;

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

// POST /api/records — save a scanned record from ANY document type.
function addRecord(body) {
  const name = (body.name || '').trim();
  const idNumber = (body.idNumber || '').trim();
  const dob = (body.dob || '').trim();
  const gender = (body.gender || '').trim();
  const phone = (body.phone || '').trim();
  const email = (body.email || '').trim();
  const address = (body.address || '').trim();
  const docType = (body.docType || '').trim();
  // `fields` is an open-ended map of any extra key/value pairs the scanner found.
  const fields = (body.fields && typeof body.fields === 'object') ? body.fields : {};

  if (!name && !idNumber) return { error: 'need at least a name or an ID number' };

  const record = {
    id: nextId++,
    docType,
    name,
    idNumber,
    dob,
    gender,
    phone,
    email,
    address,
    fields,
    savedAt: new Date().toISOString(),
  };
  records.push(record);
  return { message: 'Record saved', record };
}

const server = http.createServer((req, res) => {
  const { pathname } = parse(req.url, true);

  // CORS pre-flight
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  // ---- API routes ----
  if (pathname === '/api/records' && req.method === 'GET') {
    return sendJson(res, 200, { count: records.length, records });
  }

  if (pathname === '/api/records' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
      const result = addRecord(body);
      return sendJson(res, result.error ? 400 : 201, result);
    });
    return;
  }

  // ---- Static UI ----
  if (pathname === '/' && req.method === 'GET') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html);
  }

  sendJson(res, 404, { error: 'Not found' });
});

const PORT = 4100;
server.listen(PORT, () => {
  console.log(`Document Scanner demo running at http://localhost:${PORT}`);
});
