import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminSession, clearAdminSession } from '../lib/session.js';
import UsersTab from './admin/UsersTab.jsx';
import ReturnsTab from './admin/ReturnsTab.jsx';
import PayoutsTab from './admin/PayoutsTab.jsx';
import AdminProfitTab from './admin/AdminProfitTab.jsx';
import SettingsTab from './admin/SettingsTab.jsx';
import AdminsTab from './admin/AdminsTab.jsx';

const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'returns', label: 'Returns' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'profit', label: 'Admin Profit' },
  { key: 'settings', label: 'Settings' },
  { key: 'admins', label: 'Admins' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    const s = getAdminSession();
    if (!s) {
      navigate('/');
      return;
    }
    setSession(s);
  }, [navigate]);

  function logout() {
    clearAdminSession();
    navigate('/');
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-black bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.15),_transparent_60%)] px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
            <p className="text-sm text-zinc-500">Signed in as {session.phone}</p>
          </div>
          <button onClick={logout} className="text-sm text-zinc-400 hover:text-white transition-colors">
            Log out
          </button>
        </div>

        <div className="mt-6 flex gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-fuchsia-500 text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'users' && <UsersTab />}
          {tab === 'returns' && <ReturnsTab />}
          {tab === 'payouts' && <PayoutsTab />}
          {tab === 'profit' && <AdminProfitTab />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'admins' && <AdminsTab />}
        </div>
      </div>
    </div>
  );
}
