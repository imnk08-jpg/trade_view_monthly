import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { getAdminSession } from '../../lib/session.js';
import { Field } from './UsersTab.jsx';
import { tieredReturnPct } from '../../../shared/returns.js';

const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

// Each admin provides ONE overall % return per month for their whole group
// of users. That raw % then goes through the same tiering rule as before
// (>3% halved, 0-3% in full, -3-0% zero, <-3% halved), unless a per-user
// exception is set on that user's page in the Users tab.
export default function ReturnsTab() {
  const [admins, setAdmins] = useState([]);
  const [monthlyReturns, setMonthlyReturns] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState(getAdminSession()?.phone || '');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pctValue, setPctValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [adminList, returnsList] = await Promise.all([api.listAdmins(), api.listMonthlyReturns()]);
      setAdmins(adminList);
      setMonthlyReturns(returnsList);
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

  const rows = monthlyReturns
    .filter((r) => r.adminPhone === selectedAdmin)
    .sort((a, b) => b.month.localeCompare(a.month));

  async function submit(e) {
    e.preventDefault();
    if (!selectedAdmin || pctValue === '') return;
    setSaving(true);
    setError('');
    try {
      await api.upsertMonthlyReturn({ adminPhone: selectedAdmin, month, pct: Number(pctValue) });
      setPctValue('');
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
      await api.removeMonthlyReturn(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-zinc-300 mb-1">Monthly Returns by Admin</h2>
      <p className="text-xs text-zinc-500 mb-3">
        Every user aligned with an admin shares that admin's overall % for a given month. The tiering
        rule is applied automatically -- users see the tiered amount unless a per-user exception is set
        on their page in the Users tab.
      </p>

      {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <Field label="Admin">
              <select className="input" value={selectedAdmin} onChange={(e) => setSelectedAdmin(e.target.value)}>
                {admins.map((a) => (
                  <option key={a.phone} value={a.phone}>
                    {a.name} ({a.phone})
                  </option>
                ))}
              </select>
            </Field>

            <div className="mt-3 bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-white/10 bg-white/5">
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3 text-right">Raw %</th>
                    <th className="py-2 px-3 text-right">Tiered (default)</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 px-3 text-zinc-300">{r.month}</td>
                      <td className="py-2 px-3 text-right text-zinc-300">{pct(r.pct)}</td>
                      <td className="py-2 px-3 text-right text-zinc-500">{pct(tieredReturnPct(r.pct))}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => remove(r.id)}
                          disabled={saving}
                          className="text-xs text-rose-400 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-zinc-500">
                        No months entered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Add / Update a Month</h3>
            <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
              <form onSubmit={submit} className="space-y-4">
                <Field label="Month">
                  <input
                    required
                    type="month"
                    className="input"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </Field>
                <Field label="Overall % Return">
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="input"
                    value={pctValue}
                    onChange={(e) => setPctValue(e.target.value)}
                  />
                </Field>
                <button
                  type="submit"
                  disabled={saving || !selectedAdmin}
                  className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white text-sm font-medium py-2.5 hover:brightness-110 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <p className="text-xs text-zinc-500">
                  Saving an existing month overwrites its %.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
