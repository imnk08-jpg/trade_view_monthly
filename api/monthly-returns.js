import { readCollection, writeCollection, newId } from './_lib/store.js';
import { requireAdmin } from './_lib/auth.js';

// Each admin provides ONE overall raw % for a given month, which every user
// aligned with them gets tiered against (see shared/returns.js). One entry
// per (adminPhone, month) -- POST upserts by that key.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json(await readCollection('monthlyReturns'));
    return;
  }

  if (req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return;
    const { adminPhone, month, pct } = req.body || {};
    if (!adminPhone || !/^\d{4}-\d{2}$/.test(month || '') || pct === undefined || pct === null || isNaN(Number(pct))) {
      res.status(400).json({ error: 'adminPhone, month (YYYY-MM), and a numeric pct are required' });
      return;
    }

    const admins = await readCollection('admins');
    if (!admins.some((a) => a.phone === adminPhone)) {
      res.status(404).json({ error: 'No admin with that phone number' });
      return;
    }

    const monthlyReturns = await readCollection('monthlyReturns');
    const idx = monthlyReturns.findIndex((r) => r.adminPhone === adminPhone && r.month === month);
    if (idx === -1) {
      const entry = { id: newId('mret'), adminPhone, month, pct: Number(pct) };
      monthlyReturns.push(entry);
      await writeCollection('monthlyReturns', monthlyReturns);
      res.status(201).json(entry);
      return;
    }
    monthlyReturns[idx].pct = Number(pct);
    await writeCollection('monthlyReturns', monthlyReturns);
    res.status(200).json(monthlyReturns[idx]);
    return;
  }

  if (req.method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return;
    const { id } = req.query || {};
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const monthlyReturns = await readCollection('monthlyReturns');
    await writeCollection('monthlyReturns', monthlyReturns.filter((r) => r.id !== id));
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
