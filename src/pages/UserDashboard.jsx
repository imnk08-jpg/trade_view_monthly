import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getUserPhone, clearUserPhone } from '../lib/session.js';
import InvestmentChart from '../components/InvestmentChart.jsx';
import ComparisonBarChart from '../components/ComparisonBarChart.jsx';
import {
  buildAdminMonthly,
  buildUserMonthlySeries,
  calculateUserXirr,
  investedMonths,
} from '../../shared/returns.js';

const fmt = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const today = () => new Date().toISOString().slice(0, 10);

export default function UserDashboard() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '' });
  const [data, setData] = useState(null);

  useEffect(() => {
    const phone = getUserPhone();
    if (!phone) {
      navigate('/');
      return;
    }

    (async () => {
      try {
        const user = await api.getUserByPhone(phone);
        const [monthlyReturns, overrides] = await Promise.all([api.listMonthlyReturns(), api.listOverrides()]);
        setData({ user, monthlyReturns, overrides });
        setState({ loading: false, error: '' });
      } catch (err) {
        setState({ loading: false, error: err.message });
      }
    })();
  }, [navigate]);

  const adminMonthly = useMemo(() => (data ? buildAdminMonthly(data.monthlyReturns) : null), [data]);

  const { series, contributions, payoutBreakdown } = useMemo(() => {
    if (!data || !adminMonthly) return { series: [], contributions: [], payoutBreakdown: [] };
    return buildUserMonthlySeries(
      data.user.id,
      data.user.adminPhone,
      data.user.contributions,
      data.user.payouts,
      adminMonthly,
      data.overrides,
      0,
      0
    );
  }, [data, adminMonthly]);

  function logout() {
    clearUserPhone();
    navigate('/');
  }

  if (state.loading) return <Centered>Loading your dashboard...</Centered>;
  if (state.error) return <Centered>{state.error}</Centered>;

  const { user } = data;
  const latest = series[series.length - 1];
  const invested = latest?.principal || 0;
  const currentValue = latest?.strategyValue || 0;
  const gain = latest?.cumulativePnl || 0;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  const lifetimeProfit = latest?.lifetimeProfit || 0;
  const xirr = calculateUserXirr(contributions, user.payouts, currentValue, today());
  const months = investedMonths(contributions, today());
  const fundEvents = (user.contributions || []).map((c, i) => ({
    key: `fund-${i}-${c.date}`,
    date: c.date,
    type: 'fund addition',
    amount: c.amount,
  }));
  const payoutEvents = (user.payouts || []).map((p) => ({ key: p.id, date: p.date, type: p.type, amount: p.amount }));
  const activityHistory = [...fundEvents, ...payoutEvents].sort((a, b) => new Date(b.date) - new Date(a.date));
  // Only the profit portion of each payout counts as "paid out" -- any part
  // that had to come from principal because profit ran out is excluded.
  const totalPaidOut = payoutBreakdown.reduce((s, p) => s + p.profitPortion, 0);

  return (
    <div className="min-h-screen bg-black bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.15),_transparent_60%)] px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Hi, <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">{user.name}</span>
            </h1>
            <p className="text-sm text-zinc-500">Your portfolio performance</p>
          </div>
          <button onClick={logout} className="text-sm text-zinc-400 hover:text-white transition-colors">
            Log out
          </button>
        </div>

        {series.length === 0 ? (
          <p className="mt-6 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            No performance data yet. Check back once daily values start coming in.
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              <StatCard label="Total Invested" value={fmt(invested)} />
              <StatCard label="Current Value" value={fmt(currentValue)} accent />
              <StatCard label="Gain / Loss" value={`${fmt(gain)} (${pct(gainPct)})`} positive={gain >= 0} />
              <StatCard label="Lifetime Profit" value={fmt(lifetimeProfit)} positive={lifetimeProfit >= 0} />
              <StatCard label="XIRR" value={xirr != null ? pct(xirr) : 'N/A'} positive={xirr != null ? xirr >= 0 : undefined} />
              <StatCard label="Invested Period" value={`${months} month${months === 1 ? '' : 's'}`} small />
              <StatCard label="Total Payout" value={fmt(totalPaidOut)} />
            </div>

            <div className="mt-6 bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
              <h2 className="text-sm font-medium text-zinc-200 mb-2">Cumulative Value</h2>
              <InvestmentChart series={series} />
            </div>

            <div className="mt-6 bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
              <h2 className="text-sm font-medium text-zinc-200 mb-2">Monthly Profit</h2>
              <ComparisonBarChart series={series} />
            </div>

            <div className="mt-6 bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
              <h2 className="text-sm font-medium text-zinc-200 mb-3">Monthly History</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-white/10">
                    <th className="py-2">Month</th>
                    <th className="py-2 text-right">% P&L</th>
                    <th className="py-2 text-right">Actual P&L</th>
                    <th className="py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map((s) => (
                    <tr key={s.month} className="border-b border-white/5 last:border-0">
                      <td className="py-2 text-zinc-300">{s.month}</td>
                      <td className={`py-2 text-right ${s.monthPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pct(s.monthPct)}
                      </td>
                      <td className={`py-2 text-right ${s.monthPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmt(s.monthPnl)}
                      </td>
                      <td className="py-2 text-right text-zinc-300">{fmt(s.strategyValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activityHistory.length > 0 && (
              <div className="mt-6 bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                <h2 className="text-sm font-medium text-zinc-200 mb-3">Payouts & Fund Additions</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-white/10">
                      <th className="py-2">Date</th>
                      <th className="py-2">Type</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityHistory.map((e) => (
                      <tr key={e.key} className="border-b border-white/5 last:border-0">
                        <td className="py-2 text-zinc-300">{e.date}</td>
                        <td className="py-2 capitalize text-zinc-300">{e.type}</td>
                        <td className={`py-2 text-right ${e.type === 'payout' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {e.type === 'payout' ? '-' : '+'}
                          {fmt(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, positive, small }) {
  return (
    <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 font-semibold ${small ? 'text-sm' : 'text-lg'} ${
          accent
            ? 'bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent'
            : positive === true
              ? 'text-emerald-400'
              : positive === false
                ? 'text-rose-400'
                : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400 text-sm">{children}</div>;
}
