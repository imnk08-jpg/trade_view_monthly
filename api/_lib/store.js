// Storage abstraction: local JSON files for now, jsonbin.io later.
//
// Swap backend by setting STORAGE=jsonbin (see README). Every collection maps
// to one jsonbin "bin". No other code in this app should touch the
// filesystem or jsonbin directly -- everything goes through
// readCollection/writeCollection so the swap is a one-file change.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const COLLECTIONS = ['users', 'overrides', 'admins', 'settings', 'monthlyReturns'];
const JSONBIN_API_KEY = "$2a$10$xVaqsCCwULKW67lxwdaSoOEOquM44iApmBBdMEizxnwKVLdiihE7G";
const HARDCODED_JSONBIN_BINS = {
  users: '6a51aab7da38895dfe4dd7cb',
  overrides: '6a51ab25f5f4af5e297f6377',
  admins: '6a51aaf5f5f4af5e297f630e',
  settings: '6a51ab53f5f4af5e297f63d0',
  monthlyReturns: '6a51ab3bda38895dfe4dd8ed',
};

const STORAGE = process.env.STORAGE || 'local';

function assertKnownCollection(name) {
  if (!COLLECTIONS.includes(name)) {
    throw new Error(`Unknown collection "${name}"`);
  }
}

// ---------- local file backend ----------

async function readLocal(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return name === 'settings' ? {} : [];
    throw err;
  }
}

async function writeLocal(name, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- jsonbin.io backend ----------
// Requires JSONBIN_API_KEY and one JSONBIN_BIN_<COLLECTION> env var per
// collection, e.g. JSONBIN_BIN_USERS, JSONBIN_BIN_TRANSACTIONS, etc.

const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b';

function jsonbinBinId(name) {
  const key = `JSONBIN_BIN_${name.toUpperCase()}`;
  const envId = process.env[key];
  const id = envId || HARDCODED_JSONBIN_BINS[name];
  if (!id) throw new Error(`Missing env var ${key} for jsonbin storage`);
  return id;
}

async function readJsonbin(name) {
  const binId = jsonbinBinId(name);
  const res = await fetch(`${JSONBIN_BASE}/${binId}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_API_KEY },
  });
  if (!res.ok) throw new Error(`jsonbin read failed for ${name}: ${res.status}`);
  const body = await res.json();
  return body.record ?? (name === 'settings' ? {} : []);
}

async function writeJsonbin(name, data) {
  const binId = jsonbinBinId(name);
  const res = await fetch(`${JSONBIN_BASE}/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_API_KEY,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`jsonbin write failed for ${name}: ${res.status}`);
}

// ---------- public API ----------

export async function readCollection(name) {
  assertKnownCollection(name);
  return STORAGE === 'jsonbin' ? readJsonbin(name) : readLocal(name);
}

export async function writeCollection(name, data) {
  assertKnownCollection(name);
  return STORAGE === 'jsonbin' ? writeJsonbin(name, data) : writeLocal(name, data);
}

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- daily P&L feed ----------
// This is a separate, read-only-from-this-app data source: a daily
// { strategies: [{id,name,color}], entries: [{date,strategy,investedFunds,pnl}] }
// feed maintained externally. Independent of STORAGE -- set FEED_JSONBIN_BIN_ID
// (and optionally FEED_JSONBIN_API_KEY, if the bin isn't public-read) to pull
// it from jsonbin regardless of where users/admins/settings live. Falls back
// to data/feed.json for local dev.

const EMPTY_FEED = { strategies: [], entries: [] };

export async function readFeed() {
  if (process.env.FEED_JSONBIN_BIN_ID) {
    const res = await fetch(`${JSONBIN_BASE}/${process.env.FEED_JSONBIN_BIN_ID}/latest`, {
      headers: process.env.FEED_JSONBIN_API_KEY || JSONBIN_API_KEY
        ? { 'X-Master-Key': process.env.FEED_JSONBIN_API_KEY || JSONBIN_API_KEY }
        : {},
    });
    if (!res.ok) throw new Error(`jsonbin feed read failed: ${res.status}`);
    const body = await res.json();
    return body.record ?? EMPTY_FEED;
  }

  const file = path.join(DATA_DIR, 'feed.json');
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return EMPTY_FEED;
    throw err;
  }
}
