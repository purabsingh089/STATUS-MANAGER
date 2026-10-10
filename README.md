# SRNCloud AFK Manager

Personal automation and monitoring client for an authorized SRNCloud hosting account.

This application keeps a legitimate browser session alive, monitors account and server state that the authenticated user can already see, recovers from ordinary browser/network failures, and pauses when Cloudflare, CAPTCHA, or other security challenges appear.

It does **not** bypass Cloudflare, solve CAPTCHAs, spoof fingerprints, rotate proxies, or otherwise evade security controls.

## What this is

- Persistent authorized session manager
- Health monitoring and recovery for crashes and transient network errors
- Dashboard for account, servers, coins, logs, and activity
- Local AES-256-GCM encrypted credential storage

## What this is not

- Not a Cloudflare / CAPTCHA bypass
- Not undetectable automation
- Not an unofficial SRNCloud API client (no public API was verified)
- Not a source of invented coin balances or server metrics

## Architecture

```
Web Dashboard (Next.js :3000)
        |
        |  /api  reverse proxy
        v
Backend API (Fastify :3001)
        |
  Session / Automation / Monitoring
        |
Browser Controller (Playwright, optional)
        |
   SRNCloud website  — or MockHostingProvider
```

Default development mode uses `PROVIDER=mock` so the dashboard works without a real SRNCloud account.

## 1. Installation

Requirements:

- Node.js 20+
- npm 10+

```bash
git clone <this-repo>
cd srncloud-afk-manager
cp .env.example .env
npm install
```

Generate secrets (do not commit them):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the values in `.env`:

```
ENCRYPTION_KEY=<64 hex chars>
SESSION_SECRET=<64 hex chars>
```

## 2. Development

```bash
npm run dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001

The Next.js dev server proxies `/api` to the backend.

Alternatively:

```bash
chmod +x start.sh
./start.sh
```

## 3. Production

```bash
npm run build
NODE_ENV=production PORT=3001 npm start
```

Serve the frontend (`frontend` `next start` on port 3000) in front of the API, or copy `frontend/out` if you export a static build later.

## 4. Docker deployment

```bash
docker compose up --build
```

The compose file starts the API and a Chromium-capable image. Playwright browser dependencies are included.

## 5. Environment variables

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend listen port (default 3001) |
| `FRONTEND_ORIGIN` | CORS origin for the dashboard |
| `DATABASE_PATH` | SQLite file |
| `ENCRYPTION_KEY` | 32-byte key (64 hex chars) for AES-256-GCM |
| `SESSION_SECRET` | Dashboard cookie signing material |
| `DASHBOARD_PASSWORD` | Optional gate for the local dashboard |
| `PROVIDER` | `mock` (default) or `srncloud` |
| `SRNCLOUD_BASE_URL` | Website origin if using the real adapter |
| `PLAYWRIGHT_ENABLED` | `true` to launch Chromium |
| `PLAYWRIGHT_HEADLESS` | Headless Chromium |
| `BROWSER_USER_DATA_DIR` | Persistent Playwright profile |
| `AUTO_START` | Start monitoring on boot |
| `WEBHOOK_URL` | Optional Discord/Telegram-style webhook |

Never put real passwords in `.env.example`.

## 6. Browser dependencies

Playwright Chromium is only required when `PLAYWRIGHT_ENABLED=true`.

```bash
npx playwright install chromium
npx playwright install-deps chromium
```

On Docker this is handled in the image.

## 7. Security

- Credentials are encrypted at rest with AES-256-GCM
- Passwords, cookies, tokens, and Authorization headers are redacted from logs
- Dashboard cookies are HTTP-only
- Frontend never receives raw SRNCloud cookies or passwords after submit
- Rate limiting and Helmet headers are enabled on the local API

If Cloudflare or a CAPTCHA appears, automation enters `CHALLENGE_REQUIRED` and waits for you.

## 8. Connecting SRNCloud

1. Open the dashboard and go to Login or Settings.
2. Enter the username/email and password for **your** account.
3. Or leave Playwright enabled and sign in inside the controlled browser.
4. Start AFK Manager.

With `PROVIDER=mock`, any non-empty username/password simulates a successful authorized session.

With `PROVIDER=srncloud`, the adapter opens the website through Playwright. Selectors for servers, coins, and resources are **not verified** against the live product. Those panels will show `Unavailable` until you update `backend/src/providers/srncloud/`.

## 9. Troubleshooting

| Symptom | What to do |
| --- | --- |
| Dashboard cannot reach API | Confirm backend is on 3001 and `/api` proxy is working |
| `LOGIN_FORM_NOT_FOUND` | SRNCloud markup changed; update selectors, or sign in manually in the controlled browser |
| `CHALLENGE_REQUIRED` | Complete the challenge yourself. Do not expect auto-solve |
| Browser will not start | Install Playwright Chromium, or keep `PLAYWRIGHT_ENABLED=false` and use mock |
| Empty server/coin cards | Expected when the live site does not expose those fields to the adapter |

## 10. Limitations

- No official SRNCloud HTTP API was confirmed. The real adapter is browser-session based.
- Server, coin, and resource scraping selectors are placeholders pending verification.
- Multi-account UI is architected (account_id on tables) but the first version is single-account.
- Challenge pages are detected, never solved.
- Do not point this at accounts you do not own.

## Tests

```bash
npm test
```

Tests use `MockHostingProvider` only. They never log into a real SRNCloud account.

## Project layout

```
backend/   Fastify API, SQLite, automation, Playwright
frontend/  Next.js dashboard
data/      SQLite + persistent browser profile (gitignored)
```

## License

Private / personal use. Respect SRNCloud terms of service.
