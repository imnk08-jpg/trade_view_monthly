import { readCollection, writeCollection } from './_lib/store.js';
import { requireAdmin, normalizePhone } from './_lib/auth.js';

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') {
    const admins = await readCollection('admins');
    res.status(200).json(admins);
    return;
  }

  if (req.method === 'POST') {
    const { name, phone } = req.body || {};
    const normalized = normalizePhone(phone);
    if (!name || normalized.length !== 10) {
      res.status(400).json({ error: 'name and a valid 10-digit phone are required' });
      return;
    }
    const admins = await readCollection('admins');
    if (admins.some((a) => a.phone === normalized)) {
      res.status(409).json({ error: 'This phone number is already an admin' });
      return;
    }
    const admin = { phone: normalized, name, createdAt: new Date().toISOString() };
    admins.push(admin);
    await writeCollection('admins', admins);
    res.status(201).json(admin);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
