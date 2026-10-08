# Keylion

Typing-speed site: tests, multiplayer race, leaderboard, AI coach, profile & achievements.
Static frontend in `public/`, backend = one API module (`netlify/functions/api.mjs`) on **Turso** (libSQL),
run either as a Netlify Function or by `server.mjs` on any Node.js host (Render, a VPS, locally).

## Deploy on Render (no Netlify needed)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/samadbekxolmamatov2009/keylion)

`server.mjs` serves the site and the API from one Node.js process; `render.yaml` describes the service.
1. Create the database first (Turso step 1 below) and keep its URL and token at hand.
2. Click the button (or Render → **New → Blueprint** → pick this repo; the button reads `render.yaml`
   from the default branch). Sign in with GitHub, fill in `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`JWT_SECRET` is generated), then **Apply**.
3. After ~3 minutes the site is at `https://tezlash-xxxx.onrender.com`; every push to the branch redeploys it.
4. Optional, under the service's **Environment** tab: `GROQ_API_KEY` (AI coach), `GOOGLE_CLIENT_ID`
   (also add the new site URL to the OAuth client's *Authorized JavaScript origins*).

The free plan sleeps after 15 minutes without visitors, so the first visit after a pause takes ~30–60 s.
Uploaded files (ads, backgrounds) are stored in the database, so nothing is lost on redeploys.
Run the same server locally with `npm install && npm start` (http://localhost:8888, variables from your shell).

## Setup (Netlify)

1. **Turso**: `turso db create tezlash` → `turso db show tezlash --url` and `turso db tokens create tezlash`.
   Tables are created automatically on the first request (`netlify/functions/schema.mjs`).
2. **Netlify → Site settings → Environment variables**

   | name | what |
   |---|---|
   | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | from step 1 |
   | `JWT_SECRET` | optional: long random string; if unset it is derived from the Turso token |
   | `GOOGLE_CLIENT_ID` | Google Cloud → OAuth client (Web); add your site URL under *Authorized JavaScript origins* |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | login for `/admin.html` |
   | `GROQ_API_KEY` | AI coach (Groq, optional `GROQ_MODEL`, default llama-3.3-70b-versatile) |

3. Netlify build settings come from `netlify.toml` (publish `public/`, functions `netlify/functions/`).
4. Local dev: `npm install && npx netlify dev` (put the variables in `.env`, see `.env.example`).

## Moving the data out of Firebase

```
npm install
export TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=...
# Firebase Console → Realtime Database → ⋮ → Export JSON  → firebase-export.json
# optional, keeps e-mail/password logins working:
#   firebase auth:export auth-export.json --format=json --project <project>
#   hash-config.json = {"memCost":14,"rounds":8,"saltSeparator":"<base64>","signerKey":"<base64>"}
#   (Firebase Console → Authentication → Users → ⋮ → Password hash parameters)
npm run migrate -- firebase-export.json auth-export.json hash-config.json
```

Google users are matched by verified e-mail, so they can log in again right away. Phone (SMS) login was removed (needs an SMS provider).

## Leaderboard & anti-cheat
- One row per player (best result in the chosen period / mode / language), current name, tier badge.
  Guests, race results and results under 90 % accuracy are not ranked.
- The browser sends raw counts (correct / typed characters, duration), a server-signed start stamp
  (`POST /api/tests/start`) and a summary of the key-press rhythm. The server recomputes wpm/accuracy and
  flags results that are faster than 220 wpm, finished faster than the server clock allows, don't match
  their raw counts or have a robot-like rhythm. Flagged results stay off the leaderboard until approved in
  the admin panel (*Moderatsiya*). This stops edited requests and console tricks; a determined scripted
  cheater can still look human, which is what the moderation tools are for.
- Tiers (Bronze → Master, steps I–III) use the average wpm of the player's last 10 tests.
- Daily challenge: everyone gets the same 30 words per day and language (Tashkent date).

## Profiles & settings
- `#/profile` (own) and `#/u/<id>` (public, shareable): rank, tier, stats, wpm/accuracy chart,
  activity heatmap, records by mode, achievement progress, PNG result card, Telegram share.
- *Settings* tab: 6 built-in vector backgrounds (`public/bg/`), own image upload (resized to ≤2560 px
  WebP in the browser, stored in Netlify Blobs, 3 per player), dim / blur / glass panels, accent colour,
  caret style, letter and mistake animations, end-of-test effects, key sounds, public/private profile.
  Saved per device and synced to the account.

## Admin panel (`/admin.html`)
Dashboard (online now, today's tests and sign-ups, 30-day chart), user search with ban / rename /
hide scores, moderation queue for flagged results, ad view/click stats, and an audit log of admin actions.

## Notes
- Race rooms: clients poll `GET /api/rooms/:code` every ~700 ms.
- Rate limits live in the database (`rate_limits` table), so they hold across function instances.
- Schema changes are applied once per schema version on a cold start (`netlify/functions/schema.mjs`).
- Setting `JWT_SECRET` is recommended: without it, rotating the Turso token signs everyone out.
- Ad images/videos uploaded in the admin panel are stored in the database (`media` tables, ~5 MB per file);
  larger files can still be linked by URL. Files uploaded earlier to Netlify Blobs are still served on Netlify.
