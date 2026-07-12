import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { setAdminSession, setUserPhone } from '../lib/session.js';

export default function Landing() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'pin'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitPhone(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.checkPhone(phone);
      if (result.role === 'admin' && result.pinRequired) {
        setStep('pin');
      } else if (result.role === 'user') {
        setUserPhone(phone);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitPin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.checkPhone(phone, pin);
      if (result.role === 'admin') {
        setAdminSession({ phone, pin });
        navigate('/admin');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.25),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(34,211,238,0.15),_transparent_55%)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-zinc-900/70 backdrop-blur rounded-2xl border border-white/10 shadow-[0_0_60px_-15px_rgba(168,85,247,0.4)] p-8">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Investment Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {step === 'phone'
            ? 'Enter your registered phone number to view your investment.'
            : `Enter admin PIN for ${phone}`}
        </p>

        {step === 'phone' && (
          <form onSubmit={submitPhone} className="mt-6 space-y-4">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="10-digit phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              autoFocus
              required
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 text-white text-sm font-medium py-2.5 hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'pin' && (
          <form onSubmit={submitPin} className="mt-6 space-y-4">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              autoFocus
              required
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 text-white text-sm font-medium py-2.5 hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Enter Admin Panel'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setPin('');
                setError('');
              }}
              className="w-full text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
