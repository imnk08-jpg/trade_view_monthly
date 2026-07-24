import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { getAdminSession } from '../../lib/session.js';
import { Field } from './UsersTab.jsx';
import { buildAdminMonthly, buildUserMonthlySeries } from '../../../shared/returns.js';
import {
  AdminProfitCumulativeChart,
  AdminProfitMonthlyPctChart,
  AdminProfitByUserBarChart,
  AdminProfitShareDonut,
} from '../../components/AdminProfitCharts.jsx';

const fmt = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

// The spread between an admin's raw monthly % and what a user actually
// receives (after tiering, an "Actual %" override, or a fixed-amount
// override) is the admin's own profit for managing that user's money.
// e.g. raw 10%, user gets 5% (tiered) -> 5% is admin profit. Give the user
// the full raw % and the spread -- and admin profit -- is 0. See
// shared/returns.js (grossPnl / adminProfitThisMonth) for the exact math.
export default function AdminProfitTab() {
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(getAdminSession()?.phone || '');
  const [selectedUserId, setSelectedUserId] = useState('__all__');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [userList, adminList, returnsList, overrideList] = await Promise.all([
        api.listUsers(),
        api.listAdmins(),
        api.listMonthlyReturns(),
        api.listOverrides(),
      ]);
      setUsers(userList);
      setAdmins(adminList);
      setMonthlyReturns(returnsList);
      setOverrides(overrideList);
      if (!selectedAdmin && adminList.length > 0) setSelectedAdmin(adminList[0].phone);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adminMonthly = buildAdminMonthly(monthlyReturns);
  const adminUsers = users.filter((u) => u.adminPhone === selectedAdmin);

  const rows = adminUsers.map((u) => {
    const { series } = buildUserMonthlySeries(
      u.id,
      u.adminPhone,
      u.contributions,
      u.payouts,
      adminMonthly,
      overrides,
      0,
      0
    );
    const latest = series[series.length - 1];
    return {
      user: u,
      series,
      invested: latest?.principal || 0,
      adminProfit: latest?.cumulativeAdminProfit || 0,
    };
  });

  const totalProfit = rows.reduce((s, r) => s + r.adminProfit, 0);
  const totalInvested = rows.reduce((s, r) => s + r.invested, 0);

  const monthlyTotals = new Map(); // month -> total admin profit that month across all users
  for (const r of rows) {
    for (const s of r.series) {
      monthlyTotals.set(s.month, (monthlyTotals.get(s.month) || 0) + s.adminProfitThisMonth);
    }
  }
  const monthlyRows = [...monthlyTotals.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const chartUserId =
    selectedUserId === '__all__' || rows.some((r) => r.user.id === selectedUserId)
      ? selectedUserId
      : rows[0]?.user.id || '__all__';
  const chartRow = rows.find((r) => r.user.id === chartUserId);

  // "All Users" aggregates every user's monthly admin profit and principal
  // by month, then re-derives a cumulative total and a blended % from that
  // combined series -- same shape as a single user's series so both charts
  // can render it without special-casing.
  const allUsersSeries = (() => {
    const byMonth = new Map(); // month -> { adminProfitThisMonth, principal }
    for (const r of rows) {
      for (const s of r.series) {
        const entry = byMonth.get(s.month) || { adminProfitThisMonth: 0, principal: 0 };
        entry.adminProfitThisMonth += s.adminProfitThisMonth;
        entry.principal += s.principal;
        byMonth.set(s.month, entry);
      }
    }
    const months = [...byMonth.keys()].sort();
    let cumulative = 0;
    return months.map((month) => {
      const { adminProfitThisMonth, principal } = byMonth.get(month);
      cumulative += adminProfitThisMonth;
      return {
        month,
        adminProfitThisMonth,
        cumulativeAdminProfit: cumulative,
        adminProfitPct: principal ? (adminProfitThisMonth / principal) * 100 : 0,
      };
    });
  })();

  const chartSeries =
    chartUserId === '__all__'
      ? allUsersSeries
      : (chartRow?.series || []).map((s) => ({
          ...s,
          adminProfitPct: s.principal ? (s.adminProfitThisMonth / s.principal) * 100 : 0,
        }));
  const chartLabel = chartUserId === '__all__' ? 'All Users' : chartRow?.user.name || '';

  const byUserRows = rows.map((r) => ({ name: r.user.name, adminProfit: r.adminProfit }));
  const hasPositiveShare = byUserRows.some((r) => r.adminProfit > 0);

  return (
    <div>
      <h2 className="text-sm font-medium text-zinc-300 mb-1">Admin Profit</h2>
      <p className="text-xs text-zinc-500 mb-3">
        Profit earned from the spread between the raw % you enter and what each user actually
        receives. An "Actual %" override gives the user everything (0 profit); a fixed-amount
        override is measured against what the raw % would have produced.
      </p>

      {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}

      <div className="max-w-xs mb-4">
        <Field label="Admin">
          <select className="input" value={selectedAdmin} onChange={(e) => setSelectedAdmin(e.target.value)}>
            {admins.map((a) => (
              <option key={a.phone} value={a.phone}>
                {a.name} ({a.phone})
              </option>
            ))}
          </select>
        </Field>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
              <p className="text-xs text-zinc-500">Total Admin Profit</p>
              <p className={`text-lg font-semibold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmt(totalProfit)}
              </p>
            </div>
            <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
              <p className="text-xs text-zinc-500">Users Managed</p>
              <p className="text-lg font-semibold text-white">{adminUsers.length}</p>
            </div>
            <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
              <p className="text-xs text-zinc-500">Total Invested (managed)</p>
              <p className="text-lg font-semibold text-white">{fmt(totalInvested)}</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="max-w-xs mb-3">
              <Field label="Show chart for user">
                <select className="input" value={chartUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                  <option value="__all__">All Users</option>
                  {rows.map((r) => (
                    <option key={r.user.id} value={r.user.id}>
                      {r.user.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {chartSeries.length === 0 ? (
              <p className="text-sm text-zinc-500">No data for this user yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">
                    Lifetime Admin Profit -- {chartLabel}
                  </h3>
                  <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                    <AdminProfitCumulativeChart series={chartSeries} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">
                    Admin Profit % by Month -- {chartLabel}
                  </h3>
                  <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                    <AdminProfitMonthlyPctChart series={chartSeries} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Admin Profit by User</h3>
                <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                  <AdminProfitByUserBarChart rows={byUserRows} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Profit Share by User</h3>
                <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                  {hasPositiveShare ? (
                    <AdminProfitShareDonut rows={byUserRows} />
                  ) : (
                    <p className="text-sm text-zinc-500 py-8 text-center">No profit earned yet to share out.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <details className="group">
            <summary className="text-sm font-medium text-zinc-400 cursor-pointer select-none hover:text-zinc-200 mb-3">
              Exact figures (tables)
            </summary>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">By User</h3>
                <div className="bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500 border-b border-white/10 bg-white/5">
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3 text-right">Invested</th>
                        <th className="py-2 px-3 text-right">Admin Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.user.id} className="border-b border-white/5 last:border-0">
                          <td className="py-2 px-3 text-white">{r.user.name}</td>
                          <td className="py-2 px-3 text-right text-zinc-300">{fmt(r.invested)}</td>
                          <td className={`py-2 px-3 text-right ${r.adminProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmt(r.adminProfit)}
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-zinc-500">
                            No users under this admin yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">By Month</h3>
                <div className="bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500 border-b border-white/10 bg-white/5">
                        <th className="py-2 px-3">Month</th>
                        <th className="py-2 px-3 text-right">Admin Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRows.map(([month, total]) => (
                        <tr key={month} className="border-b border-white/5 last:border-0">
                          <td className="py-2 px-3 text-zinc-300">{month}</td>
                          <td className={`py-2 px-3 text-right ${total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {fmt(total)}
                          </td>
                        </tr>
                      ))}
                      {monthlyRows.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-zinc-500">
                            No data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
