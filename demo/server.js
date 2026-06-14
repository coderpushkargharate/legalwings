// Simple standalone Lead API demo — no dependencies, runs on plain Node.js.
//
//   node server.js   ->  http://localhost:4000
//
// Endpoints:
//   GET  /api/leads                                   -> all leads
//   GET  /api/leads?number=9876543210                 -> filter by phone (partial match)
//   GET  /api/leads?usertype=owner                    -> filter by owner / tenant
//   GET  /api/leads?status=pending                    -> filter by pending / completed
//   GET  /api/leads?number=98&usertype=owner&status=pending  -> combine any filters
//   POST /api/leads   { name, number, usertype, status }     -> add a lead

const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');

// In-memory data store (resets when the server restarts).
let leads = [
  { id: 1, name: 'Ramesh Kumar',  number: '9876543210', usertype: 'owner',  status: 'pending'   },
  { id: 2, name: 'Suresh Patil',  number: '9123456780', usertype: 'tenant', status: 'completed' },
  { id: 3, name: 'Anita Sharma',  number: '9876500011', usertype: 'owner',  status: 'completed' },
  { id: 4, name: 'Vijay More',    number: '9988776655', usertype: 'tenant', status: 'pending'   },
];
let nextId = 5;

const VALID_USERTYPES = ['owner', 'tenant'];
const VALID_STATUSES = ['pending', 'completed'];

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

// GET /api/leads — apply any combination of filters.
function getLeads(query) {
  let result = [...leads];

  // 🔍 number: partial match so "98" finds every number containing 98.
  if (query.number) {
    const n = String(query.number).trim();
    result = result.filter((l) => l.number.includes(n));
  }

  // 🔍 usertype: owner | tenant (case-insensitive, exact).
  if (query.usertype) {
    const u = String(query.usertype).trim().toLowerCase();
    result = result.filter((l) => l.usertype.toLowerCase() === u);
  }

  // 🔍 status: pending | completed (case-insensitive, exact).
  if (query.status) {
    const s = String(query.status).trim().toLowerCase();
    result = result.filter((l) => l.status.toLowerCase() === s);
  }

  return { count: result.length, leads: result };
}

// POST /api/leads — add a new lead.
function addLead(body) {
  const name = (body.name || '').trim();
  const number = (body.number || '').trim();
  const usertype = (body.usertype || '').trim().toLowerCase();
  const status = (body.status || 'pending').trim().toLowerCase();

  if (!name) return { error: 'name is required' };
  if (!/^\d{10}$/.test(number)) return { error: 'number must be 10 digits' };
  if (!VALID_USERTYPES.includes(usertype)) return { error: `usertype must be one of: ${VALID_USERTYPES.join(', ')}` };
  if (!VALID_STATUSES.includes(status)) return { error: `status must be one of: ${VALID_STATUSES.join(', ')}` };

  const lead = { id: nextId++, name, number, usertype, status };
  leads.push(lead);
  return { message: 'Lead added', lead };
}

const server = http.createServer((req, res) => {
  const { pathname, query } = parse(req.url, true);

  // CORS pre-flight
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});

  // ---- API routes ----
  if (pathname === '/api/leads' && req.method === 'GET') {
    return sendJson(res, 200, getLeads(query));
  }

  if (pathname === '/api/leads' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
      const result = addLead(body);
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

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Lead API demo running at http://localhost:${PORT}`);
});
