import { readCollection, writeCollection } from './_lib/store.js';
import { requireAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const settings = await readCollection('settings');
    // Never expose the PIN to the public GET; only rates are needed client-side.
    res.status(200).json({ fdRate: settings.fdRate, mfRate: settings.mfRate });
    return;
  }

  if (req.method === 'PUT') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const { fdRate, mfRate, newPin } = req.body || {};
    const settings = await readCollection('settings');

    if (fdRate !== undefined) {
      if (!(fdRate >= 0)) {
        res.status(400).json({ error: 'fdRate must be a non-negative number' });
        return;
      }
      settings.fdRate = Number(fdRate);
    }
    if (mfRate !== undefined) {
      if (!(mfRate >= 0)) {
        res.status(400).json({ error: 'mfRate must be a non-negative number' });
        return;
      }
      settings.mfRate = Number(mfRate);
    }
    if (newPin !== undefined) {
      if (!/^\d{4,8}$/.test(newPin)) {
        res.status(400).json({ error: 'PIN must be 4-8 digits' });
        return;
      }
      settings.adminPin = newPin;
    }

    await writeCollection('settings', settings);
    res.status(200).json({ fdRate: settings.fdRate, mfRate: settings.mfRate });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
