Build: SRNCloud AFK Manager

1. Product Overview

Build a polished, production-quality application called SRNCloud AFK Manager.

The application is a personal automation and monitoring client for a user's SRNCloud hosting account.

The primary goal is to allow the user to keep an authorized SRNCloud browser session running continuously, monitor the account/server state, recover from ordinary connection/browser failures, and notify the user when manual interaction is required.

The application must NOT attempt to bypass Cloudflare, CAPTCHA, bot detection, authentication protections, rate limits, or other security mechanisms.

If SRNCloud presents a Cloudflare/CAPTCHA/security challenge, pause automation and clearly notify the user that manual verification is required.

---

2. Important Rules

The implementation MUST follow these rules:

Allowed

- Persistent browser sessions
- Normal browser automation
- Session monitoring
- Session recovery
- Browser crash recovery
- Network recovery
- Monitoring account information visible to the authenticated user
- Monitoring server status
- Authorized API calls if an official/authorized API is available
- Normal page interaction
- User-configured scheduled actions
- Notifications
- Dashboard analytics
- Local encrypted credential/session storage

Prohibited

Do NOT implement:

- Cloudflare bypass
- CAPTCHA solving
- CAPTCHA bypass
- Fingerprint spoofing designed to defeat bot detection
- TLS/browser fingerprint manipulation designed to evade detection
- Proxy rotation for evading anti-bot systems
- IP rotation to evade limits
- Fake mouse/keyboard behavior specifically designed to fool anti-bot systems
- Undetectable automation
- Credential theft
- Session-cookie extraction from unrelated browsers
- Rate-limit bypass
- Authentication bypass
- Security challenge bypass

The application should behave like an ordinary authorized browser session.

---

3. Recommended Architecture

Use a modular architecture.

                    ┌─────────────────────┐
                    │    Web Dashboard    │
                    │   React / Next.js   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Backend API       │
                    │ Node.js / TypeScript│
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
      Session Manager    Automation Engine   Monitoring
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Browser Controller  │
                    │      Playwright     │
                    └──────────┬──────────┘
                               │
                               ▼
                     SRNCloud website

If SRNCloud exposes an authorized API, create an API adapter and prefer API operations over browser automation.

SRNCloud API
     ↑
API Adapter
     ↑
Automation Service

The browser automation layer should remain available for functionality that is only exposed through the web interface.

---

4. Technology Stack

Preferred stack:

Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui or another high-quality component system
- Lucide icons
- Recharts for analytics

Backend

- Node.js
- TypeScript
- Fastify or Express
- WebSocket support
- Zod validation

Automation

- Playwright
- Chromium

Database

Prefer:

- SQLite for single-user/local deployment

Structure the application so PostgreSQL can be added later.

Security

- AES-256-GCM encrypted secrets
- Environment-based encryption key
- Never log passwords
- Never log cookies
- Never expose authentication tokens to frontend JavaScript
- Secure HTTP-only cookies where applicable

---

5. User Experience

The UI should look like a premium modern SaaS dashboard.

Do NOT make it look like a generic admin template.

Design characteristics:

- Dark-first interface
- Glass/soft-card design
- Subtle gradients
- Clean typography
- Smooth animations
- Professional spacing
- Responsive mobile layout
- Desktop dashboard
- Real-time status indicators
- Minimal unnecessary decoration

Suggested visual style:

Premium
Modern
Dark
Technical
Clean
Infrastructure/SaaS

Avoid excessive neon effects.

---

6. Main Dashboard

Create a dashboard containing:

Account Card

Display:

- Account status
- Connection status
- Session age
- Last successful synchronization
- Last activity
- Login state

Example:

SRNCloud Account

● Connected

Session
14h 32m

Last Sync
12 seconds ago

---

7. AFK Manager

Create a dedicated AFK Manager page.

Example:

AFK Manager

Status
● RUNNING

Started
08 Oct 2026 05:32 PM

Runtime
03h 41m

Last Check
12 sec ago

Browser
● Healthy

Connection
● Healthy

[ STOP AUTOMATION ]

Controls:

- Start
- Stop
- Pause
- Resume
- Restart browser
- Reconnect session

---

8. Automation State Machine

Implement a proper state machine.

States:

IDLE
STARTING
AUTHENTICATING
CONNECTED
RUNNING
PAUSED
CHALLENGE_REQUIRED
NETWORK_ERROR
SESSION_EXPIRED
BROWSER_ERROR
STOPPING
STOPPED
ERROR

Example:

STARTING
   ↓
AUTHENTICATING
   ↓
CONNECTED
   ↓
RUNNING

If a security challenge appears:

RUNNING
   ↓
CHALLENGE_REQUIRED
   ↓
PAUSED

The application must NOT attempt to solve or bypass the challenge.

---

9. Session Persistence

The most important technical feature is persistent authorized sessions.

Use Playwright persistent browser context where appropriate.

Store session state securely.

Requirements:

- Session survives application restart when technically possible
- Browser restart attempts to reuse the authorized session
- Detect expired sessions
- Detect logout
- Notify user
- Never silently ask for credentials through unsafe logs

Example:

Application starts
        ↓
Load encrypted session
        ↓
Launch browser
        ↓
Open SRNCloud
        ↓
Check authentication
        ↓
Authenticated?
   ┌────┴────┐
   YES       NO
   ↓          ↓
RUNNING    LOGIN_REQUIRED

---

10. Login System

Support:

Method A — Normal login

User enters:

- SRNCloud username/email
- Password

Credentials must be encrypted at rest.

Method B — Existing authorized session

Allow the user to authenticate normally through the controlled browser.

Do not scrape unrelated browser profiles.

Do not request raw cookies from the user.

Do not store plaintext passwords.

---

11. Browser Controller

Create a dedicated BrowserController service.

Responsibilities:

launch()
close()
restart()
navigate()
isHealthy()
isAuthenticated()
detectChallenge()
detectLogout()
recover()

The controller must:

- Detect browser crashes
- Detect page crashes
- Detect navigation errors
- Detect network failures
- Retry normal transient failures
- Avoid aggressive retry loops

Implement exponential backoff.

Example:

Attempt 1 → 2 seconds
Attempt 2 → 5 seconds
Attempt 3 → 15 seconds
Attempt 4 → 30 seconds
Attempt 5 → pause + notify user

---

12. SRNCloud Adapter

Create:

SRNCloudAdapter

Do not hard-code assumptions about undocumented endpoints.

First determine what information and actions are actually available.

Possible adapter methods:

getAccount()
getBalance()
getServers()
getServerStatus(serverId)
getServerResources(serverId)
getSessionStatus()

Only implement methods that are actually supported by the website/API.

If an API is unavailable, use the normal authenticated website where appropriate.

Keep SRNCloud-specific selectors and endpoints isolated in one module.

---

13. Server Monitoring

Display the user's servers.

For each server:

Server Name
Status
CPU
RAM
Disk
Players
Uptime
Last Check

Example:

Survival SMP

● ONLINE

CPU       18%
RAM       2.4 / 4 GB
Disk      12 / 30 GB
Players   3 / 20
Uptime    18h 32m

Do not invent metrics that SRNCloud does not expose.

If a metric is unavailable, display:

Unavailable

instead of fake data.

---

14. Coin / Reward Tracking

If the authenticated SRNCloud account exposes a coin/reward balance, display it.

Example:

Coins

12,450

+350 today

Track historical observations locally:

timestamp
balance
change
source

Create charts:

- Current balance
- Daily change
- Weekly change
- Historical balance

Important:

The application should only report what SRNCloud actually provides.

Do not manufacture earnings.

---

15. Resource Tracking

If SRNCloud exposes resource allocation/redeem information, display:

RAM
CPU
Disk
Coins

Example:

Available Resources

RAM
8 GB

CPU
250%

Disk
40 GB

If the platform supports authorized redemption through an API or normal UI, create a separate Resource Management page.

Never automatically redeem resources unless the user explicitly enables that feature.

---

16. Automation Scheduler

Create a scheduler.

Allow users to configure permitted tasks.

Example:

Scheduler

Session Check
Every 60 seconds

Server Status
Every 30 seconds

Account Sync
Every 5 minutes

Daily Report
Every day at 10:00 PM

Do NOT use randomized human-like behavior to defeat bot detection.

Normal health-check scheduling is sufficient.

---

17. Health Monitoring

Create a health monitor.

Monitor:

Browser
Network
SRNCloud
Authentication
Session
Automation

Example:

System Health

Browser       ● Healthy
Network       ● Healthy
SRNCloud      ● Healthy
Session       ● Healthy
Automation    ● Running

---

18. Recovery Engine

Implement automatic recovery for ordinary failures.

Browser crash

Detect crash
↓
Save state
↓
Restart browser
↓
Restore session
↓
Verify authentication
↓
Resume

Network failure

Network failure
↓
Wait
↓
Retry
↓
Verify connection
↓
Resume

Session expired

Session expired
↓
Pause
↓
Notify user
↓
Request normal login

Security challenge

Challenge detected
↓
PAUSE
↓
Notify user
↓
Wait for manual completion
↓
Verify page
↓
Resume

Never attempt to bypass the challenge.

---

19. Notifications

Support:

- Browser notification
- In-app notification
- Optional Telegram/Discord webhook later

Notify for:

Session expired
Security challenge
Browser crashed
Network failure
Automation stopped
SRNCloud unavailable
Server offline
Successful recovery

---

20. Logs

Create a professional log viewer.

Example:

20:41:32  INFO   Browser healthy
20:41:40  INFO   SRNCloud session verified
20:42:12  INFO   Server status synchronized
20:44:03  WARN   Network request failed
20:44:08  INFO   Retry successful

Log levels:

DEBUG
INFO
WARN
ERROR

Never log:

- Passwords
- Authentication cookies
- API keys
- Session tokens
- Authorization headers

---

21. Activity Timeline

Create an activity timeline.

Example:

Today

20:44
Connection recovered

20:42
Server status synchronized

20:41
Session verified

20:38
Automation started

---

22. Settings

Create:

Account

- Account status
- Re-authenticate
- Disconnect

Automation

- Auto-start
- Health-check interval
- Retry count
- Retry delay
- Browser restart behavior

Notifications

- Browser notifications
- Webhook notifications

Security

- Encryption status
- Clear local session
- Logout

Appearance

- Dark
- Light
- System

---

23. Auto Start

Allow:

Start automation automatically when application launches

Flow:

Application starts
↓
Load session
↓
Verify SRNCloud
↓
Check authentication
↓
Start monitoring

If authentication is unavailable:

LOGIN_REQUIRED

Do not repeatedly spam login requests.

---

24. Multi-Account Architecture

Build the internal architecture so multiple accounts can be supported later.

Example:

Accounts

SRNCloud Account #1
● Running

SRNCloud Account #2
○ Stopped

SRNCloud Account #3
⚠ Login Required

However, initially keep the UI optimized for one account.

Do not build unnecessary complexity into the first version.

---

25. Security Architecture

Use:

Frontend
   ↓
Backend
   ↓
Encrypted Secret Store
   ↓
Automation Worker

The frontend should never directly receive sensitive authentication credentials.

Use environment variables for master encryption keys.

Implement:

- Input validation
- CSRF protection where relevant
- Rate limiting for the local API
- Secure headers
- Strict CORS
- Authentication for dashboard access
- Automatic logout/session timeout

---

26. Deployment

Support two modes.

Local

Windows
Linux
macOS

VPS

Ubuntu VPS
↓
Node.js
↓
Playwright
↓
SRNCloud Manager

Provide:

Dockerfile
docker-compose.yml
.env.example
README.md

The Docker configuration should include the browser dependencies required by Playwright.

---

27. Docker Architecture

Use:

srncloud-manager
├── frontend
├── backend
├── automation-worker
└── database

For the initial MVP, these may run in one container/process if that simplifies deployment.

Keep the code modular so workers can be separated later.

---

28. API

Create internal REST endpoints such as:

GET    /api/status
GET    /api/account
GET    /api/servers
GET    /api/servers/:id
GET    /api/automation
POST   /api/automation/start
POST   /api/automation/stop
POST   /api/automation/pause
POST   /api/automation/resume
POST   /api/browser/restart
POST   /api/session/reconnect
GET    /api/logs
GET    /api/activity
GET    /api/settings
PUT    /api/settings

Add WebSocket support for real-time dashboard updates.

---

29. Real-Time Dashboard

The dashboard should update without refreshing.

For example:

Automation:
RUNNING

Browser:
HEALTHY

Session:
CONNECTED

Last synchronization:
3 seconds ago

Use WebSocket events such as:

automation.status
session.status
browser.status
server.status
account.updated
notification.created
log.created

---

30. Error Handling

Every external operation must have robust error handling.

Never crash the entire application because SRNCloud is temporarily unavailable.

Use:

try/catch
timeouts
retries
exponential backoff
circuit breaker where appropriate

Display useful messages:

SRNCloud is temporarily unavailable.
The manager will retry automatically.

---

31. Challenge Detection

Implement detection only.

Possible indicators:

- CAPTCHA page
- Cloudflare challenge page
- Browser verification page
- Authentication challenge
- Unexpected security page

When detected:

Automation = PAUSED
Reason = MANUAL_VERIFICATION_REQUIRED

Show:

Manual verification required

SRNCloud/Cloudflare is requesting verification.

Complete the verification in the browser.
Automation will resume after verification.

[ OPEN BROWSER ]

Do not automate solving the challenge.

---

32. Resource Efficiency

The application should be lightweight.

Avoid:

- Infinite polling
- Excessive page reloads
- High CPU usage
- Multiple unnecessary browser instances
- Memory leaks

Use:

- Event-driven updates
- Controlled polling
- Browser reuse
- Proper cleanup
- Request throttling
- Backoff

---

33. Database Schema

Create tables similar to:

accounts
sessions
servers
resource_snapshots
coin_snapshots
automation_runs
activity_logs
system_logs
notifications
settings

Example:

accounts
---------
id
provider
display_name
encrypted_credentials
created_at
updated_at

coin_snapshots
--------------
id
account_id
balance
timestamp

automation_runs
---------------
id
account_id
started_at
ended_at
status
reason

---

34. Dashboard Pages

Create:

/
Dashboard

/automation
AFK Manager

/servers
Servers

/servers/:id
Server Details

/rewards
Coins & Rewards

/activity
Activity

/logs
Logs

/settings
Settings

---

35. Landing / Login Screen

Create a premium login screen.

Example:

SRNCloud
AFK Manager

Manage your authorized SRNCloud session
from one place.

[ Connect Account ]

Do not imply that the application bypasses Cloudflare or allows cheating.

---

36. Mobile Responsiveness

The dashboard must work extremely well on Android phones.

Important:

- Bottom navigation on mobile
- Responsive cards
- Touch-friendly controls
- No tiny buttons
- Responsive charts
- Swipe-friendly server cards
- Real-time status

Desktop should have sidebar navigation.

Mobile:

Dashboard
Automation
Servers
Activity
Settings

---

37. Important Implementation Strategy

Do NOT immediately hard-code fake SRNCloud APIs.

First create an adapter abstraction:

interface HostingProviderAdapter {
    login(): Promise<void>;
    isAuthenticated(): Promise<boolean>;
    getAccount(): Promise<Account>;
    getServers(): Promise<Server[]>;
    getServerStatus(id: string): Promise<ServerStatus>;
    getRewards?(): Promise<Rewards>;
}

Then implement:

class SRNCloudAdapter implements HostingProviderAdapter

Only populate methods after determining what the real SRNCloud application actually exposes.

If no public/authorized API exists, use Playwright for normal authenticated page interaction.

Keep all SRNCloud-specific selectors inside:

src/providers/srncloud/

so they can be updated without rewriting the whole application.

---

38. Testing

Create automated tests for:

Unit tests

- State machine
- Retry system
- Encryption
- Scheduler
- Data parsing

Integration tests

- Browser startup
- Session restoration
- Session expiration
- Network failure
- Browser crash
- Challenge detection

UI tests

- Dashboard
- Start/stop automation
- Logs
- Settings
- Mobile layout

Do not use a real SRNCloud account in automated tests.

Create a mock provider.

---

39. Mock SRNCloud Provider

Create:

MockHostingProvider

It should simulate:

Connected
Disconnected
Session expired
Server online
Server offline
Network failure
Security challenge
Browser crash

This allows development without repeatedly accessing the real service.

---

40. Developer Experience

Provide:

README.md
.env.example
Dockerfile
docker-compose.yml
package.json
database migrations
test configuration

README must explain:

1. Installation
2. Development
3. Production
4. Docker deployment
5. Environment variables
6. Browser dependencies
7. Security
8. Connecting SRNCloud
9. Troubleshooting
10. Limitations

---

41. Environment Variables

Example:

NODE_ENV=production
PORT=3000
DATABASE_URL=
ENCRYPTION_KEY=
SESSION_SECRET=

Never place actual credentials in ".env.example".

---

42. Code Quality

Requirements:

- TypeScript strict mode
- Modular architecture
- No giant files
- No duplicated business logic
- Clear naming
- Proper interfaces
- Error classes
- Structured logging
- Environment validation
- Secure defaults

Do not generate placeholder functions and claim they work.

If SRNCloud functionality cannot be verified, mark it clearly as:

TODO — requires SRNCloud integration verification

---

43. What NOT to Do

Do NOT:

- Fake coin balances
- Fake server status
- Fake uptime
- Pretend API integration exists
- Invent SRNCloud endpoints
- Bypass Cloudflare
- Solve CAPTCHAs
- Circumvent security challenges
- Use stealth plugins specifically to defeat anti-bot detection
- Rotate proxies to avoid detection
- Create fake human behavior to fool anti-bot systems
- Automatically create accounts
- Spam SRNCloud endpoints
- Abuse the service

---

44. MVP Priority

Build in this order.

Phase 1

Core application:

- Dashboard
- Authentication
- Browser manager
- Session persistence
- Automation state machine
- Logs
- Settings

Phase 2

Monitoring:

- Account
- Servers
- Server status
- Health monitor
- Recovery system

Phase 3

Rewards:

- Coin tracking
- Historical charts
- Resource tracking

Phase 4

Reliability:

- Auto restart
- Network recovery
- Browser recovery
- Notifications
- Docker deployment

Phase 5

Polish:

- Premium UI
- Animations
- Mobile optimization
- Analytics
- Better error handling

---

45. Final Acceptance Criteria

The project is considered complete when:

1. The application starts successfully.
2. The dashboard loads.
3. A user can connect an authorized SRNCloud account through the normal login flow.
4. The application can maintain a legitimate browser session.
5. The session survives normal application/browser restarts when technically possible.
6. The application detects logout/session expiration.
7. The application detects browser crashes.
8. The application recovers from ordinary transient network failures.
9. The application can monitor available SRNCloud server information.
10. The application records account/coin observations when actually available.
11. The dashboard updates in real time.
12. Logs are available.
13. Manual security challenges pause automation rather than being bypassed.
14. Credentials and session information are protected.
15. The application works on mobile and desktop.
16. Docker deployment works.
17. Mock-provider tests pass.
18. No fake SRNCloud APIs or fake data are presented as real.
19. The codebase is modular enough to adapt if SRNCloud changes its website.
20. The final README explains exactly what is supported and what requires manual interaction.

---

46. Builder Instruction

You are the implementation agent.

Do not simply create a UI mockup.

Build the actual application with:

- working backend
- working database
- working browser controller
- working state machine
- working session management
- working monitoring
- working logs
- working recovery
- working dashboard
- working Docker configuration
- working tests

Before implementing SRNCloud-specific functionality, inspect the available public/authorized interfaces and isolate all provider-specific logic behind "SRNCloudAdapter".

If an integration detail cannot be verified, do not invent it.

Build the application so that replacing or updating the SRNCloud adapter later does not require rewriting the core system.

The finished product should feel like a professional infrastructure automation product, not a simple browser script.
