# SENTRi — Movement Intelligence Platform

**by IGATA Technologies**

SENTRi is a multi-tenant movement intelligence SaaS platform for secure facilities — military installations, oil and gas facilities, industrial campuses, and high-security corporate headquarters.

---

## Architecture

Single React PWA — one Netlify deployment, infinite tenants.

### Three interfaces, one codebase

| Route | Who | Access |
|---|---|---|
| `/gate/:tenantSlug/:gateSlug` | Gate officers | Open URL — shift-based identity |
| `/command` | CO, COS, Intelligence | Email + password login |
| `/admin` | IGATA superadmin | Hardened login |

### Multi-tenancy

Every installation is a **tenant**. All data is scoped by `tenant_id`. Row Level Security enforces isolation at the database level — one tenant cannot see another's data.

---

## Stack

- **Frontend**: React + Vite PWA
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + RLS)
- **OCR**: Tesseract.js (on-device, offline capable)
- **Email**: Nodemailer + Gmail SMTP
- **Deploy**: Netlify (connected to this GitHub repo)

---

## Setup

### 1. Supabase
Run `supabase/schema.sql` in your SENTRi Supabase project SQL editor.

### 2. Environment
```
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 3. Install and run
```
npm install
npm run dev
```

### 4. Gate URLs
Gate officer URLs follow this pattern:
```
https://your-sentri.netlify.app/gate/{tenant-slug}/{gate-slug}
```
Example: `https://sentri.netlify.app/gate/ikeja-cantonment/main-gate`

---

## Phases

- [x] Phase 1 — Multi-tenant schema + unified codebase
- [x] Phase 2 — Guard PWA (shift, admit, checkout, handover)
- [x] Phase 3 — Command dashboard (live, watchlist, alerts, report, gates, profile)
- [ ] Phase 4 — Superadmin panel (tenant management)
- [ ] Phase 5 — Self-serve tenant registration
- [ ] Phase 6 — Nodemailer weekly and monthly reports
- [ ] Phase 7 — Logo upload, full profile management

---

*SENTRi is a proprietary product of IGATA Technologies. All rights reserved.*
