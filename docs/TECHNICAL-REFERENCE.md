# SENTRi — Technical Reference & Codebase Map

**Last updated:** June 16, 2026
**Maintained for:** IGATA Consulting Technologies Ltd
**Purpose:** A single source of truth for anyone touching this codebase — Mannie, a future hire, a contractor, or a future AI session — so that "where does X live and why" never has to be re-derived from scratch.

This document describes the system as it actually is, verified against the live repository, schema, and dashboards as of the date above. Where something is planned but not built, it is explicitly marked **(not yet built)**.

---

## 1. What SENTRi Is

SENTRi is a movement intelligence platform: a gate-logging and analytics system for installations that need to track who and what enters and exits — military cantonments, oil and gas facilities, residential estates, corporate campuses. A guard at a gate logs entries and exits on a phone-based app; that data flows in real time to a command dashboard where supervisors monitor activity, manage watchlists, respond to incidents, and generate intelligence reports.

**Important calibration, stated plainly because it matters for any external-facing claim:** SENTRi's intelligence today is algorithmic — rule-based scoring, threshold logic, and templated narrative generation. There is no machine learning model or neural network anywhere in this stack. Every output can be traced to a specific line of code. This is a strength, not a limitation, when describing the system to a technical evaluator: it is fully auditable and explainable. AI-narrative generation is a real, named item on the roadmap (Section 8) but does not exist yet.

---

## 2. Company and Account Reference

| Item | Value |
|---|---|
| Company | IGATA Consulting Technologies Ltd (CAC-registered) |
| Founder/CEO | Mannie Oyewole |
| Product | SENTRi — Movement Intelligence Platform |
| Marketing site | sentri.ng |
| Platform (app) | app.sentri.ng |
| GitHub org | IGATA-Consulting-Technologies |
| Repo (app) | github.com/IGATA-Consulting-Technologies/SENTRi |
| Repo (marketing) | github.com/IGATA-Consulting-Technologies/SENTRi-website |
| Supabase org | "GatePass SaaS" (shared with an earlier, separate IGATA product) |
| Supabase project | SENTRi — ref `zrnkwhxsqxkaimvyqixg`, region EU-West-1 (Ireland) |
| Netlify project (app) | `sentri-igata` |
| Netlify project (marketing) | `sentri-website` |
| Local repo path | `C:\Users\manni\OneDrive\Documents\GitHub\SENTRi` |
| Contacts | info@sentri.ng · +234 802 308 8748 · igataprojects@gmail.com |

---

## 3. High-Level Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Guard PWA          │         │  Command Dashboard    │
│   app.sentri.ng/gate/ │         │  app.sentri.ng         │
│   :tenantSlug/:gateSlug │       │  (no /gate prefix)    │
└──────────┬───────────┘         └───────────┬───────────┘
           │                                  │
           │         Same React app (App.jsx routes between them)
           │                                  │
           └────────────────┬─────────────────┘
                             │
                  ┌──────────▼───────────┐
                  │   Supabase Postgres    │
                  │   (zrnkwhxsqxkaimvyqixg)│
                  │   Row-level security    │
                  │   scoped by tenant_id   │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │  Netlify Functions      │
                  │  (serverless backend)   │
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │  External services      │
                  │  - Resend (email)        │
                  │  - PlateRecognizer (OCR) │
                  └───────────────────────┘
```

**One codebase, two front-end surfaces.** The Guard PWA and the Command Dashboard are not separate apps — they are the same React/Vite project, with `App.jsx` routing to different page trees depending on the URL path. Both talk to the same Supabase project and the same tables, with every query implicitly scoped to the logged-in user's `tenant_id` via Postgres row-level security (RLS). This is the architectural reason a guard at one estate can never see another estate's data — it is enforced at the database layer, not just in application code, which is the correct and more defensible way to do it.

**Database is the single source of truth.** There is no separate cache or secondary store. Every read the dashboard does and every write the gate app makes goes directly to Postgres.

**Realtime sync.** The Command Dashboard subscribes to a Supabase realtime channel (`command-badges`, set up in `CommandApp.jsx`) listening for `INSERT`/`UPDATE` events on `flag_alerts` and `incidents`, filtered by tenant. This is what makes the Live tab update without a manual page refresh — Postgres pushes the change out the moment a guard's write commits.

---

## 4. Repository Structure

```
SENTRi/
├── .env.example              # Template for required environment variables
├── netlify.toml               # Build config, function schedules, redirects
├── package.json
├── index.html
├── vite.config.js
├── supabase/
│   └── schema.sql              # Full database schema — see Section 6
├── netlify/functions/
│   ├── send-alert-email.js      # Sends ALL outbound email (flag/incident/report/welcome)
│   ├── weekly-digest.js          # Scheduled function, runs Mondays 07:00 UTC
│   └── plate-recognizer.js       # Proxies vehicle plate OCR requests
├── public/
│   ├── manifest-gate.json        # PWA manifest for the Guard app
│   ├── manifest-command.json     # PWA manifest for the Command Dashboard
│   └── icons/
├── src/
│   ├── App.jsx                   # Top-level router — splits Guard vs Command
│   ├── main.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js            # Supabase client initialization
│   │   ├── email.js                # Email HTML templates (flag/incident/report)
│   │   └── offline.js              # IndexedDB offline-queue helpers
│   ├── store/
│   │   └── index.js                 # Shared app state
│   ├── components/
│   │   └── PWAInstallPrompt.jsx
│   └── pages/
│       ├── auth/
│       │   ├── Register.jsx          # Tenant signup
│       │   ├── CommandLogin.jsx       # Command/admin login
│       │   ├── OnboardingWizard.jsx    # Post-signup setup flow
│       │   └── ResetPassword.jsx
│       ├── gate/                       # GUARD PWA — phone-facing
│       │   ├── GateApp.jsx               # Gate-side router/shell
│       │   ├── ShiftStart.jsx             # Shift handover/start screen
│       │   ├── ShiftPage.jsx
│       │   ├── AdmitPage.jsx               # Vehicle/pedestrian admission, OCR
│       │   ├── CheckoutPage.jsx             # Exit logging
│       │   ├── GateLogPage.jsx               # On-device movement log view
│       │   └── ReportIncidentPage.jsx         # Guard-side incident reporting
│       ├── command/                     # COMMAND DASHBOARD — admin-facing
│       │   ├── CommandApp.jsx             # Command-side router/shell, realtime subscription
│       │   ├── tabs.jsx                    # Profile/settings tab incl. alert recipients
│       │   ├── LiveTab.jsx
│       │   ├── HistoryTab.jsx
│       │   ├── IncidentsTab.jsx
│       │   ├── AlertsTab.jsx
│       │   ├── WatchlistTab.jsx
│       │   ├── GatesTab.jsx
│       │   ├── ReportTab.jsx                # Intelligence Brief generator — see Section 7
│       │   ├── ProfileTab.jsx
│       │   └── CCTVTab.jsx
│       ├── admin/
│       │   └── AdminApp.jsx                  # IGATA superadmin panel
│       └── NotFound.jsx
```

### ⚠️ Repo root cleanup needed (flagged, not actioned)

The repository root currently contains roughly 30–40 one-off scripts and text dumps from past debugging sessions (`fix_*.js`, `*_audit.txt`, `deploy_*.js`, `push_*.js`, `read_*.js`, etc.), plus a `files.zip`. None of these are part of the running application — they were tools used once to diagnose or patch something and then left in place. This is normal residue from fast iterative work, but it actively hurts onboarding: a new developer opening this repo for the first time cannot tell at a glance what is live code and what is a fossil.

**Recommendation:** move these into a `/scripts-archive/` folder (or delete outright, since they're all preserved in git history regardless) in a dedicated cleanup commit, separate from any feature work, so the diff is easy to review and revert if anything turns out to still be needed. Not done as part of this document — flagged for a deliberate decision.

---

## 5. Environment Variables

Defined in `.env.example` (template) and set as real values in Netlify's environment variable settings for the live deploys.

| Variable | Purpose | Where it's used |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | `src/lib/supabase.js` |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key | `src/lib/supabase.js` |
| `VITE_APP_URL` | Base URL used to generate gate links | Gate URL generation in Command Dashboard |
| `VITE_ADMIN_SECRET` | Gate into the IGATA superadmin panel | `src/pages/admin/AdminApp.jsx` |
| `RESEND_API_KEY` | Auth for outbound email via Resend | `netlify/functions/send-alert-email.js`, `weekly-digest.js` |
| `PLATE_RECOGNIZER_TOKEN` | Auth for vehicle plate OCR API | `netlify/functions/plate-recognizer.js` |

**Known historical incident (fixed June 16, 2026):** `VITE_APP_URL` was set to `https://sentri.ng` instead of `https://app.sentri.ng` across deploy contexts, causing every gate URL generated for roughly 7 days to 404. Corrected across all 5 Netlify deploy contexts. If gate links ever silently start 404ing again, check this variable first.

**Note on the public anon key:** the Supabase anon key is committed in `.env.example` in this public repository. Anon keys are designed to be exposed client-side (they have no power beyond what RLS policies allow), so this is not inherently a vulnerability — but it is worth being a deliberate, documented decision rather than an accident, especially since `netlify.toml` has `SECRETS_SCAN_ENABLED = "false"`, meaning Netlify's automatic secret-detection has been turned off for this project and will not flag anything here or elsewhere. Confirm RLS coverage (Section 6.3) stays comprehensive any time a new table is added, since that is the actual line of defense.

---

## 6. Data Model

Full schema lives in `supabase/schema.sql`. Summary below; treat the schema file as the source of truth if anything here goes stale.

### 6.1 Core tables

| Table | What it represents |
|---|---|
| `tenants` | One row per installation (a cantonment, an oil facility, an estate). Holds `sector` (`military`, `oil_gas`, `industrial`, `corporate`, `government`, `other`), `branch` (for military), contact info, and `report_emails` — the array of addresses that receive alerts. |
| `gates` | One or more entry/exit points per tenant. Has a `slug` used to build the guard-facing URL. |
| `officers` | Guards and command staff. `role` is `guard`, `command`, or `admin`. Command/admin officers log in via Supabase Auth using their `email`. |
| `movements` | The core log — every vehicle or pedestrian admission and checkout. Holds plate number, OCR confidence, visitor details, destination, purpose, timestamps, and a `flag_triggered` boolean if it matched the watchlist. |
| `watchlist` | Plates, names, or ID numbers flagged by command for monitoring. Reason field is internal-only, never shown to guards. |
| `flag_alerts` | Auto-created whenever a movement matches the watchlist. Tracks acknowledgment status. |
| `shift_logs` | Guard shift start/handover records per gate. |

### 6.2 Notable design decisions already in the schema

- **`tenants.sector` already exists and already anticipates market segmentation** — it's not something that needs to be added for the estate/military tiering discussion (Section 9); it's already there, just not yet used for any branching logic in the frontend.
- **Tenant isolation is enforced at the database level via RLS**, not just filtered in application queries. Two helper SQL functions, `get_my_tenant_id()` and `get_my_role()`, derive the current user's tenant and role from their authenticated email, and every RLS policy keys off these. This means even a bug in frontend query-building cannot leak one tenant's data into another's view — the database itself refuses the query.
- **Watchlist matching happens via a Postgres trigger** (`check_watchlist()`), not application code — every `INSERT` on `movements` automatically checks the new row against that tenant's active watchlist and creates a `flag_alerts` row if it matches. This is fast and can't be bypassed by a buggy frontend.
- **Duration is auto-computed via trigger** (`compute_duration()`) the moment `exit_time` is set, rather than calculated ad hoc wherever it's displayed.
- Two analytics views, `v_weekly_summary` and `v_repeat_visitors`, pre-aggregate common reporting queries.

### 6.3 Row-Level Security summary

RLS is enabled on every table. The pattern throughout: a policy checks `tenant_id = get_my_tenant_id()`, and for command-only resources (`watchlist`, `flag_alerts`), additionally checks `get_my_role() in ('command', 'admin')`. Any new table added to this schema should follow the same pattern — this is the single most important convention in the codebase to preserve.

---

## 7. The Intelligence Brief

Generated entirely client-side in `ReportTab.jsx`, by the function `generateBriefHTML`. When a command user clicks "Intelligence Brief," the function:

1. Pulls the period's already-loaded `movements`/`incidents`/`flag_alerts` data.
2. Runs a weighted algorithmic Risk Score (e.g. +40 for critical incidents, +25 for unacknowledged watchlist alerts, +20 for elevated after-hours activity).
3. Fills narrative sentence templates with the real computed numbers (Commander's Brief, Critical Findings, Pattern Discovery, Predictive Assessment sections).
4. Renders the result as a 3-page HTML document, opens it in a new browser window, and sends it to the browser's print dialog to produce a PDF.

No external AI call is made anywhere in this process. The brief includes an explicit disclosure on page 3 stating this and naming AI-enhanced narrative as a future paid upgrade — this disclosure already exists in the live product and is the natural hook for the tiering work described in Section 9.

---

## 8. Email System

**There is one outbound email pathway for transactional/alert mail, and one separate pathway for auth mail. Do not confuse them.**

### 8.1 Alert, incident, report, and welcome email (Resend)

All four of these email types — flag alerts, incident alerts, intelligence reports, and the "welcome" confirmation sent when a new alert recipient is added — are composed as HTML in `src/lib/email.js` and sent through a single shared function, `netlify/functions/send-alert-email.js`, which calls the Resend API directly via `https` (no SDK). Authentication is via the `RESEND_API_KEY` environment variable. The sender address is hardcoded inside that function (currently `alerts@sentri.ng` — see Section 10 for why this matters).

`weekly-digest.js` is a scheduled Netlify function (cron: `0 7 * * 1`, i.e. Mondays 07:00 UTC) that presumably calls the same email pathway to send periodic reports — confirm its internals if modifying the digest cadence or content.

### 8.2 Auth email (Supabase's built-in mailer, configured with Resend SMTP)

Signup confirmation and password reset emails are handled by Supabase Auth's own mailer, configured under **Supabase → Authentication → Emails → SMTP Settings** to relay through Resend's SMTP endpoint (`smtp.resend.com`) rather than Supabase's default (rate-limited, poor sender reputation) mailer. This is a completely separate configuration surface from 8.1 — it lives in the Supabase dashboard, not in code, and uses its own dedicated Resend API key (named `Supabase SMTP` in Resend, sending-only permission, scoped to the `sentri.ng` domain).

### 8.3 Domain

Both pathways send from the `sentri.ng` domain, verified in Resend with SPF, DKIM, and DMARC DNS records added at Whogohost. An earlier domain, `igataconsulting.tech`, was used historically and has since been removed from Resend in favor of `sentri.ng` as the dedicated, branded sending domain.

---

## 9. Multi-Tier Market Strategy (in progress)

**Status: direction agreed, not yet implemented in code.**

Two market segments are being separated — not by capability, but by presentation, branding, and exclusivity, because the core engine (Risk Score, Intelligence Brief, realtime sync, offline-first gate logging) works identically regardless of who uses it, and crippling it for one segment would be artificial.

- **High-stakes / high-trust segment** (military, government, oil & gas, critical infrastructure): proposed to live under a distinct subdomain such as `defence.app.sentri.ng`, with its own branding, its own report terminology ("Commander's Brief" rather than "Activity Summary"), no public self-serve signup, and hand-sold via direct procurement (flat negotiated contracts, as already reflected in the COAS proposal).
- **General-commercial segment** (estates, corporates): stays on `app.sentri.ng`, self-serve signup, standard terminology.

The reasoning: a military buyer's concern is not that the underlying algorithm is too simple — it's that being seen using "the same app as residential estates" undercuts the seriousness of the procurement decision. The fix is making the deployments look and feel categorically separate, not removing features from one side.

**Implementation path agreed but not started:** the `tenants.sector` column already in the schema (Section 6.2) is the natural branching key — application logic can route on it without any schema change. Recommended approach is to start with shared infrastructure (same Supabase project, presentation-layer branching by sector/subdomain) rather than building separate Supabase projects upfront, since no signed military contract yet exists that requires guaranteed data-plane isolation. Dedicated infrastructure remains available as a premium offering once procurement conversations require it — a real, addable service, not a current blocker.

---

## 10. Known Fixes — Fixed Bugs Log

Keep this section updated every time a non-trivial bug is fixed. The goal is that nobody — including a future AI session without conversational memory — re-breaks something that was already fixed, or wastes time re-diagnosing a problem that has a documented root cause.

| Date | Issue | Root cause | Fix | Files touched |
|---|---|---|---|---|
| 2026-06-16 | Every gate URL generated for ~7 days 404'd | `VITE_APP_URL` set to `https://sentri.ng` instead of `https://app.sentri.ng` in Netlify env vars | Corrected across all 5 deploy contexts | Netlify env config only, no code |
| 2026-06-16 | Incident/alert emails returning 403 from Resend | Sender hardcoded as `alerts@igataconsulting.tech`, a domain since removed from Resend in favor of `sentri.ng` | Updated hardcoded `from` address | `netlify/functions/send-alert-email.js` (commit `3cf2958`) |
| 2026-06-16 | Adding a valid alert-recipient email (e.g. containing the letter "s" before the @) was rejected as "invalid" | Email validation regex `[^s@]` was missing its backslash — meant to be `[^\s@]` (exclude whitespace), instead excluded the literal letter "s" | Corrected regex to `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `src/pages/command/tabs.jsx` (commit `e8bc68d`) |
| 2026-06-16 | Registering with an already-used email silently showed "Check your email" with no email actually sent | Supabase's `signUp` returns no error for an existing email by design (anti-enumeration); frontend only checked the `error` field, not the response shape | Added check on `data.user.identities` — empty/missing array means the account already existed | `src/pages/auth/Register.jsx` (commit `6f10c3f`) |

---

## 11. Open Items / Backlog

**Active, in progress or queued:**
- Confirm no other gates besides the original Olanrewaju Emmanuel Estate gate carry a stale pre-fix URL (quick audit of the Gates tab across tenants created in the affected ~7-day window).
- Premium HTML confirmation email template (dark navy, red "i" wordmark) to replace Supabase's default — not yet built.
- Multi-tier implementation per Section 9 — direction agreed, no code written yet.

**Phase 2 backlog (deliberately deferred, do not start unprompted):**
- Dashboard dark theme upgrade (approved via mockups, held until after pilot kickstart).
- Vehicle Intelligence Profile — per-plate dossier view. Not built, not to be marketed yet.
- AI-generated Commander's Brief narrative via the Anthropic API — would be the platform's first genuine AI/ML component. Everything before this is rule-based (see Section 1).
- Offline checkout pre-cache — currently the offline checkout view on the Guard PWA only shows movements admitted during the *same* offline session, not full standing history. Planned fix: 24-hour pre-cache of active movements into IndexedDB.
- Torch/flashlight compatibility — confirmed real device variance: works on a tested Redmi phone, does not activate on a Samsung Galaxy Note 24 Ultra (Samsung-specific camera-permission/browser handling, not a SENTRi defect). No tablet has been tested yet; prioritize torch behavior specifically when a physical rugged tablet (Tab Active 5 or alternative) is acquired.
- Repo root cleanup — see Section 4 callout.

---

## 12. Working Conventions (for anyone touching this codebase)

- **RLS first.** Any new table must have row-level security enabled and a tenant-scoped policy before it goes live. This is the single load-bearing security convention in the system.
- **No hardcoded sender domains, ever.** Section 10's second entry happened because a domain name was hardcoded inside a function instead of read from a configurable source. If a sender address ever needs to change again, search the whole repo for the old value before assuming it's only in one place.
- **Audit before running.** Any script that writes to the database or modifies a live environment variable should be reviewed line-by-line for blast radius before execution — there are real pilot users on this platform.
- **Update Section 10 of this document** every time a non-trivial bug is fixed, with the date, root cause, fix, and files touched. This is cheap to do in the moment and expensive to reconstruct later.
