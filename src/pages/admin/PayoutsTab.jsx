import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Field } from './UsersTab.jsx';
import { buildAdminMonthly, buildUserMonthlySeries } from '../../../shared/returns.js';

const fmt = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

// Lets an admin pay out a user's accrued profit in cash. See
// shared/returns.js for exactly how a payout affects the user's numbers.
export default function PayoutsTab() {
  const [users, setUsers] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [userList, returnsList, overrideList] = await Promise.all([
        api.listUsers(),
        api.listMonthlyReturns(),
        api.listOverrides(),
      ]);
      setUsers(userList);
      setMonthlyReturns(returnsList);
      setOverrides(overrideList);
      if (!selectedId && userList.length > 0) setSelectedId(userList[0].id);
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

  const selectedUser = users.find((u) => u.id === selectedId);
  const adminMonthly = buildAdminMonthly(monthlyReturns);
  const { series, payoutBreakdown } = selectedUser
    ? buildUserMonthlySeries(
        selectedUser.id,
        selectedUser.adminPhone,
        selectedUser.contributions,
        selectedUser.payouts,
        adminMonthly,
        overrides,
        0,
        0
      )
    : { series: [], payoutBreakdown: [] };
  const latest = series[series.length - 1];
  const availableProfit = latest?.cumulativePnl || 0;

  const history = selectedUser
    ? [...(selectedUser.payouts || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];
  // Only the profit portion of each payout counts toward "paid out" -- any
  // part that had to come from principal (because profit ran out) isn't a
  // payout of earnings, so it's excluded here.
  const totalPaidOut = payoutBreakdown.reduce((s, p) => s + p.profitPortion, 0);
  const breakdownById = new Map(payoutBreakdown.map((p) => [p.id, p]));

  async function submit(e) {
    e.preventDefault();
    if (!selectedId || !(Number(amount) > 0)) return;
    setSaving(true);
    setError('');
    try {
      await api.updateUser({ id: selectedId, addPayout: { date, amount: Number(amount), type: 'payout' } });
      setAmount('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setSaving(true);
    setError('');
    try {
      await api.updateUser({ id: selectedId, removePayout: id });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-zinc-300 mb-1">Payouts</h2>
      <p className="text-xs text-zinc-500 mb-3">
        A payout cashes out accrued profit. If it's larger than the available profit, the excess is
        withdrawn from principal instead (profit never goes negative).
      </p>

      {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Field label="User">
              <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.phone})
                  </option>
                ))}
              </select>
            </Field>

            {selectedUser && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                  <p className="text-xs text-zinc-500">Current Value</p>
                  <p className="text-lg font-semibold text-white">{fmt(latest?.strategyValue)}</p>
                </div>
                <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                  <p className="text-xs text-zinc-500">Available Profit</p>
                  <p className={`text-lg font-semibold ${availableProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmt(availableProfit)}
                  </p>
                </div>
                <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-4">
                  <p className="text-xs text-zinc-500">Total Paid Out</p>
                  <p className="text-lg font-semibold text-white">{fmt(totalPaidOut)}</p>
                </div>
              </div>
            )}

            <div className="mt-3 bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-white/10 bg-white/5">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => {
                    const breakdown = breakdownById.get(p.id);
                    return (
                      <tr key={p.id} className="border-b border-white/5 last:border-0">
                        <td className="py-2 px-3 text-zinc-300">{p.date}</td>
                        <td className="py-2 px-3 capitalize text-zinc-300">{p.type}</td>
                        <td className="py-2 px-3 text-right text-zinc-300">
                          {fmt(p.amount)}
                          {breakdown && breakdown.principalPortion > 0 && (
                            <span className="block text-xs text-amber-400">
                              {fmt(breakdown.principalPortion)} from principal
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => remove(p.id)}
                            disabled={saving}
                            className="text-xs text-rose-400 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-zinc-500">
                        No payouts yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Add Payout</h3>
            <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
              <form onSubmit={submit} className="space-y-4">
                <Field label="Date">
                  <input required type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Amount ₹">
                  <input
                    required
                    type="number"
                    min="1"
                    className="input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <button
                  type="submit"
                  disabled={saving || !selectedId}
                  className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white text-sm font-medium py-2.5 hover:brightness-110 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
