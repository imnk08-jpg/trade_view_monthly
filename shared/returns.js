// Monthly return tiering + per-user P&L, driven by an admin-provided
// overall percentage per month (not derived from any strategy feed).
//
// Every user is aligned with exactly one admin (user.adminPhone). Each
// month, that admin provides one raw "overall percentage" for their whole
// group (see monthlyReturns / buildAdminMonthly below). The SAME tiering
// rule and per-user override mechanism from before still apply on top of
// that raw %:
//
// TIERING RULE (admin default; see README):
//   raw month return r (%), as provided by the assigned admin for that month.
//     r > 3          -> user gets r / 2           (flat half, not marginal)
//      0 <= r <= 3    -> user gets r                (kept in full)
//     -3 <= r < 0     -> user gets 0                (small losses absorbed)
//     r < -3          -> user gets r / 2           (large losses halved)
//   The 3%/-3% cutoffs are cliffs by explicit design, not marginal bands
//   (e.g. a 9% month nets the user exactly 4.5%, not 3 + (9-3)/2).
//
//   Admin can mark a specific (userId, month) as an override, in which case
//   that user gets the raw % for that month, tiering skipped.
//
// ADMIN PROFIT: the spread between what the raw % would have generated on
// a user's money and what that user actually received is the admin's own
// profit for managing that user, e.g. raw 10% where the user gets 5%
// (tiered) leaves the other 5% as admin profit; give the user the full raw
// % (an "Actual %" override) and the spread -- and admin profit -- is 0.
// A fixed absolute-amount override works the same way: admin profit is
// whatever the raw % would have produced minus the fixed amount actually
// given. See grossPnl/adminProfitThisMonth/cumulativeAdminProfit below.
//
// NON-COMPOUNDING RULE: each month's % is applied to the user's base fund
// only (their contributions to date) -- never to base fund + profit earned
// in prior months. Profit still accumulates additively into the displayed
// "current value", it just never becomes part of next month's base.
//
// MID-MONTH PRORATION: a contribution added partway through a month only
// earns that month's % for the trading days it was actually in for --
// see prorationFactor(). Trading days are approximated as Mon-Fri (no
// holiday calendar); contributions from earlier months count in full.
//
// PAYOUTS / REINVESTMENTS (user.payouts, each { date, amount, type }):
//   type 'payout'   -- cash paid out to the user, capped by AVAILABLE
//                       PROFIT at that point: the portion up to available
//                       profit reduces cumulativePnl (and the FD/MF
//                       cumulative profit trackers, by the same rupee
//                       amount); any excess beyond available profit is
//                       treated as a withdrawal of principal instead (a
//                       negative contribution dated at the payout, so it
//                       stops earning future returns) -- profit never goes
//                       negative from a payout. The full amount still
//                       counts as a positive (money back to the investor)
//                       cash flow for XIRR, regardless of the split -- see
//                       payoutBreakdown in the return value for how much
//                       of it was profit vs. principal.
//   type 'reinvest' -- profit converted into principal instead of being
//                       cashed out. Adds an entry to the base-fund
//                       contributions (so it starts earning future tiered
//                       *and* FD/MF returns, prorated like any other
//                       contribution) AND reduces cumulativePnl (and the
//                       FD/MF trackers) by the same amount at the same
//                       date -- the money moves from the "profit" bucket
//                       to the "principal" bucket, net value is unchanged
//                       at the moment it happens for all three lines. Not
//                       an external cash flow, so it's excluded from XIRR.
//                       (No longer creatable from the admin UI, but old
//                       records are still honored.)
//
// NOTE: shared/returns.js previously derived the raw % from a daily
// strategy P&L feed (see buildStrategyMonthly, still defined below for
// reference/legacy use) -- that path is no longer used to compute user P&L.

export function monthKey(dateStr) {
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

export function tieredReturnPct(rawPct) {
  if (rawPct > 3) return rawPct / 2;
  if (rawPct >= -3) return rawPct >= 0 ? rawPct : 0;
  return rawPct / 2;
}

// overrides: [{ id, userId, month, amount }]. `amount` is null/absent for a
// plain "use raw % instead of tiered" override; a number means "use this
// absolute rupee P&L for the month instead of any percentage" (see
// buildUserMonthlySeries).
export function getOverride(overrides, userId, month) {
  return overrides.find((o) => o.userId === userId && o.month === month);
}

export function effectiveReturnPct(rawPct, overridden) {
  return overridden ? rawPct : tieredReturnPct(rawPct);
}

// monthlyReturns: [{ id, adminPhone, month, pct }]
// Map<adminPhone, Map<month, pct>>
export function buildAdminMonthly(monthlyReturns) {
  const byAdmin = new Map();
  for (const r of monthlyReturns || []) {
    if (!byAdmin.has(r.adminPhone)) byAdmin.set(r.adminPhone, new Map());
    byAdmin.get(r.adminPhone).set(r.month, r.pct);
  }
  return byAdmin;
}

// Legacy/reference only -- no longer used to compute user P&L. Kept in case
// the daily strategy feed (api/feed.js) is wired back in later.
// Map<strategyId, [{ month, totalPnl, avgInvested, rawPct, principal }]>
export function buildStrategyMonthly(feed) {
  const byStrategy = new Map();
  for (const e of feed.entries || []) {
    if (!byStrategy.has(e.strategy)) byStrategy.set(e.strategy, new Map());
    const byMonth = byStrategy.get(e.strategy);
    const mk = monthKey(e.date);
    if (!byMonth.has(mk)) byMonth.set(mk, []);
    byMonth.get(mk).push(e);
  }

  const result = new Map();
  for (const [strategyId, byMonth] of byStrategy) {
    const months = [...byMonth.keys()].sort();
    const rows = months.map((month) => {
      const monthEntries = [...byMonth.get(month)].sort((a, b) => new Date(a.date) - new Date(b.date));
      const totalPnl = monthEntries.reduce((s, e) => s + e.pnl, 0);
      const avgInvested = monthEntries.reduce((s, e) => s + e.investedFunds, 0) / monthEntries.length;
      const rawPct = avgInvested ? (totalPnl / avgInvested) * 100 : 0;
      const principal = monthEntries[monthEntries.length - 1].investedFunds;
      return { month, totalPnl, avgInvested, rawPct, principal };
    });
    result.set(strategyId, rows);
  }
  return result;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function endOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

// Inclusive list of 'YYYY-MM' strings from startMonth through endMonth.
function monthRange(startMonth, endMonth) {
  if (startMonth > endMonth) return [];
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  const months = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

function isTradingDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6; // exclude Sat/Sun; no holiday calendar
}

// Inclusive count of Mon-Fri days between two ISO date strings.
function tradingDaysBetween(fromDateStr, toDateStr) {
  let count = 0;
  const d = new Date(fromDateStr);
  const end = new Date(toDateStr);
  while (d <= end) {
    if (isTradingDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// What fraction of `month`'s return a contribution dated `contributionDate`
// should earn. 1 if it was already in before the month started; otherwise
// the share of the month's trading days remaining from the contribution
// date onward.
export function prorationFactor(contributionDate, month) {
  const monthStart = `${month}-01`;
  const monthEnd = endOfMonth(month);
  if (contributionDate <= monthStart) return 1;
  if (contributionDate > monthEnd) return 0;
  const totalTradingDays = tradingDaysBetween(monthStart, monthEnd);
  const remainingTradingDays = tradingDaysBetween(contributionDate, monthEnd);
  return totalTradingDays ? remainingTradingDays / totalTradingDays : 0;
}

function baseFundAsOf(contributions, onOrBeforeDate) {
  return (contributions || [])
    .filter((c) => c.date <= onOrBeforeDate)
    .reduce((s, c) => s + c.amount, 0);
}

// contributions: [{date, amount}] -- the user's single running invested
// total. payouts: [{date, amount, type: 'payout'|'reinvest'}]. adminMonthly:
// Map<adminPhone, Map<month, rawPct>> from buildAdminMonthly(). overrides:
// [{ id, userId, month }]. fdRate/mfRate are ANNUAL percentages.
//
// FD/MF comparison lines use the SAME methodology as the actual return --
// same shared principal, same mid-month proration, same non-compounding
// accumulation -- so all three are a fair apples-to-apples comparison. The
// annual FD/MF rate is converted to a flat monthly rate (annualRate / 12);
// this is a simplification (no compounding), consistent with how the
// admin's own monthly % is treated.
//
// Returns { series: [{month, principal, monthPnl, monthPct, cumulativePnl,
//           lifetimeProfit, strategyValue, monthFdPnl, fdValue, monthMfPnl, mfValue,
//           grossPnl, adminProfitThisMonth, cumulativeAdminProfit}],
//           contributions: [{date, amount}],
//           payoutBreakdown: [{id, date, amount, profitPortion, principalPortion}] }
// `cumulativePnl` is profit still sitting in the account (what "Gain/Loss"
// shows -- reduced by payouts/reinvestments). `lifetimeProfit` is total
// profit ever earned, unaffected by what happened to it afterward.
// `grossPnl` is what the raw % alone would have produced; `adminProfitThisMonth`
// / `cumulativeAdminProfit` are the admin's own cut (see ADMIN PROFIT above).
export function buildUserMonthlySeries(userId, adminPhone, contributions, payouts, adminMonthly, overrides, fdRate, mfRate, asOfMonth) {
  const adminMonths = adminPhone ? adminMonthly.get(adminPhone) : null;
  if (!adminMonths || !contributions || contributions.length === 0) {
    return { series: [], contributions: contributions || [], payoutBreakdown: [] };
  }

  const reinvestEvents = (payouts || [])
    .filter((p) => p.type === 'reinvest')
    .map((p) => ({ date: p.date, amount: p.amount }));
  const payoutEvents = (payouts || []).filter((p) => p.type === 'payout');
  // Principal-earning base includes external contributions plus reinvested
  // profit (both are money sitting in the fund earning future returns) --
  // shared by the actual return and both FD/MF hypotheticals, since it's
  // the same underlying capital. Payouts that exceed available profit push
  // a negative "withdrawal" entry into this same array as they're
  // discovered below (see the payout-processing step).
  const effectiveContributions = [...contributions, ...reinvestEvents];
  const fdMonthlyRate = fdRate / 12;
  const mfMonthlyRate = mfRate / 12;

  const firstContributionMonth = contributions.reduce(
    (min, c) => (monthKey(c.date) < min ? monthKey(c.date) : min),
    monthKey(contributions[0].date)
  );

  // The month list must be a CONTIGUOUS range from the user's first
  // contribution through the latest relevant month -- not just months the
  // admin happened to enter a return for. Otherwise a user who invested
  // this month (before the admin has entered this month's %) gets an empty
  // series and shows ₹0 everywhere, even though their principal is real.
  // Months with no admin entry simply get a 0% return until one is added.
  const payoutMonths = [...payoutEvents, ...reinvestEvents].map((e) => monthKey(e.date));
  const todayMonth = monthKey(new Date().toISOString().slice(0, 10));
  let lastMonth = [...adminMonths.keys(), ...payoutMonths, todayMonth, firstContributionMonth].reduce(
    (max, m) => (m > max ? m : max),
    firstContributionMonth
  );
  if (asOfMonth && asOfMonth < lastMonth) lastMonth = asOfMonth;
  const months = monthRange(firstContributionMonth, lastMonth).filter(
    (m) => !asOfMonth || m <= asOfMonth
  );

  let cumulativePnl = 0;
  let cumulativeFdPnl = 0;
  let cumulativeMfPnl = 0;
  // Total profit ever earned, month by month -- unlike cumulativePnl this
  // is never reduced by payouts or reinvestments, so it always reflects
  // the investment's lifetime performance regardless of what happened to
  // the profit afterward (paid out, reinvested, or still sitting).
  let lifetimeProfit = 0;
  // Admin's own cumulative profit from managing this user -- the spread
  // between raw % (gross) and what the user actually got, month by month.
  // Never reduced by the user's own payouts/reinvestments (those are the
  // user's money, not the admin's).
  let cumulativeAdminProfit = 0;
  const series = [];
  const payoutBreakdown = [];
  for (const month of months) {
    const monthEnd = endOfMonth(month);
    const principalBeforeEvents = baseFundAsOf(effectiveContributions, monthEnd);
    if (principalBeforeEvents <= 0) continue;

    const rawPct = adminMonths.get(month);
    const override = getOverride(overrides, userId, month);
    const hasAbsoluteOverride = !!override && override.amount !== null && override.amount !== undefined;
    const overridden = !!override && !hasAbsoluteOverride;
    const effectivePct = rawPct === undefined ? 0 : effectiveReturnPct(rawPct, overridden);

    const proratedBase = effectiveContributions
      .filter((c) => c.date <= monthEnd)
      .reduce((s, c) => s + c.amount * prorationFactor(c.date, month), 0);
    // An absolute-amount override replaces the whole percentage calculation
    // for the month with a fixed admin-entered rupee P&L -- no proration,
    // it's already the final number for that month.
    const monthPnl = hasAbsoluteOverride ? override.amount : (proratedBase * effectivePct) / 100;
    const monthFdPnl = (proratedBase * fdMonthlyRate) / 100;
    const monthMfPnl = (proratedBase * mfMonthlyRate) / 100;
    // What the raw % (no tiering, no override) would have produced on this
    // same base -- the admin's cut is whatever of that the user didn't get.
    const grossPnl = rawPct === undefined ? 0 : (proratedBase * rawPct) / 100;
    const adminProfitThisMonth = grossPnl - monthPnl;

    cumulativePnl += monthPnl;
    cumulativeFdPnl += monthFdPnl;
    cumulativeMfPnl += monthMfPnl;
    lifetimeProfit += monthPnl;
    cumulativeAdminProfit += adminProfitThisMonth;

    // Process this month's payout/reinvest events in date order. A
    // reinvestment always moves its full amount from profit to principal
    // (unchanged from before). A payout is capped at whatever profit is
    // actually available -- profit floors at 0, never goes negative --
    // and any excess is a real withdrawal of principal instead.
    const eventsThisMonth = [...payoutEvents, ...reinvestEvents]
      .filter((e) => monthKey(e.date) === month)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const e of eventsThisMonth) {
      const isReinvest = reinvestEvents.includes(e);
      if (isReinvest) {
        cumulativePnl -= e.amount;
        cumulativeFdPnl -= e.amount;
        cumulativeMfPnl -= e.amount;
        continue;
      }
      const profitPortion = Math.min(e.amount, Math.max(cumulativePnl, 0));
      const principalPortion = e.amount - profitPortion;
      cumulativePnl -= profitPortion;
      cumulativeFdPnl -= profitPortion;
      cumulativeMfPnl -= profitPortion;
      if (principalPortion > 0) {
        effectiveContributions.push({ date: e.date, amount: -principalPortion });
      }
      payoutBreakdown.push({ id: e.id, date: e.date, amount: e.amount, profitPortion, principalPortion });
    }

    const principal = baseFundAsOf(effectiveContributions, monthEnd);

    series.push({
      month,
      principal,
      monthPnl,
      monthPct: principal ? (monthPnl / principal) * 100 : 0,
      cumulativePnl,
      lifetimeProfit,
      strategyValue: principal + cumulativePnl,
      monthFdPnl,
      fdValue: principal + cumulativeFdPnl,
      monthMfPnl,
      mfValue: principal + cumulativeMfPnl,
      grossPnl,
      adminProfitThisMonth,
      cumulativeAdminProfit,
    });
  }

  return { series, contributions, payoutBreakdown };
}

// XIRR via Newton-Raphson. cashflows: [{date, amount}] -- outflows
// (investments) negative, inflows (current value) positive. Returns a
// percentage, or null if it doesn't converge / not enough data.
export function xirr(cashflows) {
  if (!cashflows || cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => new Date(a.date) - new Date(b.date));
  const d0 = new Date(sorted[0].date).getTime();
  const yearsSince = (date) => (new Date(date).getTime() - d0) / (365 * DAY_MS);

  const npv = (rate) => sorted.reduce((s, c) => s + c.amount / Math.pow(1 + rate, yearsSince(c.date)), 0);
  const dNpv = (rate) =>
    sorted.reduce((s, c) => {
      const t = yearsSince(c.date);
      return t === 0 ? s : s - (c.amount * t) / Math.pow(1 + rate, t + 1);
    }, 0);

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dNpv(rate);
    if (Math.abs(df) < 1e-10) break;
    const next = rate - f / df;
    if (!isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-7) {
      rate = next;
      break;
    }
    rate = next;
  }
  return isFinite(rate) ? rate * 100 : null;
}

// Convenience wrapper: builds the cashflow series for a user from their
// contributions (outflows), any cash payouts (inflows -- money actually
// returned to them; reinvestments are excluded, no external movement), and
// current value (final inflow), then runs xirr().
export function calculateUserXirr(contributions, payouts, currentValue, asOfDate) {
  if (!contributions || contributions.length === 0) return null;
  const cashflows = contributions.map((c) => ({ date: c.date, amount: -c.amount }));
  for (const p of payouts || []) {
    if (p.type === 'payout') cashflows.push({ date: p.date, amount: p.amount });
  }
  cashflows.push({ date: asOfDate, amount: currentValue });
  return xirr(cashflows);
}

// Whole calendar months elapsed between a user's first contribution and
// `asOfDate` (defaults to today). Used for the "Invested Period" KPI.
export function investedMonths(contributions, asOfDate) {
  if (!contributions || contributions.length === 0) return 0;
  const firstDate = contributions.reduce(
    (min, c) => (c.date < min ? c.date : min),
    contributions[0].date
  );
  const from = new Date(firstDate);
  const to = new Date(asOfDate || Date.now());
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
}
