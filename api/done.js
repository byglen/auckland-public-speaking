// api/done.js — the done-prompts list, kept server-side so it survives any
// browser, profile, incognito window or cleared cache.
//
// Storage is an Upstash Redis database attached to the Vercel project
// (Vercel → Storage → Create Database → Upstash Redis → Connect). Vercel then
// injects <PREFIX>_REST_API_URL / <PREFIX>_REST_API_TOKEN into the deployment
// (prefix chosen when connecting; KV or STORAGE are the usual ones); this
// function accepts any prefix. No npm dependencies — it talks to the Upstash
// REST API with fetch.
//
//   GET  /api/done          → { donePrompts: ["q001", …], updatedAt }
//   PUT  /api/done          ← { donePrompts: ["q001", …] }   (replaces the list)
//
// Until a store is connected the function answers 503 and the app quietly
// falls back to browser storage, showing "on this device only" in the panel.

const KEY = 'aps:donePrompts:v1';

// The Vercel marketplace integration names the variables <PREFIX>_REST_API_URL
// and <PREFIX>_REST_API_TOKEN, where the prefix is whatever was typed when
// connecting the store (KV by default, STORAGE if left blank). Upstash's own
// integration uses UPSTASH_REDIS_REST_URL / _TOKEN. Accept any of them.
function findEnv(suffixes) {
  for (const suffix of suffixes) {
    const key = Object.keys(process.env).find((k) => k.endsWith(suffix) && process.env[k]);
    if (key) return process.env[key];
  }
  return null;
}
const REST_URL = findEnv(['_REST_API_URL', '_REDIS_REST_URL']);
const REST_TOKEN = findEnv(['_REST_API_TOKEN', '_REDIS_REST_TOKEN']);

async function redis(command) {
  const r = await fetch(REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(`redis: ${data.error}`);
  return data.result;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(JSON.parse(req.body));
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!REST_URL || !REST_TOKEN) {
    return res.status(503).json({
      error: 'no-store',
      message: 'No Redis store is connected to this deployment. In Vercel: Storage → Create Database → Upstash Redis → connect to this project, then redeploy.'
    });
  }

  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      const saved = raw ? JSON.parse(raw) : { donePrompts: [], updatedAt: null };
      return res.status(200).json(saved);
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      const list = body && body.donePrompts;
      if (!Array.isArray(list)) return res.status(400).json({ error: 'donePrompts must be an array of ids' });
      const ids = [...new Set(list.filter((id) => typeof id === 'string' && /^q\d{3}$/.test(id)))].sort();
      const saved = { donePrompts: ids, updatedAt: new Date().toISOString() };
      await redis(['SET', KEY, JSON.stringify(saved)]);
      return res.status(200).json(saved);
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'store', message: String(e && e.message || e) });
  }
};
