# Lead API Demo

A tiny standalone Lead API — **no dependencies**, just Node.js. Shows how to
**add leads** and **filter** them by number, usertype, and status.

## Run

```bash
cd demo
node server.js
```

Then open: http://localhost:4000

## API

### Add a lead
```
POST /api/leads
Content-Type: application/json

{ "name": "Ramesh", "number": "9876543210", "usertype": "owner", "status": "pending" }
```

### Get / filter leads
| Request | What it does |
|---|---|
| `GET /api/leads` | all leads |
| `GET /api/leads?number=9876543210` | by phone number (partial match) |
| `GET /api/leads?usertype=owner` | only owners (or `tenant`) |
| `GET /api/leads?status=pending` | only pending (or `completed`) |
| `GET /api/leads?number=98&usertype=owner&status=pending` | combine any filters |

Filters are **AND**-combined, so you can ask for a specific user *and* a status
together — e.g. owner whose number contains `98` and whose status is `pending`.

## Examples (curl)

```bash
# add
curl -X POST http://localhost:4000/api/leads \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\",\"number\":\"9000000000\",\"usertype\":\"tenant\",\"status\":\"completed\"}"

# filter
curl "http://localhost:4000/api/leads?usertype=owner&status=pending"
curl "http://localhost:4000/api/leads?number=9876543210"
```

> Data is in-memory and resets each time the server restarts.
