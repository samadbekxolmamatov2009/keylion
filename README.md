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
   | `JWT_SECRET` | long random string (`openssl rand -hex 32`) |
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

## Notes
- Race rooms: clients poll `GET /api/rooms/:code` every ~700 ms.
- Ad images/videos uploaded in the admin panel go to Netlify Blobs (about 5 MB limit); larger files can still be linked by URL.
