import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Field } from './UsersTab.jsx';

export default function SettingsTab() {
  const [fdRate, setFdRate] = useState('');
  const [mfRate, setMfRate] = useState('');
  const [newPin, setNewPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setFdRate(s.fdRate);
        setMfRate(s.mfRate);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = { fdRate: Number(fdRate), mfRate: Number(mfRate) };
      if (newPin) payload.newPin = newPin;
      await api.updateSettings(payload);
      setNewPin('');
      setSuccess('Settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;

  return (
    <div className="max-w-sm bg-zinc-900/60 rounded-2xl border border-white/10 p-6">
      <form onSubmit={submit} className="space-y-4">
        <Field label="FD Rate (% per year)">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={fdRate}
            onChange={(e) => setFdRate(e.target.value)}
          />
        </Field>
        <Field label="Mutual Fund Rate (% per year)">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={mfRate}
            onChange={(e) => setMfRate(e.target.value)}
          />
        </Field>
        <Field label="Change Admin PIN (optional)">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Leave blank to keep current PIN"
            className="input"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white text-sm font-medium py-2.5 hover:brightness-110 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
