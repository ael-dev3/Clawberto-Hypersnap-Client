# Clawberto HyperSnap Client

OpenClaw client connected to HyperSnap — authenticate, post, and view Farcaster content specifically via a local HyperSnap node.

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

Edit `.env`:

```env
# HyperSnap node (must be running locally or remotely)
HYPERSNAP_GRPC=localhost:3383
HYPERSNAP_HTTP=http://localhost:3381

# Your Farcaster ID
FARCASTER_FID=12345

# Signing key — choose ONE:
SIGNER_PRIVATE_KEY=<64-char hex Ed25519 private key>
# OR
SIGNER_MNEMONIC=<12 or 24 word BIP-39 mnemonic>

# Telegram bot (for the bot skill)
TELEGRAM_BOT_TOKEN=<token from @BotFather>
TELEGRAM_ALLOWED_USERS=123456789,987654321   # leave empty to allow everyone
```

> **Note:** The signing key must be an Ed25519 key already registered on-chain via the Farcaster Key Registry on Base. The public key shown at startup is what you register.

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

## Telegram Bot Commands

| Command | Description |
|---|---|
| `/start` | Show help |
| `/post <text>` | Publish a cast via HyperSnap |
| `/feed [fid]` | Show recent casts with interaction buttons |
| `/profile [fid]` | Show a Farcaster profile |
| `/node` | Show HyperSnap node status |
| `/cancel` | Cancel a pending reply or quote |

### Inline Buttons

Every cast shown in the feed has buttons:

```
👍 Like    🔁 Recast
💬 Reply   📝 Quote
      🧵 Thread
```

- **Like / Unlike** — toggle a like reaction on the cast
- **Recast / Undo Recast** — toggle a recast
- **Reply** — bot prompts you for reply text, then submits it as a child cast
- **Quote** — bot prompts you for text, then posts it as a new cast embedding the original
- **Thread** — fetches and displays replies to the cast

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

## Authentication

### Option A — Raw private key

```env
SIGNER_PRIVATE_KEY=abcdef0123456789...  # 64 hex chars, no 0x prefix
```

### Option B — BIP-39 mnemonic (SLIP-0010 derivation)

```env
SIGNER_MNEMONIC=word1 word2 word3 ...   # 12 or 24 words
```

The key is derived using SLIP-0010 Ed25519 master key derivation. The resulting public key is logged at startup — register it on-chain before posting.

## HyperSnap vs Snapchain

Messages are submitted exclusively to the locally configured HyperSnap node (`HYPERSNAP_GRPC`). HyperSnap is compatible with the Farcaster protocol, so messages propagate to the wider Farcaster network through the node's gossip layer.
