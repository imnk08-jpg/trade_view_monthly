import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Field } from './UsersTab.jsx';

export default function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setAdmins(await api.listAdmins());
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

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.addAdmin({ name, phone });
      setName('');
      setPhone('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">
          {admins.length} admin{admins.length === 1 ? '' : 's'}
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : (
          <div className="bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-white/10 bg-white/5">
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Phone</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.phone} className="border-b border-white/5 last:border-0">
                    <td className="py-2 px-4 font-medium text-white">{a.name}</td>
                    <td className="py-2 px-4 text-zinc-300">{a.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Add Admin</h2>
        <div className="bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Name">
              <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input required className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white text-sm font-medium py-2.5 hover:brightness-110 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Admin'}
            </button>
            <p className="text-xs text-zinc-500">
              New admins share the same admin PIN set in the Settings tab.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
