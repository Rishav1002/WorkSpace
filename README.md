# MCA-DS Workspace — Sync Server

Tiny self-hosted backend so your dashboard's data (attendance, tasks,
exceptions, notifications) syncs between your phone and laptop. One
JSON file on disk, one shared secret token, two endpoints.

## 1. Deploy to Render (free tier)

1. Push this `sync-server` folder to a **new GitHub repo** (can be private).
2. Go to https://render.com → sign in with GitHub → **New +** → **Web Service**.
3. Pick your repo. Render should auto-detect Node.
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add an environment variable:
   - `SYNC_TOKEN` = any long random string you make up (this is your password —
     treat it like one). Example: use a password generator, 32+ characters.
5. Deploy. Render gives you a URL like `https://your-app.onrender.com`.
6. **Test it's alive:** open that URL in a browser — you should see
   "MCA-DS Workspace sync server is running."

Free tier note: the service sleeps after ~15 min of no requests and takes a
few seconds to wake on the next request. Not a problem for this use case.

## 2. Point your dashboard at it

Open `Routine.html` on any device (phone or laptop), tap the new cloud icon
in the header (next to the theme toggle), and enter:

- **Sync server URL:** `https://your-app.onrender.com`
- **Sync token:** the exact `SYNC_TOKEN` value you set in step 4 above

Do this on **both devices**, using the same URL and token. That's it —
every change now pushes to the server (debounced ~1.5s after you stop
editing) and pulls automatically on page load.

## 3. How it behaves

- **Icon states:** grey cloud = idle/off, spinning = syncing, red triangle =
  couldn't reach the server right now (offline, or server asleep — it'll
  retry on your next edit or page load). Your local data is never lost;
  it just syncs whenever the server's reachable again.
- **Conflict handling:** last-write-wins by timestamp. If two devices edit
  while both offline from each other, whichever syncs *with the newer
  timestamp* wins; the server rejects an older push (409) and the client
  pulls the newer version instead of overwriting it.
- **Where your data lives:** a single `data.json` file next to `server.js`
  on Render's disk. Render's free tier disk is ephemeral (wiped on
  redeploys), so this is a sync layer, not a guaranteed permanent backup —
  see note below if you want that upgraded later.

## 4. Security notes

- Anyone with your `SYNC_TOKEN` can read/write your data. Don't commit the
  real token to a public repo — only set it as an environment variable on
  Render.
- Traffic is HTTPS by default on Render, so the token isn't sent in
  plaintext over the network.

## 5. Local testing (optional)

```bash
npm install
SYNC_TOKEN=test123 npm start
# then in another terminal:
curl -H "X-Sync-Token: test123" http://localhost:3000/api/data
```

## Future upgrade path

If you outgrow the JSON-file approach (e.g. want real backups, or the free
disk resetting bothers you), swap `readStore`/`writeStore` in `server.js`
for a proper database (SQLite file with a persistent Render disk add-on,
or a free-tier Postgres) — the API surface (`GET`/`POST /api/data`) stays
identical, so the dashboard side needs zero changes.
