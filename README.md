# KeyLion

Typing-speed site: tests, multiplayer race, leaderboard, AI coach, profile & achievements.
Static frontend in `keylion/`, backend = one Netlify Function (`netlify/functions/api.mjs`) on **Turso** (libSQL).

## Setup

1. **Turso**: `turso db create keylion` → `turso db show keylion --url` and `turso db tokens create keylion`.
   Tables are created automatically on the first request (`netlify/functions/schema.mjs`).
2. **Netlify → Site settings → Environment variables**

   | name | what |
   |---|---|
   | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | from step 1 |
   | `JWT_SECRET` | optional: long random string; if unset it is derived from the Turso token |
   | `GOOGLE_CLIENT_ID` | Google Cloud → OAuth client (Web); add your site URL under *Authorized JavaScript origins* |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | login for `/admin.html` |
   | `GROQ_API_KEY` | AI coach (Groq, optional `GROQ_MODEL`, default llama-3.3-70b-versatile) |

3. Netlify build settings come from `netlify.toml` (publish `keylion/`, functions `netlify/functions/`).
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
- *Settings* tab: 6 built-in vector backgrounds (`keylion/bg/`), own image upload (resized to ≤2560 px
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
- Ad images/videos uploaded in the admin panel go to Netlify Blobs (about 5 MB limit); larger files can still be linked by URL.
