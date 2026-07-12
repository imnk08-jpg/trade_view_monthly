import { readCollection, writeCollection, newId } from './_lib/store.js';
import { requireAdmin, normalizePhone } from './_lib/auth.js';

// A user has ONE running invested total (`contributions`: an initial amount
// set when the admin adds them, plus any additional funds added later on
// specific dates) and is aligned with exactly ONE admin (`adminPhone`).
// That admin provides one overall % per month (see api/monthly-returns.js),
// which gets tiered and applied to this user's base fund. `payouts` records
// payout ("cash out profit") and reinvest ("convert profit into principal")
// events; see shared/returns.js for how all of this is combined into P&L.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const users = await readCollection('users');

    if (req.query && req.query.phone) {
      const phone = normalizePhone(req.query.phone);
      const user = users.find((u) => u.phone === phone);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.status(200).json(user);
      return;
    }

    if (!(await requireAdmin(req, res))) return;
    res.status(200).json(users);
    return;
  }

  if (req.method === 'POST') {
    if (!(await requireAdmin(req, res))) return;
    const { name, phone, startDate, initialAmount, adminPhone } = req.body || {};
    const normalizedPhone = normalizePhone(phone);
    if (!name || normalizedPhone.length !== 10 || !startDate || !(Number(initialAmount) > 0) || !adminPhone) {
      res.status(400).json({ error: 'name, phone, startDate, initialAmount, and adminPhone are required' });
      return;
    }

    const [users, admins] = await Promise.all([readCollection('users'), readCollection('admins')]);
    if (users.some((u) => u.phone === normalizedPhone)) {
      res.status(409).json({ error: 'A user with this phone number already exists' });
      return;
    }
    if (!admins.some((a) => a.phone === adminPhone)) {
      res.status(404).json({ error: 'No admin with that phone number' });
      return;
    }

    const user = {
      id: newId('user'),
      name,
      phone: normalizedPhone,
      adminPhone,
      contributions: [{ date: startDate, amount: Number(initialAmount) }],
      payouts: [],
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeCollection('users', users);
    res.status(201).json(user);
    return;
  }

  if (req.method === 'PUT') {
    if (!(await requireAdmin(req, res))) return;
    const { id, name, adminPhone, addContribution, addPayout, removePayout } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const users = await readCollection('users');
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = users[idx];
    if (!user.payouts) user.payouts = [];
    if (name !== undefined) user.name = name;

    if (adminPhone !== undefined) {
      const admins = await readCollection('admins');
      if (!admins.some((a) => a.phone === adminPhone)) {
        res.status(404).json({ error: 'No admin with that phone number' });
        return;
      }
      user.adminPhone = adminPhone;
    }

    if (addContribution) {
      if (!addContribution.date || !(Number(addContribution.amount) > 0)) {
        res.status(400).json({ error: 'addContribution needs a date and amount' });
        return;
      }
      user.contributions.push({ date: addContribution.date, amount: Number(addContribution.amount) });
    }

    if (addPayout) {
      if (!addPayout.date || !(Number(addPayout.amount) > 0) || !['payout', 'reinvest'].includes(addPayout.type)) {
        res.status(400).json({ error: 'addPayout needs a date, amount, and type (payout|reinvest)' });
        return;
      }
      user.payouts.push({
        id: newId('pay'),
        date: addPayout.date,
        amount: Number(addPayout.amount),
        type: addPayout.type,
      });
    }

    if (removePayout) {
      user.payouts = user.payouts.filter((p) => p.id !== removePayout);
    }

    users[idx] = user;
    await writeCollection('users', users);
    res.status(200).json(user);
    return;
  }

  if (req.method === 'DELETE') {
    if (!(await requireAdmin(req, res))) return;
    const { id } = req.query || {};
    if (!id) {
      res.status(400).json({ error: 'id is required' });
      return;
    }
    const users = await readCollection('users');
    await writeCollection('users', users.filter((u) => u.id !== id));
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
