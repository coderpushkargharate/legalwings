# Document Scanner Demo

A tiny standalone app — **no npm dependencies**, just Node.js. Upload **any**
document image (Aadhaar, PAN, Driving License, Voter ID, Passport, a bill…), it is
**scanned (OCR) in the browser** in **English + हिंदी + मराठी**, and the detected
fields **auto-fill a form**: Name, ID / Document Number, DOB, Gender, Phone, Email,
Address — plus an "All detected fields" table for anything else it finds.

The Node server only serves the page and stores saved records in memory — all the
OCR work runs client-side using [Tesseract.js](https://tesseract.projectnaptha.com/)
loaded from a CDN, so the server stays dependency-free (just like the `demo/` folder).

## Run

```bash
cd aadhaar-scanner
node server.js
```

Then open: http://localhost:4100

> Needs an internet connection so the browser can fetch Tesseract.js and the
> selected language data (English / Hindi / Marathi) on first use.

## How it works

1. **Upload** any document image → a preview shows.
2. Pick languages (English / हिंदी / मराठी — all on by default).
3. Click **Scan & Auto-fill** → the browser runs OCR.
4. The raw text is parsed with heuristics that recognise common Indian docs:
   - **Document type** — Aadhaar / PAN / Driving License / Voter ID / Passport.
   - **ID number** — Aadhaar `4 4 4`, PAN `ABCDE1234F`, DL, Passport, etc.
   - **DOB**, **Gender** (Male/Female + पुरुष/महिला), **Phone**, **Email**, **Address**.
   - **Name** — from a `Name:` / नाव / नाम label, else the line above DOB/gender.
5. Fields drop into the form; everything found is listed under **All detected fields**.
6. **Verify/edit**, then **Save Record**. Expand *View raw OCR text* to see the read text.

## API

| Request | What it does |
|---|---|
| `GET /api/records` | all saved records |
| `POST /api/records` | save one `{ name, idNumber, dob, gender, phone, email, address, docType, fields }` |

```bash
curl -X POST http://localhost:4100/api/records \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Ramesh Kumar\",\"idNumber\":\"ABCDE1234F\",\"docType\":\"PAN Card\"}"

curl http://localhost:4100/api/records
```

## Notes

- OCR accuracy depends on image quality — a **clear, well-lit, straight** photo
  works best. Always verify auto-filled values before saving.
- Different documents have different layouts, so detection is best-effort; the
  raw OCR text and "All detected fields" table let you catch anything missed.
- Data is **in-memory** and resets when the server restarts.
- This is a demo; handle real identity documents only with proper consent,
  encryption, and compliance (e.g. UIDAI guidelines for Aadhaar).
