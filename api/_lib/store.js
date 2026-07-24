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
const JSONBIN_API_KEY = "$2a$10$9VvuvF8bMNFiry/b5nh8duUn6N6f4NaABPpb4CZmFhjQJzDh8Q7c.";
const HARDCODED_JSONBIN_BINS = {
  users: '6a535723da38895dfe52097f',
  overrides: '6a535749f5f4af5e29839548',
  admins: '6a535768f5f4af5e298395a7',
  settings: '6a53577eda38895dfe520a6b',
  monthlyReturns: '6a535799da38895dfe520ab8',
};

const STORAGE = "jsonbin";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// jsonbin's free tier rate-limits fairly aggressively, and a single page
// load here fires off reads for several collections at once (plus every
// admin-authenticated request re-reads admins+settings via requireAdmin) --
// easily enough to trip a 429 under completely normal use. Retry a 429 a
// few times with backoff before giving up; other error statuses fail fast.
async function fetchJsonbinWithRetry(url, options, label) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status === 429 && attempt < maxAttempts) {
      await sleep(300 * 2 ** (attempt - 1)); // 300ms, 600ms, 1200ms
      continue;
    }
    throw new Error(`${label}: ${res.status}`);
  }
}

// Short-lived read cache, keyed by collection name, plus in-flight request
// de-duping -- several API handlers reading the same collection within the
// same page load (e.g. every admin-authenticated request reads 'admins' and
// 'settings' via requireAdmin) collapse into a single jsonbin call instead
// of one each, which is most of what was tripping the rate limit above.
const READ_CACHE_TTL_MS = 4000;
const readCache = new Map(); // name -> { data, expiresAt }
const inFlightReads = new Map(); // name -> Promise<data>

async function readJsonbin(name) {
  const cached = readCache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  if (inFlightReads.has(name)) return inFlightReads.get(name);

  const promise = (async () => {
    const binId = jsonbinBinId(name);
    const res = await fetchJsonbinWithRetry(
      `${JSONBIN_BASE}/${binId}/latest`,
      { headers: { 'X-Master-Key': JSONBIN_API_KEY } },
      `jsonbin read failed for ${name}`
    );
    const body = await res.json();
    const data = body.record ?? (name === 'settings' ? {} : []);
    readCache.set(name, { data, expiresAt: Date.now() + READ_CACHE_TTL_MS });
    return data;
  })();

  inFlightReads.set(name, promise);
  try {
    return await promise;
  } finally {
    inFlightReads.delete(name);
  }
}

async function writeJsonbin(name, data) {
  const binId = jsonbinBinId(name);
  await fetchJsonbinWithRetry(
    `${JSONBIN_BASE}/${binId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
      },
      body: JSON.stringify(data),
    },
    `jsonbin write failed for ${name}`
  );
  // Keep the cache consistent with what we just wrote instead of waiting
  // for it to expire and re-fetching a value we already have.
  readCache.set(name, { data, expiresAt: Date.now() + READ_CACHE_TTL_MS });
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
