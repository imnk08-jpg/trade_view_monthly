// One-time local setup: creates data/*.json if missing, and makes sure the
// default admin (7357567373) always exists. Safe to re-run -- it will not
// wipe out users/overrides/monthlyReturns you've already added via the app.
//
// data/feed.json (a daily strategy P&L feed) is checked into the repo as
// sample data from an earlier iteration of this app and is no longer used
// to compute P&L -- see README. It's left in place in case it's wired back
// in later.
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const DEFAULT_ADMIN_PHONE = '7357567373';

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

async function seed() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const adminsFile = path.join(DATA_DIR, 'admins.json');
  const admins = await readJson(adminsFile, []);
  if (!admins.some((a) => a.phone === DEFAULT_ADMIN_PHONE)) {
    admins.push({ phone: DEFAULT_ADMIN_PHONE, name: 'Vinayak', createdAt: new Date().toISOString() });
  }
  await writeJson(adminsFile, admins);

  const settingsFile = path.join(DATA_DIR, 'settings.json');
  const settings = await readJson(settingsFile, null);
  if (!settings) {
    await writeJson(settingsFile, { fdRate: 8, mfRate: 12, adminPin: '1234' });
  }

  const overridesFile = path.join(DATA_DIR, 'overrides.json');
  const overrides = await readJson(overridesFile, null);
  if (!overrides) {
    await writeJson(overridesFile, []);
  }

  const returnsFile = path.join(DATA_DIR, 'monthlyReturns.json');
  const monthlyReturns = await readJson(returnsFile, null);
  if (!monthlyReturns) {
    // Deliberately covers all four tiering branches: >3%, 0-3%, -3-0%, <-3%.
    await writeJson(returnsFile, [
      { id: 'mret_seed_04', adminPhone: DEFAULT_ADMIN_PHONE, month: '2026-04', pct: 8 },
      { id: 'mret_seed_05', adminPhone: DEFAULT_ADMIN_PHONE, month: '2026-05', pct: 2 },
      { id: 'mret_seed_06', adminPhone: DEFAULT_ADMIN_PHONE, month: '2026-06', pct: -5 },
      { id: 'mret_seed_07', adminPhone: DEFAULT_ADMIN_PHONE, month: '2026-07', pct: -1 },
    ]);
  }

  const usersFile = path.join(DATA_DIR, 'users.json');
  const users = await readJson(usersFile, null);
  if (!users) {
    await writeJson(usersFile, [
      {
        id: 'user_demo',
        name: 'Demo Investor',
        phone: '9999999999',
        adminPhone: DEFAULT_ADMIN_PHONE,
        contributions: [
          { date: '2026-04-01', amount: 80000 },
          { date: '2026-06-15', amount: 20000 }, // mid-month top-up, demonstrates proration
        ],
        payouts: [],
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  console.log('Seed complete.');
  console.log(`  Default admin: ${DEFAULT_ADMIN_PHONE} (PIN: ${settings ? settings.adminPin : '1234'})`);
  console.log('  Demo user: 9999999999 (aligned with default admin)');
}

seed();
