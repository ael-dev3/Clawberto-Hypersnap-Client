/**
 * index.ts
 * OpenClaw HyperSnap Client — programmatic entry point.
 *
 * For the Telegram bot, run:  npm run bot
 * For programmatic use, import the skills directly.
 *
 * Example:
 *   import { loadAuth } from './skills/auth';
 *   import { postCast } from './skills/post';
 *   const auth = await loadAuth();
 *   await postCast(auth, { text: 'Hello from HyperSnap!' });
 */

import "dotenv/config";
import { loadAuth } from "./skills/auth";
import { postCast } from "./skills/post";
import { getFeed, getProfile, formatCast, formatProfile } from "./skills/view";

export { HyperSnapClient, defaultConfig } from "./client/hypersnap";
export { signerFromPrivateKey, signerFromMnemonic, signerFromEnv } from "./crypto/signer";
export { loadAuth } from "./skills/auth";
export { postCast, removeCast, likeCast, unlikeCast, recast, unrecast, replyCast, quoteCast } from "./skills/post";
export { getFeed, getReplies, getProfile, formatCast, formatProfile } from "./skills/view";

// Quick smoke-test when run directly:  npx tsx src/index.ts
if (require.main === module) {
  (async () => {
    const auth = await loadAuth();
    console.log(`\n✅ Auth loaded — FID ${auth.fid}, pubkey ${auth.publicKeyHex}\n`);

    const profile = await getProfile(auth.client, auth.fid).catch(() => undefined);
    if (profile) console.log(formatProfile(profile));

    const feed = await getFeed(auth.client, auth.fid, 3);
    if (feed.length === 0) {
      console.log("No casts yet for this FID.");
    } else {
      console.log(`\nRecent casts from FID ${auth.fid}:`);
      feed.forEach((cast, i) => console.log("\n" + formatCast(cast, profile, i)));
    }
  })().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
}
