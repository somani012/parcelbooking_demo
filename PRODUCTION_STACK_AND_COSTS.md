# Parcel Portal — Production Stack & Cost Plan

_Prepared 2026-09-03. Prices were pulled live from vendor pricing pages (sources at the bottom). USD→INR assumed at **₹88/USD** — adjust to the day's rate. All INR figures exclude 18% GST on SaaS invoices unless noted._

---

## 1. Where the MVP stands today

| Area | Current state | Production verdict |
|---|---|---|
| Framework | Next.js 14 App Router, Server Actions, TypeScript | ✅ Keep — correct choice, upgrade to Next 15 |
| ORM / DB | Prisma 5 + PostgreSQL (Supabase pooler) | ✅ Keep |
| Auth | Custom JWT (`jose`) + bcrypt, single cookie, 2 roles | ⚠️ Works but needs org support, password reset, rate-limiting, 2FA |
| Tenancy | **Single-tenant** — one `CompanySettings` row (id=1), global `Counter`, global `Service`/`PricingRule` | ❌ Must be redesigned before onboarding tenant #2 |
| File storage | Payment screenshots & logos stored as `Bytes` **inside Postgres** | ❌ Move to object storage — bloats DB, backups, and egress |
| PDF / Excel | `pdfkit`, `exceljs` generated in-request | ⚠️ OK at low volume; move to background jobs at scale |
| Payments | Manual UPI/bank transfer + UTR + screenshot, admin approves | ⚠️ Keep as option; add Razorpay for instant auto-credit |
| Notifications | None | ❌ Need email + SMS/WhatsApp for bookings, status, low balance |
| Observability | None | ❌ Need error tracking, logs, uptime |
| Background jobs | None | ❌ Need for notifications, tracking sync, exports |
| Tests / CI | None | ❌ Need at minimum: typecheck, lint, Prisma migrate check, smoke tests |
| Migrations | `prisma db push` (no migration history) | ❌ Switch to `prisma migrate` |

**Bottom line:** the app skeleton is sound. Don't rewrite. Harden and extend it.

---

## 2. Recommended production stack

The guiding rule: **stay on Next.js + Prisma + Postgres**, buy managed services for everything that isn't your core business logic, and keep the whole thing deployable by one person.

### 2.1 Core

| Layer | Recommendation | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router, Server Actions, Route Handlers) | You're already here; 15 fixes caching foot-guns and async `cookies()` |
| Language | TypeScript strict mode | Already in place |
| UI | Tailwind + **shadcn/ui** + React Hook Form + Zod | Replace ad-hoc `ui.tsx`; Zod schemas shared between forms and Server Actions |
| Validation | **Zod** everywhere (forms, actions, env vars, webhooks) | Current code does manual string checks |
| ORM | **Prisma 6** with `prisma migrate` | Migration history, rollback, CI verification |
| Database | **PostgreSQL 16** on Supabase (Mumbai `ap-south-1`) | See §4 — data residency in India, pooler included, backups included |
| Auth | **Better Auth** (open source) with the `organization` plugin, or **Clerk** if you'd rather buy | Better Auth = $0, Prisma adapter, orgs/roles/invites, 2FA, magic links. Clerk = fastest, $25/mo+ |
| Multi-tenancy | Shared DB, `tenant_id` on every table, **Postgres Row-Level Security** enforced via Prisma client extension + subdomain routing | See §3 |
| Object storage | **Cloudflare R2** (S3-compatible, zero egress) | Screenshots, logos, generated PDFs/XLSX, tenant assets |
| Cache / rate-limit | **Upstash Redis** (serverless, HTTP) | Rate-limit login/OTP, cache pricing rules, session denylist |
| Background jobs | **Inngest** or **Trigger.dev** | Emails, WhatsApp, courier tracking polling, monthly statements, large exports. Both have free tiers |
| Email | **Resend** | Booking confirmations, statements, password reset, invoices |
| SMS + WhatsApp | **MSG91** (India-native, DLT handled, WhatsApp Business API at Meta rates with no markup) | Tracking updates to receivers, OTPs, low-balance alerts |
| Payments | **Razorpay** (Payment Links / Standard Checkout + webhooks) alongside existing manual UTR flow | Instant wallet top-ups, auto-reconciliation, GST invoices |
| PDF | Keep `pdfkit`, run in a background job, store result in R2 | Or `@react-pdf/renderer` if you want templated slips |
| Error tracking | **Sentry** | Errors + performance + session replay |
| Logs / uptime | **Vercel logs → Axiom or Better Stack**; Better Stack uptime | Cheap, good alerting to Slack/WhatsApp |
| Analytics | **PostHog** (free tier is generous) | Product analytics per tenant |
| CI/CD | **GitHub Actions** → Vercel preview + production | Lint, typecheck, `prisma migrate diff`, Playwright smoke |
| Secrets | Vercel env vars + Doppler or 1Password (optional) | Never commit `.env` again — rotate the Supabase password that's currently in it |

### 2.2 Things to explicitly *not* add yet
- Microservices, Kubernetes, message brokers (Kafka/RabbitMQ) — unnecessary below ~1M bookings/month.
- A separate mobile app — ship a PWA first; the client portal is form-heavy and works fine responsive.
- GraphQL — Server Actions + Route Handlers cover everything.
- Self-hosted Postgres — the ops cost outweighs the savings until you're spending >$500/mo on DB.

---

## 3. Multi-tenant architecture

"Several tenants simultaneously" = multiple parcel companies, each with their own clients, pricing, branding, bank details, and counters. This is the single biggest change from the MVP.

### 3.1 Data model changes

```
Tenant            (id, slug, name, plan, status, customDomain?, createdAt)
TenantSettings    (tenantId PK → replaces CompanySettings id=1)
User              (+ tenantId, role: OWNER | ADMIN | STAFF | CLIENT)
Client            (+ tenantId; unique(tenantId, clientCode), unique(tenantId, email))
Service           (+ tenantId; unique(tenantId, name))
PricingRule       (+ tenantId)
Booking           (+ tenantId; unique(tenantId, bookingId); index(tenantId, clientId, createdAt))
Payment           (+ tenantId; screenshotUrl instead of Bytes)
Transaction       (+ tenantId)
Counter           (key becomes composite: tenantId + key)
AuditLog          (+ tenantId)
```

Also add: `Invoice` (GST-compliant, monthly per client), `Notification` (outbox), `Courier`/`TrackingEvent` (when you integrate Delhivery/DTDC/Shiprocket), `ApiKey` (tenant API access), `Webhook`.

### 3.2 Isolation strategy — shared database with RLS

| Option | Cost | Isolation | Verdict |
|---|---|---|---|
| Shared DB, `tenant_id` column + **RLS** | 1× DB | Strong (DB-enforced) | ✅ **Recommended** — cheapest, simplest ops, safe |
| Schema-per-tenant | 1× DB, N schemas | Stronger | Migrations get painful past ~50 tenants |
| DB-per-tenant | N× DB cost | Strongest | Only for enterprise tenants who demand it (offer as premium tier later) |

Implementation:
1. Every tenant-owned table gets `tenant_id` with `ENABLE ROW LEVEL SECURITY` and a policy `tenant_id = current_setting('app.tenant_id')::text`.
2. A Prisma client extension wraps every query in `SET LOCAL app.tenant_id = $1` inside a transaction (or use Prisma's `$extends` with a `tenantId` injection in `where`/`data` as defense-in-depth).
3. Middleware resolves the tenant from the hostname: `acme.yourportal.in` → `tenant.slug = 'acme'`. Custom domains (`portal.acmecouriers.com`) via Vercel's domain API.
4. The session JWT carries `tenantId`; the RLS setting is derived from the session **server-side only**, never from client input.
5. Platform super-admin (you) gets a separate `/platform` area that bypasses RLS with a dedicated DB role.

### 3.3 Per-tenant things to parameterise
Branding/logo, GST %, UPI/bank details, booking-ID prefix, terms text, email sender name, WhatsApp template set, allowed services and pricing, plan limits (bookings/month, users, storage).

### 3.4 Billing the tenants
Tenants pay you. Options: Razorpay Subscriptions (India, INR, supports UPI Autopay), or Stripe if you go international. Plan gating via `Tenant.plan` + a feature-flag helper. Start with 3 plans: Starter / Growth / Enterprise.

---

## 4. Hosting & deployment

### 4.1 Recommended — Phase 1 (launch → ~30 tenants)

```
GitHub ──push──▶ GitHub Actions (lint, typecheck, migrate check, tests)
                      │
                      ▼
                 Vercel (Pro)  ── region bom1 (Mumbai) for functions
                      │
        ┌─────────────┼──────────────┬────────────────┬───────────────┐
        ▼             ▼              ▼                ▼               ▼
   Supabase       Cloudflare R2   Upstash Redis   Inngest/Trigger   Resend / MSG91 / Razorpay
   Postgres       (files)         (cache, RL)     (jobs)            (email / SMS+WA / payments)
   ap-south-1
```

- **Vercel Pro**: one project, preview deployments per PR, production on `main`. Set function region to **Mumbai (bom1)** so DB round-trips are ~2 ms not ~200 ms.
- **Supabase Pro**, project in **Mumbai**. Use the transaction pooler (port 6543) for the app, direct connection (5432) for migrations. Enable PITR add-on once real money flows through the wallet.
- **Cloudflare**: DNS + R2 + free WAF/DDoS in front of the custom tenant domains.
- **Staging environment**: separate Vercel project + Supabase project (Free/Micro) seeded with fake data. Never test against production.

### 4.2 Alternative — if you want to leave Vercel
Railway or Render (Docker, always-on server, no per-seat cost, no bandwidth surprises). Same Supabase/R2/etc. Railway Pro is $20/mo including $20 of usage; a Next.js app at moderate traffic runs ~$10–15/mo of compute. Choose this if you expect heavy egress (lots of PDF/XLSX downloads) — Vercel's included 1 TB is fine early but overages are steep.

### 4.3 Scale path — Phase 2 (50+ tenants / 100k+ bookings per month)
Move the database to **AWS RDS PostgreSQL (Mumbai), db.t4g.medium Multi-AZ** or upgrade Supabase compute; keep the app on Vercel or move to ECS Fargate/Railway. Add a read replica for reporting/exports. This is a config change, not a rewrite, because Prisma + Postgres are unchanged.

### 4.4 Data residency & compliance (India)
- **DPDP Act 2023**: you're a data fiduciary; tenants are too. Need consent notices, purpose limitation, breach notification, data deletion on request. Keep all PII in Mumbai region.
- **GST**: tenants need GST-compliant invoices for their clients; you need them for tenants. Store GSTIN, HSN/SAC code for courier services (SAC 9968), CGST/SGST vs IGST split by state.
- **TRAI DLT**: mandatory for any SMS in India. Register your entity + every SMS template. Sender ID per tenant if they want their own brand.
- **RBI**: you're not holding customer funds in a regulated sense if the wallet is a prepaid ledger against the tenant, but get a CA's opinion once you're above a few lakh/month. Don't pool tenant money in your own account — use Razorpay Route or per-tenant Razorpay accounts.

---

## 5. Cost estimate

Three scenarios. "Bookings" = shipments created per month across all tenants.

### 5.1 Monthly recurring — infrastructure & SaaS

| Service | Launch<br>(1–5 tenants, ≤3k bookings/mo) | Growth<br>(10–30 tenants, 20–50k bookings/mo) | Scale<br>(50+ tenants, 100k+ bookings/mo) |
|---|---|---|---|
| **Vercel** Pro ($20/seat, 1 TB BW + 1M invocations incl.) | $20 (1 seat) | $40–60 (2–3 seats) | $100–300 (5 seats + bandwidth/function overage) |
| **Supabase** Pro ($25 incl. $10 compute credit, 8 GB DB, 250 GB egress, daily backups) | $25 (Micro compute) | $40–85 (Small/Medium compute add-on) | — (migrate to RDS) |
| **AWS RDS** Postgres db.t4g.medium (2 vCPU/4 GB, $0.065/hr) Multi-AZ + 100 GB gp3 + backups | — | — | $130–160 |
| **Cloudflare R2** ($0.015/GB-mo, 10 GB free, egress free) | $0 | $2–5 | $10–25 |
| **Upstash Redis** (PAYG $0.20/100k cmds; fixed 250 MB $10, 1 GB $20) | $0–5 | $10–20 | $100 (5 GB fixed) |
| **Better Auth** (self-hosted) / **Clerk** Pro ($25/mo, 50k MRU; B2B org add-on $100/mo) | $0 / $25 | $0 / $25 | $0 / $125 |
| **Inngest** or **Trigger.dev** background jobs | $0 (free tier) | $20–50 | $100–200 |
| **Resend** (free 3k/mo; Pro $20 = 50k; Scale $90 = 100k) | $0 | $20 | $90 |
| **Sentry** (Dev free; Team $26/mo annual, 50k errors; Business $80) | $0 | $26 | $80 |
| **Better Stack / Axiom** logs + uptime | $0 | $0–25 | $50–100 |
| **PostHog** analytics | $0 | $0–20 | $50–100 |
| **Cloudflare** DNS/WAF (Free plan) | $0 | $0 | $0–20 (Pro) |
| **Domain** (.in / .com, ~$12–15/yr) | $1 | $1 | $2 |
| **Subtotal (USD/mo)** | **≈ $45–75** | **≈ $160–320** | **≈ $710–1,260** |
| **Subtotal (₹/mo @ ₹88)** | **≈ ₹4,000–6,600** | **≈ ₹14,000–28,000** | **≈ ₹62,000–1,11,000** |

> Launch column assumes Better Auth ($0) and free tiers. If you pick Clerk, add $25/mo. Add 18% GST on top for Indian-billed vendors; US vendors bill without GST but you may owe reverse-charge GST — ask your CA.

### 5.2 Usage-based / pass-through costs (scale with volume, usually re-billed to tenants)

| Item | Rate (verified) | Example at Growth tier |
|---|---|---|
| **Razorpay** platform fee (UPI, cards, net banking) | **2% + 18% GST = 2.36%** of successful transaction. New merchants currently get a 0% platform-fee promo period; ₹199 one-time KYC | ₹20 lakh/mo wallet top-ups → **₹47,200/mo**. Standard practice: pass to tenant/client as a convenience fee or absorb on UPI only |
| **MSG91 SMS** (India→India, transactional, DLT) | **₹0.25/SMS** at 5k, **₹0.18** at 30k, **₹0.17** at 60k+, ~₹0.13 negotiated (+18% GST) | 40k bookings × 3 SMS (booked, dispatched, delivered) = 120k SMS → **≈ ₹20,400 + GST** |
| **MSG91 WhatsApp** (Meta rates, no markup) | **Utility ₹0.115**, Authentication ₹0.115, Marketing ₹0.8631 per conversation | Same 120k as utility → **≈ ₹13,800**. WhatsApp is cheaper *and* better for tracking updates |
| **Resend overage** | $0.90 / 1,000 emails | Rarely hit at Growth |
| **Vercel bandwidth overage** | ~$0.15/GB beyond 1 TB | Only if PDF/XLSX downloads explode |
| **Supabase storage/egress overage** | $0.125/GB DB storage; $0.09/GB egress beyond 250 GB | Avoidable by keeping files in R2 |

### 5.3 One-time / annual costs

| Item | Cost | Notes |
|---|---|---|
| Domain(s) | ₹800–1,500/yr each | `.in` for India-first branding |
| TRAI DLT entity + template registration | ≈ ₹5,000–6,000 one-time per operator portal (Jio/Airtel/Vi), + per-template fees vary | Required before any SMS goes out. MSG91 walks you through it |
| Razorpay KYC | ₹199 one-time | Verified from Razorpay pricing blog |
| Company GST registration, CA setup | ₹2,000–10,000 | If not already done |
| Security review / pen-test before onboarding paying tenants | ₹50,000–2,00,000 one-time | Optional but strongly advised once wallets hold real money |
| Apple/Google developer accounts | $99/yr + $25 one-time | Only if you later ship native apps |

### 5.4 Total cost of ownership snapshot

| Scenario | Fixed infra/SaaS | Pass-through (SMS+WA+PG at typical volumes) | **All-in ₹/month** |
|---|---|---|---|
| Launch | ₹4,000–6,600 | ₹2,000–8,000 | **≈ ₹6,000–15,000** |
| Growth | ₹14,000–28,000 | ₹40,000–90,000 | **≈ ₹55,000–1,20,000** |
| Scale | ₹62,000–1,11,000 | ₹1,50,000–4,00,000 | **≈ ₹2,10,000–5,10,000** |

Notice that at Growth and beyond, **payment-gateway fees and messaging dwarf infrastructure**. Price your tenant plans to recover those, e.g. per-booking fee that bundles 1 WhatsApp + 1 SMS, and a 2% convenience fee on gateway top-ups.

---

## 6. Everything you need to prepare — checklist

### Product / architecture
- [ ] Add `Tenant` model + `tenant_id` on all tables; write RLS policies; Prisma extension for tenant scoping
- [ ] Subdomain routing in middleware; custom-domain support via Vercel API
- [ ] Move `CompanySettings` → `TenantSettings`; make `Counter` per-tenant; make `Service`/`PricingRule` per-tenant
- [ ] Replace `Bytes` columns with R2 URLs (signed URLs for screenshots)
- [ ] Switch `prisma db push` → `prisma migrate`; commit migration history
- [ ] Better Auth (or Clerk) with org roles OWNER/ADMIN/STAFF/CLIENT; password reset; optional 2FA; login rate-limit via Upstash
- [ ] Razorpay top-up flow + webhook (idempotent, signature-verified) → auto-credit wallet + `Transaction`
- [ ] Notification outbox + Inngest jobs: booking confirmed, status change, low balance, monthly statement
- [ ] GST-compliant invoice model + PDF
- [ ] Courier integration abstraction (Delhivery / DTDC / Shiprocket) for AWB + tracking sync
- [ ] Tenant plan limits + platform super-admin dashboard
- [ ] Soft-delete + data export per tenant (DPDP right-to-erasure and portability)

### Infrastructure
- [ ] Vercel Pro project (region bom1), separate staging project
- [ ] Supabase Pro in Mumbai; enable PITR before go-live with real money; rotate the DB password currently sitting in `.env`
- [ ] Cloudflare account: DNS, R2 bucket (private), WAF rules
- [ ] Upstash Redis, Resend domain verification (SPF/DKIM/DMARC), MSG91 account + DLT, Razorpay live keys
- [ ] Sentry project (Next.js SDK, source maps), uptime monitor on `/api/health`
- [ ] GitHub Actions: lint, `tsc`, `prisma migrate diff --exit-code`, Playwright smoke; block merge on failure
- [ ] Env var hygiene: `.env` in `.gitignore`, Zod-validated `env.ts`, secrets only in Vercel/Doppler

### Security
- [ ] Percent-encode special characters in `DATABASE_URL` (the current password contains a raw `@`)
- [ ] CSRF is handled by Server Actions, but add `Origin` checks on Route Handlers that mutate
- [ ] Content-Security-Policy, HSTS, secure cookies (already `httpOnly`/`sameSite=lax`)
- [ ] Audit log for every money movement (already started in `AuditLog` — make it append-only)
- [ ] Backups tested with an actual restore drill
- [ ] Pen-test before first paying tenant

### Legal / finance (India)
- [ ] Terms of Service + Privacy Policy (DPDP-compliant), per-tenant DPA
- [ ] GST registration; SAC 9968 for courier services; CGST/SGST/IGST logic
- [ ] Razorpay Route or per-tenant accounts so tenant funds don't pool in yours
- [ ] CA opinion on the prepaid wallet ledger model

---

## 7. Sources (fetched 2026-09-03)

- Vercel pricing — https://vercel.com/pricing and https://vercel.com/docs/pricing ; independent breakdown https://makerkit.dev/blog/saas/vercel-cost
- Supabase pricing — https://supabase.com/pricing ; https://makerkit.dev/blog/saas/supabase-pricing
- Neon pricing (alternative DB) — https://neon.com/pricing ($0.106/CU-hr Launch, $0.35/GB-mo storage)
- AWS RDS db.t4g.medium — https://instances.vantage.sh/aws/rds/db.t4g.medium ($0.065/hr on-demand)
- Cloudflare R2 — https://developers.cloudflare.com/r2/pricing/
- Resend — https://resend.com/pricing ; https://resend.com/docs/knowledge-base/what-is-resend-pricing
- Sentry — https://sentry.io/pricing/ ; https://last9.io/blog/sentry-pricing/
- Upstash Redis — https://upstash.com/pricing/redis
- Clerk — https://clerk.com/pricing
- Razorpay — https://razorpay.com/pricing/ ; https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/
- MSG91 SMS India — https://msg91.com/in/pricing/sms ; WhatsApp — https://msg91.com/in/pricing/whatsapp
- Railway vs Render — https://northflank.com/blog/railway-vs-render ; https://makerkit.dev/blog/tutorials/best-hosting-nextjs

_Not live-verified (from general knowledge, confirm before budgeting): Inngest/Trigger.dev paid tiers, Supabase PITR add-on price, DLT registration fees, Better Stack/Axiom/PostHog paid tiers, Mumbai-region uplift on AWS (typically +5–10% over us-east-1)._
