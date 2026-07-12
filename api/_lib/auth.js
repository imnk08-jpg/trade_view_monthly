import { readCollection } from './store.js';

export function normalizePhone(phone) {
  return (phone || '').toString().replace(/\D/g, '').slice(-10);
}

// Every admin-only endpoint sends the admin's phone + the shared admin PIN
// as headers (set once after login, kept in sessionStorage on the client).
// There are no sessions/tokens -- this is intentionally lightweight, in
// keeping with the "no login system" requirement for regular users.
export async function requireAdmin(req, res) {
  const phone = normalizePhone(req.headers['x-admin-phone']);
  const pin = req.headers['x-admin-pin'];
  if (!phone || !pin) {
    res.status(401).json({ error: 'Admin auth required' });
    return null;
  }
  const [admins, settings] = await Promise.all([
    readCollection('admins'),
    readCollection('settings'),
  ]);
  const admin = admins.find((a) => a.phone === phone);
  if (!admin || pin !== settings.adminPin) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return null;
  }
  return admin;
}
