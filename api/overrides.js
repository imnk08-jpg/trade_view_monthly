import { readCollection, writeCollection, newId } from './_lib/store.js';
import { requireAdmin } from './_lib/auth.js';

// Admin-controlled list of (userId, month) pairs that change how a user's
// monthly P&L is computed for that month:
//   amount omitted/null -- use the admin's RAW monthly % instead of tiered.
//   amount a number     -- use this absolute rupee P&L instead of any %
//                           (positive or negative), bypassing the tiering
//                           and proration math entirely for that month.
// POST upserts by (userId, month) -- calling it again updates the amount.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json(await readCollection('overrides'));
    return;
  }

  if (req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return;
    const { userId, month, amount } = req.body || {};
    if (!userId || !/^\d{4}-\d{2}$/.test(month || '')) {
      res.status(400).json({ error: 'userId and month (YYYY-MM) are required' });
      return;
    }
    if (amount !== undefined && amount !== null && (typeof amount !== 'number' || Number.isNaN(amount))) {
      res.status(400).json({ error: 'amount must be a number if provided' });
      return;
    }

    const overrides = await readCollection('overrides');
    const idx = overrides.findIndex((o) => o.userId === userId && o.month === month);
    if (idx !== -1) {
      overrides[idx].amount = amount ?? null;
      await writeCollection('overrides', overrides);
      res.status(200).json(overrides[idx]);
      return;
    }
    const override = { id: newId('ovr'), userId, month, amount: amount ?? null };
    overrides.push(override);
    await writeCollection('overrides', overrides);
    res.status(201).json(override);
    return;
  }

  if (req.method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return;
    const { id } = req.query || {};
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const overrides = await readCollection('overrides');
    await writeCollection('overrides', overrides.filter((o) => o.id !== id));
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
