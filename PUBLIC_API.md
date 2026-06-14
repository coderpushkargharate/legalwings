# LegalWings CRM — External Developer API

Ye API dusre developers / dusri websites ke liye hai. Isse koi bhi external app
**lead add** kar sakta hai, leads ko **filter / search** kar sakta hai, aur
**employee / client / dropdown** data fetch kar sakta hai — bina dashboard login
(JWT) ke. Authentication ek simple **API key** se hoti hai.

## Authentication

Har request mein API key bhejni hai, in three me se kisi bhi tarike se:

```
x-api-key: your_super_secret_key_12345
```
ya `Authorization: Bearer your_super_secret_key_12345`
ya query param `?apiKey=your_super_secret_key_12345`

Key `.env` ke `EXTERNAL_LEADS_API_KEY` se aati hai. Production mein isse zaroor
badlein. CORS by default sab origins ke liye open hai; lock karne ke liye
`.env` mein `PUBLIC_API_ALLOWED_ORIGINS=https://siteA.com,https://siteB.com`
set karein.

Base URL: `https://<your-domain>/api/public`

---

## 1. Leads

### Create a lead — `POST /api/public/leads`

```bash
curl -X POST https://<domain>/api/public/leads \
  -H "x-api-key: your_super_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Ravi",
    "lastName": "Sharma",
    "phoneNo": "9876543210",
    "email": "ravi@example.com",
    "clientType": "OWNER",
    "leadSource": "PARTNER_WEBSITE",
    "address": "Pune",
    "description": "Wants rent agreement",
    "assignedToUserId": "OPTIONAL_employee_id"
  }'
```

Required: `firstName`, `phoneNo`. Baaki optional. `assignedToUserId` doge to lead
seedha us employee ko assign ho jayega (id `/api/public/employees` se lo).

Response: `{ "success": true, "leadId": "...", "message": "Lead created successfully" }`

### List / filter / search — `GET /api/public/leads`

Saare query params optional hain aur combine kiye ja sakte hain (AND):

| Param | Matlab |
|-------|--------|
| `searchText` | "search all" — naam, email, phone, token, description |
| `mobile` | kisi bhi phone field me number dhoondo |
| `clientType` | `OWNER` / `TENANT` / `AGENT` |
| `leadStatus` | e.g. `NEW_LEAD` |
| `leadSource` | jaise create me bheja tha |
| `transitLevel` | team queue, e.g. `CALLING_TEAM` (ya `ALL`) |
| `assignedToUserId` | specific employee ke leads |
| `createdByUserId` | kis user ne banaya |
| `cityId`, `areaId` | location |
| `fromDate`, `toDate` | created-date range (`YYYY-MM-DD`) |
| `page`, `pageSize` | pagination (pageSize max 100, default 20) |

```bash
# specific employee ke NEW leads, search "ravi", page 0
curl "https://<domain>/api/public/leads?assignedToUserId=<id>&leadStatus=NEW_LEAD&searchText=ravi&page=0&pageSize=20" \
  -H "x-api-key: your_super_secret_key_12345"
```

Response:
```json
{
  "success": true,
  "content": [ /* leads */ ],
  "totalElements": 42,
  "totalPages": 3,
  "page": 0,
  "pageSize": 20
}
```

### Single lead (full detail) — `GET /api/public/leads/:id`

Returns the lead with `statusHistory`, `activities` aur `forwardedHistory` —
yani poora **status tracking / activity timeline**.

### Update status / add activity note — `PATCH /api/public/leads/:id`

```bash
curl -X PATCH https://<domain>/api/public/leads/<id> \
  -H "x-api-key: your_super_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{ "leadStatus": "FOLLOW_UP", "note": "Called customer, will visit Monday" }'
```

Body (sab optional, kam se kam ek do):
- `leadStatus` — naya status (history me record hota hai)
- `note` (ya `activity`) — free-text activity log entry
- editable fields: `description`, `visitAddress`, `leadSource`

Response: `{ "success": true, "message": "Lead updated", "lead": { ... } }`

### Share / forward lead to a specific team — `POST /api/public/leads/:id/forward`

```bash
curl -X POST https://<domain>/api/public/leads/<id>/forward \
  -H "x-api-key: your_super_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{ "team": "BACKEND", "assignedToUserId": "<optional employee id>", "reason": "Docs ready" }'
```

- `team` (required): `CALLING` / `EXECUTIVE` / `BACKEND` / `ACCOUNTING` / `MARKETING`
  (ya `_TEAM` suffix ke saath bhi chalega)
- `assignedToUserId` (optional): kisi specific employee ko assign — employee us team
  ka hona chahiye (id `/api/public/employees?team=Backend` se lo)
- `reason` (optional)

Response:
```json
{
  "success": true,
  "message": "Forwarded to BACKEND_TEAM and assigned to Vaibhavi Konde",
  "leadId": "...",
  "transitLevel": "BACKEND_TEAM",
  "assignedToUserId": "...",
  "assignedToUserName": "Vaibhavi Konde"
}
```

---

## 2. Employees (dropdown / specific user search)

`GET /api/public/employees`

| Param | Matlab |
|-------|--------|
| `team` | `Calling` / `Executive` / `Backend` / `Accounting` / `Marketing` |
| `searchText` | naam ya email se specific user dhoondo |

```bash
curl "https://<domain>/api/public/employees?team=Calling&searchText=amit" \
  -H "x-api-key: your_super_secret_key_12345"
```

Response: `{ "success": true, "employees": [ { id, name, firstName, lastName, email, team, roles } ] }`

---

## 3. Clients (dropdown / search / create)

`GET /api/public/clients?searchText=ravi&clientType=OWNER&page=0&pageSize=20`
`POST /api/public/clients` (body: `firstName`, `phoneNo` required)

---

## 4. Dropdown reference data

`GET /api/public/dropdowns` → `cities`, `areas`, `leadStatuses`,
`agreementStatuses`, `backOfficeStatuses`, plus static `clientTypes` aur `teams`.

```bash
curl https://<domain>/api/public/dropdowns -H "x-api-key: your_super_secret_key_12345"
```

---

## Errors

| Status | Matlab |
|--------|--------|
| 400 | Invalid JSON / missing required field |
| 401 | Galat ya missing API key |
| 404 | Lead/client nahi mila |
| 409 | Duplicate phone (client) |
| 500 | Server error |

## JavaScript example (kisi bhi website me)

```js
const API = "https://<domain>/api/public";
const KEY = "your_super_secret_key_12345";

// lead add
await fetch(`${API}/leads`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": KEY },
  body: JSON.stringify({ firstName: "Ravi", phoneNo: "9876543210" }),
});

// leads search
const res = await fetch(`${API}/leads?searchText=ravi&page=0`, {
  headers: { "x-api-key": KEY },
});
const data = await res.json();
```
