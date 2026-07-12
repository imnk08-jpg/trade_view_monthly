# Investment Dashboard

Phone-number-only investor dashboard: each investor enters their phone number to
see how their investment is performing, with FD and Mutual Fund benchmark
comparisons. Every investor is aligned with one admin, who provides an
overall % return each month; admins (phone + shared PIN) manage users, those
monthly returns, per-user exceptions, and rates.

Stack: Vite + React (JS) frontend, `/api` serverless functions (Vercel Node
runtime, also runnable locally), storage abstraction that defaults to local
JSON files and swaps to jsonbin.io via env vars.

## Local development

```bash
npm install
npm run seed   # creates data/{admins,settings,overrides,users,monthlyReturns}.json
npm run dev    # runs Vite (5173) + local API server (3001) together
```

Open http://localhost:5173.

- Default admin phone: `7357567373`, PIN: `1234` (change it in Admin → Settings)
- Demo user phone: `9999999999` (aligned with the default admin, includes a
  mid-month top-up in June to demonstrate proration)

Data lives in `data/*.json` — your local "DB". Delete it and re-run `npm run seed`
to reset.

## How admin access works

There's no login system for investors — they just enter their phone number.
Admins share one PIN (set in Admin → Settings). When a phone number that's in
the admins list is entered on the landing page, a PIN prompt appears. Every
admin API call sends `x-admin-phone` / `x-admin-pin` headers, validated
server-side against the shared PIN — there's no session token. This is a
deliberately lightweight scheme for an internal tool.

## Data model

- `users`: `{ id, name, phone, adminPhone, contributions, payouts }`.
  - `adminPhone` — every user is aligned with exactly **one** admin.
  - `contributions: [{ date, amount }]` — the user's single invested total.
    `contributions[0]` is the initial fund set when the admin adds the user
    (dated their start date); later entries are additional funds added on
    specific dates (Users tab → "+ Add Fund").
  - `payouts: [{ id, date, amount, type: 'payout' | 'reinvest' }]` — see
    Payouts & reinvestments below. Set from the Payouts tab.
- `monthlyReturns`: `{ id, adminPhone, month, pct }` — the admin-entered
  overall % return for their group, one per (admin, month). Set from the
  Returns tab. This raw % is what everything downstream is computed from —
  there's no automatic feed/strategy calculation anymore.
- `overrides`: `{ id, userId, month }` — admin-flagged exceptions where a
  given user's return for that month is shown as raw instead of tiered (see
  below). Scoped per user, so two users sharing the same admin can have
  different exception status for the same month.
- `admins`: `{ phone, name }`
- `settings`: `{ fdRate, mfRate, adminPin }` — defaults only; each investor
  can locally override the FD/MF % shown on their own dashboard for
  comparison purposes (view-only, never saved).

All the math lives in `shared/returns.js`, used by both the API and the
frontend.

### Monthly return tiering

The admin's raw monthly % goes through a fixed tiering rule:

| Raw monthly return | User gets |
|---|---|
| `> 3%` | half of the raw return (flat halving, e.g. 9% → 4.5%) |
| `0% to 3%` | the full raw return |
| `-3% to 0%` | 0% (small losses absorbed) |
| `< -3%` | half of the raw return (e.g. -9% → -4.5%) |

The 3% / -3% cutoffs are cliffs, not marginal bands — a 3.01% month is halved,
not "3% in full plus half of the remainder." This is by explicit design.

Admins can mark any (user, month) pair as an **override** — set on that
user's page in the Users tab — which shows that user's raw % for that month
with no tiering applied.

### Non-compounding: return is always on the base fund

Each month's effective % is applied to the user's **base fund only** — their
contributions to date — never to base fund + profit earned in prior months.
Profit still accumulates into the displayed current value
(`strategyValue = principal + cumulativePnl`), it just never becomes
principal that next month's % gets applied to.

### Mid-month proration

If a contribution lands partway through a month, it only earns that month's
% for the trading days it was actually in for. Trading days are approximated
as Mon–Fri (no holiday calendar). A contribution dated on/before a month's
1st counts in full for that month; one added mid-month is scaled by
`(trading days remaining from that date to month-end) / (total trading days
in the month)`. Contributions carry over at full weight in every subsequent
month. See `prorationFactor()` in `shared/returns.js`.

Example from the seed data: the demo user's ₹80,000 was invested from
April 1, then ₹20,000 more was added June 15. June has 20 trading days, 12
of which remain from the 15th onward, so that ₹20,000 only earns
12/20 = 60% of June's tiered %; the original ₹80,000 earns the full amount.
From July onward, the full ₹100,000 participates normally.

### XIRR

The user dashboard shows XIRR as a KPI, computed via Newton-Raphson
(`xirr()` in `shared/returns.js`) over the user's actual contribution dates
(as outflows), any cash payouts (inflows), and current value as of today (as
the final inflow).

### Payouts & reinvestments (Payouts tab)

Two things an admin can do with a user's accrued profit:

- **Payout** — cash paid out to the user. Reduces `cumulativePnl` from that
  date forward; principal is untouched. Counts as a positive (money back to
  the investor) cash flow for XIRR, and reduces the FD/MF hypothetical the
  same way a real withdrawal would (the withdrawn amount stops compounding
  in the benchmark too).
- **Reinvest** — profit converted into principal instead of cashed out. Adds
  an entry to the contributions list (so it starts earning future tiered
  returns, subject to the same mid-month proration as any contribution) and
  reduces `cumulativePnl` by the same amount at the same date — the money
  moves from the "profit" bucket to the "principal" bucket, so total value
  is unchanged at the moment it happens. Not an external cash movement, so
  it's excluded from XIRR and the FD/MF benchmark.

Both are entered per user from the Payouts tab, which also shows that user's
current value and available profit for reference before you submit one.

### Legacy: the daily strategy feed

An earlier version of this app derived returns from a daily per-strategy P&L
feed (`data/feed.json`, `api/feed.js`, `buildStrategyMonthly()` in
`shared/returns.js`). That path is **no longer used** to compute user P&L —
returns now come entirely from admin-entered `monthlyReturns` — but the
files are left in place in case that feed gets wired back in later.

## Switching storage to jsonbin.io

Everything (`users`, `overrides`, `admins`, `settings`, `monthlyReturns`)
goes through `api/_lib/store.js`. To switch:

1. Create one jsonbin.io bin per collection. Each should start as `[]` (or
   `{}` for `settings`).
2. Set env vars (Vercel project settings, or your shell for local testing):
   - `STORAGE=jsonbin`
   - `JSONBIN_API_KEY=<your X-Master-Key>`
   - `JSONBIN_BIN_USERS`, `JSONBIN_BIN_OVERRIDES`, `JSONBIN_BIN_ADMINS`,
     `JSONBIN_BIN_SETTINGS`, `JSONBIN_BIN_MONTHLYRETURNS`
3. Seed `admins` and `settings` once in production so the default admin
   (`7357567373`) and default rates exist there too.

## Deploying to Vercel

Standard Vite project with an `/api` folder — Vercel detects both automatically.

```bash
npm i -g vercel   # if you don't have it
vercel
```

Before your first real deploy, set `STORAGE=jsonbin` (+ its bin vars) in the
Vercel project settings — **local JSON file storage does not persist in
production** (Vercel's filesystem is ephemeral outside a single request), so
without jsonbin configured, admin changes will not survive between requests
once deployed.

`vercel.json` includes a SPA rewrite so client-side routes
(`/dashboard`, `/admin`) work on direct load/refresh.

## Project layout

```
api/                serverless functions (auth, users, monthly-returns, overrides, settings, admins, feed [legacy])
api/_lib/           storage + auth helpers shared by the functions above
shared/returns.js   tiering, proration, valuation, XIRR math -- shared by API and frontend
server/             local Express wrapper that mounts api/*.js for `npm run dev`
scripts/seed.js     local data bootstrap
src/                React app (landing, user dashboard, admin panel)
data/               local JSON "database" (dev only)
```
