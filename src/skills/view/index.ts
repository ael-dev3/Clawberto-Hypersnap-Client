/**
 * skills/view/index.ts
 * View skill — read casts, profiles, replies, and reactions from HyperSnap.
 */

import {
  Message,
  MessageType,
  UserDataType,
  ReactionType,
} from "@farcaster/hub-nodejs";
import { bytesToHex } from "../../crypto/signer";
import type { HyperSnapClient } from "../../client/hypersnap";

// ── Helpers ────────────────────────────────────────────────────────────────────

export function castText(msg: Message): string {
  return msg.data?.castAddBody?.text ?? "";
}

export function castHashHex(msg: Message): string {
  return bytesToHex(msg.hash);
}

export function castFid(msg: Message): number {
  return Number(msg.data?.fid ?? 0);
}

export function farcasterTimestampToDate(ts: number): Date {
  return new Date((ts + 1609459200) * 1000);
}

// ── Profile ────────────────────────────────────────────────────────────────────

export interface FarcasterProfile {
  fid: number;
  displayName?: string;
  username?: string;
  bio?: string;
  pfpUrl?: string;
}

export async function getProfile(
  client: HyperSnapClient,
  fid: number
): Promise<FarcasterProfile> {
  const messages = await client.getUserDataByFid(fid);
  const profile: FarcasterProfile = { fid };

  for (const msg of messages) {
    const body = msg.data?.userDataBody;
    if (!body) continue;
    switch (body.type) {
      case UserDataType.DISPLAY:
        profile.displayName = body.value;
        break;
      case UserDataType.USERNAME:
        profile.username = body.value;
        break;
      case UserDataType.BIO:
        profile.bio = body.value;
        break;
      case UserDataType.PFP:
        profile.pfpUrl = body.value;
        break;
    }
  }
  return profile;
}

export function formatProfile(p: FarcasterProfile): string {
  const name = p.displayName ?? p.username ?? `FID ${p.fid}`;
  const handle = p.username ? `@${p.username}` : "";
  const bio = p.bio ? `\n${p.bio}` : "";
  return `👤 ${name} ${handle} (FID ${p.fid})${bio}`;
}

// ── Casts ──────────────────────────────────────────────────────────────────────

export interface CastView {
  fid: number;
  hashHex: string;
  text: string;
  timestamp: Date;
  embeds: string[];
  parentFid?: number;
  parentHashHex?: string;
}

function msgToCastView(msg: Message): CastView | null {
  if (msg.data?.type !== MessageType.CAST_ADD) return null;
  const body = msg.data.castAddBody;
  if (!body) return null;

  const embeds: string[] = [];
  for (const e of body.embeds ?? []) {
    if (e.url) embeds.push(e.url);
    else if (e.castId)
      embeds.push(`cast:${e.castId.fid}:${bytesToHex(e.castId.hash)}`);
  }

  return {
    fid: Number(msg.data.fid),
    hashHex: bytesToHex(msg.hash),
    text: body.text,
    timestamp: farcasterTimestampToDate(msg.data.timestamp),
    embeds,
    parentFid: body.parentCastId ? Number(body.parentCastId.fid) : undefined,
    parentHashHex: body.parentCastId
      ? bytesToHex(body.parentCastId.hash)
      : undefined,
  };
}

/** Fetch recent casts from a given FID. */
export async function getFeed(
  client: HyperSnapClient,
  fid: number,
  limit = 10
): Promise<CastView[]> {
  const messages = await client.getCastsByFid(fid, limit);
  return messages
    .map(msgToCastView)
    .filter((c): c is CastView => c !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/** Fetch replies to a cast. */
export async function getReplies(
  client: HyperSnapClient,
  parentFid: number,
  parentHashHex: string
): Promise<CastView[]> {
  const { hexToBytes } = await import("../../crypto/signer");
  const messages = await client.getCastsByParent(
    parentFid,
    hexToBytes(parentHashHex)
  );
  return messages
    .map(msgToCastView)
    .filter((c): c is CastView => c !== null)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/** Format a cast for display in Telegram or terminal. */
export function formatCast(
  cast: CastView,
  profile?: FarcasterProfile,
  index?: number
): string {
  const author = profile?.username
    ? `@${profile.username}`
    : `FID ${cast.fid}`;
  const num = index != null ? `${index + 1}. ` : "";
  const ts = cast.timestamp.toLocaleString();
  const embedLine =
    cast.embeds.length > 0 ? `\n🔗 ${cast.embeds.join(", ")}` : "";
  const replyNote =
    cast.parentHashHex
      ? `\n↩️ Reply to FID ${cast.parentFid}`
      : "";

  return (
    `${num}✍️ ${author}  •  ${ts}\n` +
    `${cast.text}` +
    embedLine +
    replyNote
  );
}

// ── Reactions ──────────────────────────────────────────────────────────────────

export async function getLikesForCast(
  client: HyperSnapClient,
  targetFid: number,
  targetHashHex: string
): Promise<number> {
  const { hexToBytes } = await import("../../crypto/signer");
  const reactions = await client.getReactionsByCast(
    targetFid,
    hexToBytes(targetHashHex)
  );
  return reactions.filter(
    (m) => m.data?.reactionBody?.type === ReactionType.LIKE
  ).length;
}
