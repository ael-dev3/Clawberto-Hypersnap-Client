/**
 * skills/telegram/keyboards.ts
 * Inline keyboard builders for cast interactions.
 *
 * Callback data format: <action>:<fid>:<hashHex>
 *   like:<fid>:<hash>       - like a cast
 *   unlike:<fid>:<hash>     - remove like
 *   recast:<fid>:<hash>     - recast
 *   unrecast:<fid>:<hash>   - remove recast
 *   reply:<fid>:<hash>      - begin reply flow
 *   quote:<fid>:<hash>      - begin quote cast flow
 *   thread:<fid>:<hash>     - view replies thread
 */

import { InlineKeyboard } from "grammy";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "grammy/types";

export type CastAction =
  | "like"
  | "unlike"
  | "recast"
  | "unrecast"
  | "reply"
  | "quote"
  | "thread";

export interface CastKeyboardState {
  liked?: boolean;
  recasted?: boolean;
}

type ReplyMarkupLike = Pick<InlineKeyboardMarkup, "inline_keyboard">;

const CALLBACK_HASH_RE = /^[0-9a-f]{40}$/i;
const CAST_ACTIONS = new Set<CastAction>([
  "like",
  "unlike",
  "recast",
  "unrecast",
  "reply",
  "quote",
  "thread",
]);

export function castCallbackData(
  action: CastAction,
  fid: number,
  hashHex: string
): string {
  // Telegram callback data has a 64-byte limit.
  // Farcaster message hashes are 20 bytes, so 40 hex chars fit cleanly.
  if (!Number.isSafeInteger(fid) || fid <= 0) {
    throw new Error("Callback FID must be a positive integer.");
  }
  const shortHash = hashHex.replace(/^0x/i, "");
  if (!CALLBACK_HASH_RE.test(shortHash)) {
    throw new Error("Callback hash must be a 20-byte hex string.");
  }
  return `${action}:${fid}:${shortHash}`;
}

export function parseCastCallback(
  data: string
): { action: CastAction; fid: number; hashHex: string } | null {
  const parts = data.split(":");
  if (parts.length !== 3) return null;

  const [action, fidStr, shortHash] = parts;
  const fid = Number.parseInt(fidStr, 10);
  if (!CAST_ACTIONS.has(action as CastAction)) return null;
  if (!Number.isSafeInteger(fid) || fid <= 0) return null;
  if (!CALLBACK_HASH_RE.test(shortHash)) return null;

  return {
    action: action as CastAction,
    fid,
    hashHex: `0x${shortHash.toLowerCase()}`,
  };
}

export function inferCastKeyboardState(
  replyMarkup?: ReplyMarkupLike
): CastKeyboardState {
  const callbackData = (replyMarkup?.inline_keyboard ?? [])
    .flat()
    .map((button: InlineKeyboardButton) =>
      "callback_data" in button ? button.callback_data : undefined
    )
    .filter((value): value is string => typeof value === "string");

  return {
    liked: callbackData.some((value) => value.startsWith("unlike:")),
    recasted: callbackData.some((value) => value.startsWith("unrecast:")),
  };
}

/** Standard cast interaction keyboard. */
export function castKeyboard(
  fid: number,
  hashHex: string,
  state: CastKeyboardState = {}
): InlineKeyboard {
  const likeAction: CastAction = state.liked ? "unlike" : "like";
  const likeLabel = state.liked ? "Liked" : "Like";
  const recastAction: CastAction = state.recasted ? "unrecast" : "recast";
  const recastLabel = state.recasted ? "Recasted" : "Recast";

  return new InlineKeyboard()
    .text(likeLabel, castCallbackData(likeAction, fid, hashHex))
    .text(recastLabel, castCallbackData(recastAction, fid, hashHex))
    .row()
    .text("Reply", castCallbackData("reply", fid, hashHex))
    .text("Quote", castCallbackData("quote", fid, hashHex))
    .row()
    .text("Thread", castCallbackData("thread", fid, hashHex));
}

/** Keyboard shown after liking - lets the user undo. */
export function castKeyboardLiked(
  fid: number,
  hashHex: string
): InlineKeyboard {
  return castKeyboard(fid, hashHex, { liked: true });
}

/** Keyboard shown after recasting - lets the user undo. */
export function castKeyboardRecast(
  fid: number,
  hashHex: string
): InlineKeyboard {
  return castKeyboard(fid, hashHex, { recasted: true });
}
