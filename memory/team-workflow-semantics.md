---
name: team-workflow-semantics
description: LegalWings lead team workflow — who "worked" a lead, forwarding, and list ordering rules
metadata:
  type: project
---

Lead lifecycle: Calling → Executive → Backend teams. A lead is moved via `POST /api/leads/[id]/assign-team`, which sets `forwardedAt = new Date()`, appends a `forwardedHistory` entry `{ fromTeam, toTeam, forwardedBy, forwardedAt }`, and overwrites `assignedToUserName` with the destination employee.

Key business rules:
- The **Executive team collects/receives payments**. In the Payment Statement, "Collector / Receiver" and "Executive Name" must show the *executive* who worked the lead — NOT `assignedToUserName` (which becomes the Backend employee after forwarding). Derive it from the most recent `forwardedHistory` entry where `fromTeam === 'EXECUTIVE_TEAM'` (its `forwardedBy`), falling back to `assignedToUserName` then `createdByUserName`. See `executiveFor()` in `app/payment-statement/page.tsx`.
- A lead just forwarded INTO a team (esp. Backend) must appear at **serial #1**, even if it's an old lead — no auto date filter; filters only apply when manually set. The leads list sorts by "arrived in this team" time = `forwardedAt` (preferred) else `createdAt`/`createdDate`, descending, in `app/api/leads/route.ts`. Legacy data mixes ISO-string and Date types, so `$convert` to date before sorting or MongoDB's String<Date type ordering scrambles the order.
