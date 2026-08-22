// Minimal self-hosted sync backend for the MCA-DS Workspace dashboard.
// One endpoint pair: GET /api/data (pull) and POST /api/data (push).
// Storage: a single JSON file on disk (data.json). Auth: one shared secret token.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SYNC_TOKEN = process.env.SYNC_TOKEN; // required — set this before starting
const DATA_FILE = path.join(__dirname, 'data.json');

if (!SYNC_TOKEN) {
  console.error('FATAL: SYNC_TOKEN env var is not set. Set it before starting the server.');
  process.exit(1);
}

const app = express();
app.use(cors()); // allow requests from your phone/laptop browser regardless of origin
app.use(express.json({ limit: '2mb' }));

// --- storage helpers ---
function readStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    // No file yet, or corrupted — start empty.
    return { att: {}, exceptions: {}, tasks: [], notifications: [], updatedAt: 0 };
  }
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

// --- auth middleware ---
function requireToken(req, res, next) {
  const token = req.get('X-Sync-Token');
  if (!token || token !== SYNC_TOKEN) {
    return res.status(401).json({ error: 'Invalid or missing sync token' });
  }
  next();
}

// --- routes ---
app.get('/api/data', requireToken, (req, res) => {
  const store = readStore();
  res.json(store);
});

app.post('/api/data', requireToken, (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Body must be a JSON object' });
  }

  const current = readStore();

  // Last-write-wins, but guard against an older/stale client overwriting newer server data.
  const incomingTs = Number(incoming.updatedAt) || 0;
  if (incomingTs < current.updatedAt) {
    // Client is behind — tell it so it can pull instead of overwriting.
    return res.status(409).json({ error: 'stale', server: current });
  }

  const store = {
    att: incoming.att || {},
    exceptions: incoming.exceptions || {},
    tasks: incoming.tasks || [],
    notifications: incoming.notifications || [],
    updatedAt: Date.now()
  };
  writeStore(store);
  res.json(store);
});

app.get('/', (req, res) => {
  res.send('MCA-DS Workspace sync server is running.');
});

app.listen(PORT, () => {
  console.log(`Sync server listening on port ${PORT}`);
});
