import { readCollection } from './_lib/store.js';
import { normalizePhone } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { phone, pin } = req.body || {};
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 10) {
    res.status(400).json({ error: 'Enter a valid 10-digit phone number' });
    return;
  }

  const [admins, users, settings] = await Promise.all([
    readCollection('admins'),
    readCollection('users'),
    readCollection('settings'),
  ]);

  const admin = admins.find((a) => a.phone === normalized);
  if (admin) {
    if (!pin) {
      res.status(200).json({ role: 'admin', pinRequired: true });
      return;
    }
    if (pin !== settings.adminPin) {
      res.status(401).json({ error: 'Incorrect PIN' });
      return;
    }
    res.status(200).json({ role: 'admin', admin: { phone: admin.phone, name: admin.name } });
    return;
  }

  const user = users.find((u) => u.phone === normalized);
  if (user) {
    res.status(200).json({ role: 'user', user });
    return;
  }

  res.status(404).json({ role: 'unknown', error: 'No records found for this number' });
}
