import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import {
  buildAdminMonthly,
  buildUserMonthlySeries,
  getOverride,
  tieredReturnPct,
  monthKey,
} from '../../../shared/returns.js';

const fmt = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const today = () => new Date().toISOString().slice(0, 10);
const PRIMARY_BTN =
  'text-sm bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white px-3 py-1.5 rounded-lg hover:brightness-110 transition disabled:opacity-50';

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

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
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function adminName(phone) {
    return admins.find((a) => a.phone === phone)?.name || phone || '—';
  }

  const adminMonthly = buildAdminMonthly(monthlyReturns);
  const selectedUser = users.find((u) => u.id === selectedId);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-medium text-zinc-300">
          {users.length} user{users.length === 1 ? '' : 's'}
        </h2>
        <button onClick={() => setShowAdd(true)} className={PRIMARY_BTN}>
          + Add User
        </button>
      </div>

      {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <div className="bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-white/10 bg-white/5">
                <th className="py-2 px-4">Name</th>
                <th className="py-2 px-4">Phone</th>
                <th className="py-2 px-4">Admin</th>
                <th className="py-2 px-4 text-right">Invested</th>
                <th className="py-2 px-4 text-right">Current Value</th>
                <th className="py-2 px-4 text-right">Lifetime Profit</th>
                <th className="py-2 px-4 text-right">Payout Done</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
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
                const lifetimeProfit = latest?.lifetimeProfit || 0;
                const totalPayout = (u.payouts || [])
                  .filter((p) => p.type === 'payout')
                  .reduce((s, p) => s + p.amount, 0);
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="py-2 px-4 font-medium text-white">{u.name}</td>
                    <td className="py-2 px-4 text-zinc-300">{u.phone}</td>
                    <td className="py-2 px-4 text-zinc-300">{adminName(u.adminPhone)}</td>
                    <td className="py-2 px-4 text-right text-zinc-300">{fmt(latest?.principal)}</td>
                    <td className="py-2 px-4 text-right text-zinc-300">{fmt(latest?.strategyValue)}</td>
                    <td className={`py-2 px-4 text-right ${lifetimeProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmt(lifetimeProfit)}
                    </td>
                    <td className="py-2 px-4 text-right text-zinc-300">{fmt(totalPayout)}</td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddUserModal
          admins={admins}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          admins={admins}
          monthlyReturns={monthlyReturns}
          overrides={overrides}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function AddUserModal({ admins, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [initialAmount, setInitialAmount] = useState('');
  const [adminPhone, setAdminPhone] = useState(admins[0]?.phone || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createUser({ name, phone, startDate, initialAmount: Number(initialAmount), adminPhone });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input required className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date">
            <input
              required
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Initial Invested Fund ₹">
            <input
              required
              type="number"
              min="1"
              className="input"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Admin">
          <select required className="input" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)}>
            <option value="">Select an admin</option>
            {admins.map((a) => (
              <option key={a.phone} value={a.phone}>
                {a.name} ({a.phone})
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white text-sm font-medium py-2.5 hover:brightness-110 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add User'}
        </button>
      </form>
    </Modal>
  );
}

function UserDetailModal({ user, admins, monthlyReturns, overrides, onClose, onChanged }) {
  const [adminPhone, setAdminPhone] = useState(user.adminPhone);
  const [showAddFund, setShowAddFund] = useState(false);
  const [fundDate, setFundDate] = useState(today());
  const [fundAmount, setFundAmount] = useState('');
  const [busyMonth, setBusyMonth] = useState(null);
  const [amountDrafts, setAmountDrafts] = useState({}); // month -> string
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const baseFund = (user.contributions || []).reduce((s, c) => s + c.amount, 0);
  const adminMonthly = buildAdminMonthly(monthlyReturns);
  const { series } = buildUserMonthlySeries(
    user.id,
    user.adminPhone,
    user.contributions,
    user.payouts,
    adminMonthly,
    overrides,
    0,
    0
  );
  const lifetimeProfit = series[series.length - 1]?.lifetimeProfit || 0;
  const firstMonth = user.contributions?.length
    ? user.contributions.reduce((min, c) => (monthKey(c.date) < min ? monthKey(c.date) : min), monthKey(user.contributions[0].date))
    : null;

  const rows = monthlyReturns
    .filter((r) => r.adminPhone === user.adminPhone && (!firstMonth || r.month >= firstMonth))
    .sort((a, b) => a.month.localeCompare(b.month));

  async function saveAdmin() {
    if (adminPhone === user.adminPhone) return;
    setSaving(true);
    setError('');
    try {
      await api.updateUser({ id: user.id, adminPhone });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addFund(e) {
    e.preventDefault();
    if (!(Number(fundAmount) > 0)) return;
    setSaving(true);
    setError('');
    try {
      await api.updateUser({ id: user.id, addContribution: { date: fundDate, amount: Number(fundAmount) } });
      setShowAddFund(false);
      setFundAmount('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleOverride(month, currentlyOverridden) {
    setBusyMonth(month);
    setError('');
    try {
      if (currentlyOverridden) {
        const existing = overrides.find((o) => o.userId === user.id && o.month === month);
        if (existing) await api.removeOverride(existing.id);
      } else {
        await api.addOverride({ userId: user.id, month });
      }
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMonth(null);
    }
  }

  async function saveFixedAmount(month) {
    const raw = amountDrafts[month];
    if (raw === undefined || raw.trim() === '') return;
    const amount = Number(raw);
    if (Number.isNaN(amount)) return;
    setBusyMonth(month);
    setError('');
    try {
      await api.addOverride({ userId: user.id, month, amount });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMonth(null);
    }
  }

  async function clearFixedAmount(month) {
    setBusyMonth(month);
    setError('');
    try {
      const existing = overrides.find((o) => o.userId === user.id && o.month === month);
      if (existing) await api.removeOverride(existing.id);
      setAmountDrafts((prev) => {
        const next = { ...prev };
        delete next[month];
        return next;
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMonth(null);
    }
  }

  async function removeUser() {
    if (!window.confirm(`Remove ${user.name}? This deletes their record permanently.`)) return;
    setSaving(true);
    setError('');
    try {
      await api.removeUser(user.id);
      onClose();
      onChanged();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`${user.name} · ${user.phone}`} onClose={onClose} wide>
      <div className="flex items-center justify-between mb-4 bg-white/5 rounded-lg px-4 py-3">
        <div>
          <p className="text-xs text-zinc-500">Total Invested</p>
          <p className="text-lg font-semibold text-white">{fmt(baseFund)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Lifetime Profit</p>
          <p className={`text-lg font-semibold ${lifetimeProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmt(lifetimeProfit)}
          </p>
        </div>
        <button onClick={() => setShowAddFund((v) => !v)} disabled={saving} className={PRIMARY_BTN}>
          + Add Fund
        </button>
      </div>

      {showAddFund && (
        <form onSubmit={addFund} className="flex gap-2 items-end mb-4 bg-white/5 rounded-lg px-4 py-3">
          <Field label="Date">
            <input type="date" className="input py-1" value={fundDate} onChange={(e) => setFundDate(e.target.value)} />
          </Field>
          <Field label="Additional Amount ₹">
            <input
              type="number"
              min="1"
              required
              className="input py-1 w-32"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
            />
          </Field>
          <button type="submit" disabled={saving} className={PRIMARY_BTN.replace('text-sm', 'text-xs')}>
            Add Fund
          </button>
        </form>
      )}

      <div className="flex gap-2 items-end mb-4">
        <div className="flex-1">
          <Field label="Assigned Admin">
            <select className="input" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)}>
              {admins.map((a) => (
                <option key={a.phone} value={a.phone}>
                  {a.name} ({a.phone})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          onClick={saveAdmin}
          disabled={saving || adminPhone === user.adminPhone}
          className={PRIMARY_BTN.replace('py-1.5', 'py-2')}
        >
          Save
        </button>
      </div>

      <h3 className="text-sm font-medium text-zinc-200 mb-1">Monthly Returns & Exceptions</h3>
      <p className="text-xs text-zinc-500 mb-2">
        Check "Actual %" to give this user the raw return for that month instead of the tiered/halved
        amount, or set a fixed ₹ P&L to override the whole month's return with an exact amount
        (positive or negative) -- both apply to this user only, and a fixed amount takes priority.
      </p>
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-white/10 bg-white/5">
              <th className="py-2 px-3">Month</th>
              <th className="py-2 px-3 text-right">Raw</th>
              <th className="py-2 px-3 text-right">Tiered (default)</th>
              <th className="py-2 px-3 text-center">Actual %</th>
              <th className="py-2 px-3 text-right">Fixed P&L ₹</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const override = getOverride(overrides, user.id, r.month);
              const hasAbsolute = !!override && override.amount !== null && override.amount !== undefined;
              const overridden = !!override && !hasAbsolute;
              const draft = amountDrafts[r.month] ?? (hasAbsolute ? String(override.amount) : '');
              const busy = busyMonth === r.month;
              return (
                <tr key={r.month} className="border-b border-white/5 last:border-0">
                  <td className="py-2 px-3 text-zinc-300">{r.month}</td>
                  <td className="py-2 px-3 text-right text-zinc-500">{pct(r.pct)}</td>
                  <td className="py-2 px-3 text-right text-zinc-300">{pct(tieredReturnPct(r.pct))}</td>
                  <td className="py-2 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={overridden}
                      disabled={busy || hasAbsolute}
                      onChange={() => toggleOverride(r.month, overridden)}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        placeholder="e.g. -500"
                        className="input py-1 w-28 text-right"
                        value={draft}
                        disabled={busy}
                        onChange={(e) =>
                          setAmountDrafts((prev) => ({ ...prev, [r.month]: e.target.value }))
                        }
                      />
                      <button
                        onClick={() => saveFixedAmount(r.month)}
                        disabled={busy || draft.trim() === ''}
                        className="text-xs text-fuchsia-400 hover:underline disabled:opacity-40"
                      >
                        Set
                      </button>
                      {hasAbsolute && (
                        <button
                          onClick={() => clearFixedAmount(r.month)}
                          disabled={busy}
                          className="text-xs text-rose-400 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 px-3 text-zinc-500">
                  No monthly returns entered for this admin yet -- add them in the Returns tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-rose-400 mt-2">{error}</p>}

      <div className="mt-4 pt-4 border-t border-white/10">
        <button onClick={removeUser} disabled={saving} className="text-xs text-rose-400 hover:underline disabled:opacity-50">
          Remove User
        </button>
      </div>
    </Modal>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className={`bg-zinc-900 rounded-2xl shadow-[0_0_60px_-15px_rgba(168,85,247,0.4)] border border-white/10 p-6 w-full ${wide ? 'max-w-2xl' : 'max-w-sm'} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
