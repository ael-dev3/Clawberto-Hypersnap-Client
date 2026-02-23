# Clawberto HyperSnap Client

OpenClaw client for Farcaster — authenticate, post, and view content via any remote Snapchain-compatible node (HyperSnap, community nodes, or managed services). No local node required.

## Skills

| Skill | Description |
|---|---|
| **auth** | Load Ed25519 signing key (raw key or BIP-39 mnemonic) and verify node connectivity |
| **post** | Cast, reply, quote cast, like, recast, remove |
| **view** | Read casts, profiles, replies, and reaction counts |
| **telegram** | Full Telegram bot with inline keyboard buttons for all interactions |

## Setup

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env` with a **remote** node address and your Farcaster identity:

```env
# ── Remote node ────────────────────────────────────────────────────────────────
# Community or self-hosted node (plain gRPC)
HYPERSNAP_GRPC=snapchain.example.com:3383
HYPERSNAP_HTTP=http://snapchain.example.com:3381
HYPERSNAP_SSL=false

# Managed provider (TLS + API key) — e.g. Neynar
# HYPERSNAP_GRPC=hub.neynar.com:3383
# HYPERSNAP_HTTP=https://hub.neynar.com:3381
# HYPERSNAP_SSL=true
# HYPERSNAP_API_KEY=your-api-key

# ── Identity ───────────────────────────────────────────────────────────────────
FARCASTER_FID=2771439
SIGNER_PRIVATE_KEY=<64-char hex Ed25519 private key>
# or: SIGNER_MNEMONIC=<12 or 24 words>

# ── Telegram (optional) ────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=<token from @BotFather>
TELEGRAM_ALLOWED_USERS=123456789
```

### Finding a node

| Option | Details |
|---|---|
| **Neynar** | Managed hub at [neynar.com](https://neynar.com) — easiest, no self-hosting |
| **Community nodes** | Any public Snapchain node running ports 3381/3383 |
| **Self-hosted** | Run your own: [snapchain bootstrap](https://github.com/farcasterxyz/snapchain#running-a-node) |

### 2. Install

```bash
npm install
```

### 3. Run

```bash
# Smoke-test: show your profile and recent casts
npm run dev

# Telegram bot
npm run bot
```

## Authentication

### Signing key

Your **signer** is an Ed25519 key that must be registered on-chain via the Farcaster Key Registry on Base. The public key is logged at startup — use that to register it.

**Option A — Raw private key**
```env
SIGNER_PRIVATE_KEY=abcdef0123456789...   # 64 hex chars, no 0x prefix
```

**Option B — BIP-39 mnemonic (SLIP-0010 derivation)**
```env
SIGNER_MNEMONIC=word1 word2 word3 ...   # 12 or 24 words
```

### Node auth

For nodes that require authentication:

```env
# Basic Auth (username:password)
HYPERSNAP_USERNAME=youruser
HYPERSNAP_PASSWORD=yourpass

# API key (e.g. Neynar)
HYPERSNAP_API_KEY=your-api-key
```

## Telegram Bot

### Commands

| Command | Description |
|---|---|
| `/start` | Show help |
| `/post <text>` | Publish a cast |
| `/feed [fid]` | Show recent casts with interaction buttons |
| `/profile [fid]` | Show a Farcaster profile |
| `/node` | Show connected node status |
| `/cancel` | Cancel a pending reply or quote |

### Inline Buttons

Every cast in the feed has:

```
👍 Like    🔁 Recast
💬 Reply   📝 Quote
      🧵 Thread
```

- **Like / Unlike** — toggle a like reaction
- **Recast / Undo** — toggle a recast
- **Reply** — bot prompts for reply text, then posts it as a child cast
- **Quote** — bot prompts for text, then posts it embedding the original
- **Thread** — fetches and displays replies inline

## Programmatic Use

```typescript
import "dotenv/config";
import { loadAuth } from "./src/skills/auth";
import { postCast, likeCast, replyCast, quoteCast } from "./src/skills/post";
import { getFeed, getProfile } from "./src/skills/view";

const auth = await loadAuth();

// Post a cast
await postCast(auth, { text: "Hello from HyperSnap!" });

// Like a cast
await likeCast(auth, targetFid, "0xabc123...");

// Reply to a cast
await replyCast(auth, "Great point!", targetFid, "0xabc123...");

// Quote cast
await quoteCast(auth, "Look at this:", targetFid, "0xabc123...");

// View feed
const casts = await getFeed(auth.client, auth.fid, 10);
```
