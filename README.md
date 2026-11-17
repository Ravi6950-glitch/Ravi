<div align="center">

# Chorus

### Every platform. One voice.

**A self-hosted social media command centre.** Connect 46 networks, write once and let
Chorus reshape it for each one, schedule everything from a single queue, and let AI
agents watch your performance around the clock.

</div>

---

## What it is

Chorus is a complete, working alternative to Buffer that you run yourself. It is not a
mock-up: posts really publish, analytics really accumulate, and the AI agents really run
on a schedule in the background.

| | |
|---|---|
| **46 networks** | Instagram, X, LinkedIn, TikTok, YouTube, Threads, Bluesky, Mastodon, Pinterest, Reddit, Discord, Slack, Telegram, WhatsApp Business, Snapchat, Tumblr, Medium, Ghost, WordPress, DEV, Hashnode, Substack, Behance, Dribbble, Flickr, SoundCloud, Spotify for Creators, Google Business Profile, Twitch, Vimeo, Rumble, Quora, Nextdoor, LINE, KakaoTalk, Weibo, Douyin, Xiaohongshu, Kuaishou, Bilibili, Zhihu, VK, Naver Blog, Lemon8, Truth Social, Facebook Pages |
| **One composer** | Write once, tailor per platform. Live per-network validation of character limits, hashtag counts, media rules and required fields — before you can publish. |
| **A real queue** | Buffer-style weekly posting slots. Drop a post in and it drains into the next free slot. Plus a month calendar and full scheduling. |
| **7 AI agents** | Composer, Hashtag Strategist, Timing Oracle, Performance Analyst, Profile Auditor, Trend Scout, Queue Optimizer. |
| **Background automation** | An in-process worker publishes due posts, refreshes analytics and runs the agents on their own schedules. No cron, no extra service. |
| **Teams** | Workspaces with five roles, invites, and an activity log. Permissions are enforced server-side. |

---

## Quick start

```bash
git clone <this-repo> chorus && cd chorus
cp .env.example .env

# Generate a signing/encryption secret and put it in .env as AUTH_SECRET
openssl rand -base64 48

npm run setup     # install, generate the client, create the database, seed demo data
npm run dev       # http://localhost:3000
```

Sign in with the seeded demo account:

```
email:    demo@chorus.app
password: chorus-demo-2026
```

The demo workspace arrives with 12 connected accounts, 60 days of analytics history,
published and queued posts, a team of five and the agents already scheduled. Within a
minute of the server starting, the background worker runs its first agents and the
Insights page fills up on its own.

To start from nothing instead, skip the seed and create your own workspace at `/signup`.

**Requirements:** Node.js 20+. Nothing else — the database is SQLite and the AI agents
work with no API key.

---

## How publishing actually works

This is the part most clones gloss over, so to be explicit about what is real:

### Tier 1 — live, no developer app needed

These networks need only a token or app password **you** create, so Chorus ships complete,
working publishers for them. Connect one and your posts genuinely go out:

| Network | What you need |
|---|---|
| **Mastodon** | Instance URL + access token (Preferences → Development) |
| **Bluesky** | Handle + app password (Settings → App passwords) |
| **Telegram** | Bot token from `@BotFather` + channel ID |
| **Discord** | A channel webhook URL |
| **Slack** | An incoming webhook URL |
| **DEV Community** | An API key from your settings |
| **Truth Social** | Instance URL + token (Mastodon-compatible) |

### Tier 2 — live, developer app required

X, LinkedIn and Reddit have full publishers implemented, and Instagram, Facebook, Threads,
TikTok, YouTube, Pinterest, Tumblr, Twitch, Snapchat and Google Business Profile have their
OAuth flows configured. These platforms require a reviewed developer app — that is their
rule, not a limitation of Chorus. Add the client id and secret to `.env` and the
"Authorise with …" button appears on the Connections page.

### Tier 3 — sandbox

**Every** network can be connected in sandbox mode. Sandbox posts run through exactly the
same path — validation, scheduling, the queue, the worker, analytics — but are not sent to
the network. They are labelled as sandbox everywhere they appear. This is what makes the
product usable on day one, before a single developer app is approved.

> **On analytics honesty:** live accounts report figures from each platform's own API.
> Sandbox accounts have their engagement **modelled** from the post's real characteristics
> (length fit, media, platform norms, cadence) so the charts and agents have something
> coherent to work with. The UI says so on the analytics page, and sandbox accounts are
> badged throughout. Nothing modelled is ever presented as real network data.

---

## The AI agents

Seven agents, each with a defined job and a typed output contract.

| Agent | What it does | Runs |
|---|---|---|
| **Composer** | Turns one idea into copy for each selected platform — right length, right hashtag count, threads where supported. | On demand |
| **Hashtag Strategist** | Builds tag and keyword sets per platform, balancing reach against competition. | On demand |
| **Timing Oracle** | Learns each account's best posting hours from its own engagement history and writes a heatmap. | Every 6h |
| **Performance Analyst** | Compares this period against the last, separates distribution problems from content problems, writes the insight feed. | Every 12h |
| **Profile Auditor** | Scores every connected profile out of 100 on bio, avatar, cadence, engagement and token health, with specific fixes. | Daily |
| **Trend Scout** | Turns what has worked on your own accounts into concrete content ideas. | Every 12h |
| **Queue Optimizer** | Finds clashes, gaps and overloaded days, and proposes better slots. Never moves anything without your click. | Every 8h |

### Two engines, one contract

Every agent has **two complete implementations**:

- **Heuristic** (default) — real, deterministic logic that reads your actual workspace
  data. No API key, no network. This is not a placeholder: the Profile Auditor genuinely
  grades your profiles, the Timing Oracle genuinely computes heatmaps from engagement
  history, the Performance Analyst genuinely finds and explains what moved.
- **Claude** — set `ANTHROPIC_API_KEY` and the same agents run on Claude with structured
  outputs (`claude-opus-5-5` by default), giving markedly better copywriting and sharper
  analysis.

Both produce the identical shape, so nothing downstream knows or cares which ran. If Claude
is configured but fails for any reason, the agent falls back to the heuristic engine,
returns a usable result, and records the reason on the run — a broken key never leaves you
with nothing. Every run is logged with its engine, duration and token count on the Agents
page.

```bash
ANTHROPIC_API_KEY="sk-ant-..."
CHORUS_AI_MODEL="claude-opus-5-5"   # optional
CHORUS_AI_EFFORT="medium"           # low | medium | high | xhigh | max
```

---

## Architecture

```
src/
├── app/
│   ├── (auth)/              login, signup
│   ├── (app)/               dashboard, composer, calendar, queue, analytics,
│   │                        accounts, agents, insights, team, settings
│   │   └── actions.ts       every mutation, each with its own permission check
│   ├── api/
│   │   ├── connect/[platform]/{start,callback}   OAuth, with state verification
│   │   └── health                                 operational status
│   └── invite/[token]       accepting a team invite
├── components/              design system, SVG charts, sidebar
└── lib/
    ├── platforms/
    │   ├── registry.ts      46 networks: limits, capabilities, auth, options
    │   ├── adapters.ts      live publishers + the sandbox simulator
    │   ├── oauth.ts         per-provider OAuth 2.0 config and token exchange
    │   └── validate.ts      per-platform validation and thread splitting
    ├── agents/
    │   ├── registry.ts      the seven agents
    │   ├── schemas.ts       Zod output contracts
    │   ├── heuristics.ts    the deterministic engine
    │   ├── client.ts        the Claude bridge (structured outputs)
    │   └── run.ts           orchestration, persistence, run logging
    └── worker/
        ├── scheduler.ts     the background tick
        ├── publish.ts       publishing + the queue-slot algorithm
        └── analytics.ts     metric sync and modelling
```

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript (strict) ·
Prisma + SQLite · Tailwind CSS v4 · `@anthropic-ai/sdk`. No charting library — the charts
are hand-built accessible SVG.

### Adding a network

Add one entry to `src/lib/platforms/registry.ts` and it appears in the catalogue, the
composer, the validator and the analytics breakdown. Add an adapter in `adapters.ts` to
make it publish for real.

---

## Security

| | |
|---|---|
| **Passwords** | scrypt (N=16384), per-user salt, constant-time comparison. |
| **Platform tokens** | AES-256-GCM encrypted at rest with a key derived from `AUTH_SECRET` via HKDF. A database dump alone cannot post as you. |
| **Sessions** | Signed JWT in an httpOnly, SameSite=Lax cookie — unreadable from JavaScript, and it does not ride along on cross-site posts. |
| **OAuth** | State token and PKCE verifier in short-lived httpOnly cookies, verified on callback, so a crafted link cannot graft an attacker's account onto your workspace. |
| **Authorisation** | Checked inside every server action, not just hidden in the UI. Workspace-scoped queries throughout, so an id from elsewhere resolves to nothing. |
| **Health endpoint** | Aggregate counts only — no names, handles or account details. |

Set a real `AUTH_SECRET` before deploying: `openssl rand -base64 48`.

---

## Configuration

Everything in `.env.example` is optional except `DATABASE_URL` and `AUTH_SECRET`.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./chorus.db` | SQLite path, or a Postgres URL |
| `AUTH_SECRET` | — | **Required.** Signs sessions, encrypts tokens |
| `APP_URL` | `http://localhost:3000` | Used to build OAuth redirect URIs |
| `ANTHROPIC_API_KEY` | — | Puts the agents on Claude |
| `CHORUS_AI_MODEL` | `claude-opus-5-5` | Model for the agents |
| `CHORUS_AI_EFFORT` | `medium` | How hard the model thinks |
| `CHORUS_WORKER_ENABLED` | `true` | Set `false` to disable background automation |
| `CHORUS_WORKER_TICK_SECONDS` | `30` | How often the worker runs |

Platform credentials (`META_CLIENT_ID`, `X_CLIENT_ID`, `LINKEDIN_CLIENT_ID`, …) are listed
in `.env.example`. Any platform without them stays available in sandbox mode.

---

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # production server
npm run typecheck    # tsc --noEmit
npm run db:push      # apply the schema
npm run db:seed      # seed the demo workspace
npm run db:reset     # wipe and re-seed
```

---

## Deploying

The background worker runs **inside the Next.js process** (started from
`instrumentation.ts`), so it needs a long-lived Node server — not a serverless
function-per-request platform. A single container, VM or Node host is all it takes.

For production, switch `provider` in `prisma/schema.prisma` to `postgresql`, point
`DATABASE_URL` at your database, and run `npx prisma db push`. If you run more than one
instance, set `CHORUS_WORKER_ENABLED=false` on all but one so posts are not published twice.

---

## What is verified

The flows below were exercised end to end against a production build in a real browser:
sign in and sign out, session protection on every page, composing and publishing to
multiple destinations, the published post appearing in the queue with metrics, live
per-platform validation blocking an over-limit post, running an agent on demand, the
background worker running three agents autonomously on schedule, and both light and dark
themes at desktop and phone widths with no horizontal overflow.

The Claude engine is type-checked against the installed SDK and its request path was
confirmed to reach the Anthropic API; it was not executed against a live key in that
environment, because no credentials were available there. The heuristic engine — the
default — is fully exercised.
