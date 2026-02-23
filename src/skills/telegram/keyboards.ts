/**
 * skills/telegram/keyboards.ts
 * Inline keyboard builders for cast interactions.
 *
 * Callback data format: <action>:<fid>:<hashHex>
 *   like:<fid>:<hash>       — like a cast
 *   unlike:<fid>:<hash>     — remove like
 *   recast:<fid>:<hash>     — recast
 *   unrecast:<fid>:<hash>   — remove recast
 *   reply:<fid>:<hash>      — begin reply flow
 *   quote:<fid>:<hash>      — begin quote cast flow
 *   thread:<fid>:<hash>     — view replies thread
 */

import { InlineKeyboard } from "grammy";

export type CastAction = "like" | "unlike" | "recast" | "unrecast" | "reply" | "quote" | "thread";

export function castCallbackData(action: CastAction, fid: number, hashHex: string): string {
  // Telegram callback data has a 64-byte limit.
  // We store the first 20 bytes of the hash (40 hex chars) — enough for identity.
  const shortHash = hashHex.replace("0x", "").slice(0, 40);
  return `${action}:${fid}:${shortHash}`;
}

export function parseCastCallback(data: string): { action: CastAction; fid: number; hashHex: string } | null {
  const parts = data.split(":");
  if (parts.length !== 3) return null;
  const [action, fidStr, shortHash] = parts;
  return {
    action: action as CastAction,
    fid: parseInt(fidStr, 10),
    hashHex: "0x" + shortHash,
  };
}

/** Standard cast interaction keyboard. */
export function castKeyboard(fid: number, hashHex: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("👍 Like", castCallbackData("like", fid, hashHex))
    .text("🔁 Recast", castCallbackData("recast", fid, hashHex))
    .row()
    .text("💬 Reply", castCallbackData("reply", fid, hashHex))
    .text("📝 Quote", castCallbackData("quote", fid, hashHex))
    .row()
    .text("🧵 Thread", castCallbackData("thread", fid, hashHex));
}

/** Keyboard shown after liking — lets the user undo. */
export function castKeyboardLiked(fid: number, hashHex: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("❤️ Liked", castCallbackData("unlike", fid, hashHex))
    .text("🔁 Recast", castCallbackData("recast", fid, hashHex))
    .row()
    .text("💬 Reply", castCallbackData("reply", fid, hashHex))
    .text("📝 Quote", castCallbackData("quote", fid, hashHex))
    .row()
    .text("🧵 Thread", castCallbackData("thread", fid, hashHex));
}

/** Keyboard shown after recasting — lets the user undo. */
export function castKeyboardRecast(fid: number, hashHex: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("👍 Like", castCallbackData("like", fid, hashHex))
    .text("✅ Recasted", castCallbackData("unrecast", fid, hashHex))
    .row()
    .text("💬 Reply", castCallbackData("reply", fid, hashHex))
    .text("📝 Quote", castCallbackData("quote", fid, hashHex))
    .row()
    .text("🧵 Thread", castCallbackData("thread", fid, hashHex));
}
