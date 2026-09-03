# Parcel & Document Booking Management Portal (MVP)

A two-role web portal for a courier/parcel business:

- **Clients** book shipments, get system-calculated charges (weight-slab pricing + GST), pay from a prepaid balance, submit UPI/bank payments for verification, download PDF booking slips, export Excel, and view a full transaction ledger.
- **Supervisor/Admin** verifies payments, manages bookings (status, tracking/AWB, cancel + refund), clients (create/edit/disable, password reset, manual balance adjustments), services and weight-slab pricing, company settings (logo, UPI/bank details, GST %), reports, and an audit log.

Built with **Next.js 14 (App Router, TypeScript) + Tailwind + Prisma + PostgreSQL**.

## Quick start (local)

Requirements: Node 18.17+ and Docker (or any PostgreSQL 14+).

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
npm install

# 3. Create tables and load demo data
npm run setup

# 4. Run
npm run dev
```

Open http://localhost:3000

If you're not using Docker, edit `DATABASE_URL` in `.env` to point at your PostgreSQL (a Supabase connection string works as-is), then run steps 2-4.

## Demo logins

| Role   | Email               | Password   |
|--------|---------------------|------------|
| Admin  | admin@portal.test   | Admin@123  |
| Client | client1@portal.test | Client@123 |
| Client | client2@portal.test | Client@123 |

You can also log in with the mobile number (e.g. `9876543210` for client1).

Seeded: 2 clients, 4 services with weight-slab pricing, 10 bookings across statuses/months, 5 payments (approved / pending / rejected), a cancelled booking with refund, and a consistent transaction ledger. The admin dashboard has one payment waiting for verification so you can try the approval flow immediately.

## How money moves (the important invariants)

- **Charges are always calculated on the server** from the pricing rules + GST % in settings; nothing from the browser is trusted.
- **Booking confirmation is atomic**: a conditional `UPDATE ... WHERE balance >= total` deducts the balance inside a transaction, so double-submits or concurrent bookings can never overdraw. Insufficient balance shows the exact shortfall with an "Add money" link.
- **Every balance change writes a ledger row** (`transactions`) with `balance_after`, and admin actions (approve/reject payment, cancel/refund, manual adjustment, status changes) also write to `audit_logs`.
- **Payment approval is idempotent**: only a `PENDING -> APPROVED` transition credits the balance, so a double-click can't credit twice. Duplicate UTR numbers are rejected by a unique constraint.

## Structure

```
prisma/schema.prisma     # all tables (snake_case in DB, camelCase in code)
prisma/seed.ts           # demo data
src/middleware.ts        # role-based routing guard (/admin vs /client)
src/lib/                 # auth (JWT cookie), pricing, ids (BK-2026-00001...), pdf, excel, filters
src/actions/             # server actions: auth, bookings, payments, admin
src/app/client/...       # client portal pages
src/app/admin/...        # admin console pages
src/app/api/             # downloads: PDF slip, Excel exports, screenshot, logo
```

## Deploying

- **Vercel + Supabase**: create a Supabase project, put its connection string (URI, port 5432 or the pooled 6543 string) in `DATABASE_URL`, set a strong `AUTH_SECRET`, run `npx prisma db push && npm run db:seed` once locally against that URL, then deploy to Vercel with the same env vars.
- Any Node host + PostgreSQL works the same way (`npm run build && npm start`).

## MVP simplifications (deliberate)

- Payment screenshots and the company logo are stored in PostgreSQL (`bytea`) so no file-storage service is needed; swap for S3/Supabase Storage later if volumes grow.
- Sessions are stateless 12-hour JWT cookies; "log out everywhere" would need a session table.
- `quantity` is informational; charges are per shipment weight (matching the spec's pricing model).
- No payment gateway, live carrier tracking, or SMS/WhatsApp - excluded from MVP scope by design.
