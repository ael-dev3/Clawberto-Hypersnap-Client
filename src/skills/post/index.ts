/**
 * skills/post/index.ts
 * Posting skill — cast, react (like/recast), reply, quote cast, remove cast.
 * All messages are signed and submitted specifically via HyperSnap.
 */

import {
  makeCastAdd,
  makeCastRemove,
  makeReactionAdd,
  makeReactionRemove,
  FarcasterNetwork,
  ReactionType,
  Message,
} from "@farcaster/hub-nodejs";
import { hexToBytes } from "../../crypto/signer";
import type { AuthContext } from "../auth";

const FARCASTER_EPOCH = 1609459200; // Jan 1 2021 UTC

function nowFarcasterTime(): number {
  return Math.floor(Date.now() / 1000) - FARCASTER_EPOCH;
}

function dataOptions(ctx: AuthContext) {
  return { fid: ctx.fid, network: ctx.client.config.network };
}

// ── Cast ──────────────────────────────────────────────────────────────────────

export interface CastOptions {
  text: string;
  embeds?: string[];
  mentions?: number[];
  mentionsPositions?: number[];
  /** Reply to an existing cast */
  parentCastId?: { fid: number; hash: string };
  /** Reply to a URL (channel) */
  parentUrl?: string;
}

/** Create and submit a new cast via HyperSnap. Returns the submitted Message. */
export async function postCast(
  ctx: AuthContext,
  opts: CastOptions
): Promise<Message> {
  const body: Parameters<typeof makeCastAdd>[0] = {
    text: opts.text,
    embeds: opts.embeds?.map((url) => ({ url })) ?? [],
    mentions: opts.mentions ?? [],
    mentionsPositions: opts.mentionsPositions ?? [],
  };

  if (opts.parentCastId) {
    body.parentCastId = {
      fid: opts.parentCastId.fid,
      hash: hexToBytes(opts.parentCastId.hash),
    };
  } else if (opts.parentUrl) {
    body.parentUrl = opts.parentUrl;
  }

  const result = await makeCastAdd(body, dataOptions(ctx), ctx.signer);
  if (result.isErr()) throw result.error;

  return ctx.client.submitMessage(result.value);
}

/** Remove a cast by its hash. */
export async function removeCast(
  ctx: AuthContext,
  castHashHex: string
): Promise<Message> {
  const result = await makeCastRemove(
    { targetHash: hexToBytes(castHashHex) },
    dataOptions(ctx),
    ctx.signer
  );
  if (result.isErr()) throw result.error;
  return ctx.client.submitMessage(result.value);
}

// ── Reactions ─────────────────────────────────────────────────────────────────

export async function likeCast(
  ctx: AuthContext,
  targetFid: number,
  targetHashHex: string
): Promise<Message> {
  const result = await makeReactionAdd(
    {
      type: ReactionType.LIKE,
      targetCastId: { fid: targetFid, hash: hexToBytes(targetHashHex) },
    },
    dataOptions(ctx),
    ctx.signer
  );
  if (result.isErr()) throw result.error;
  return ctx.client.submitMessage(result.value);
}

export async function unlikeCast(
  ctx: AuthContext,
  targetFid: number,
  targetHashHex: string
): Promise<Message> {
  const result = await makeReactionRemove(
    {
      type: ReactionType.LIKE,
      targetCastId: { fid: targetFid, hash: hexToBytes(targetHashHex) },
    },
    dataOptions(ctx),
    ctx.signer
  );
  if (result.isErr()) throw result.error;
  return ctx.client.submitMessage(result.value);
}

export async function recast(
  ctx: AuthContext,
  targetFid: number,
  targetHashHex: string
): Promise<Message> {
  const result = await makeReactionAdd(
    {
      type: ReactionType.RECAST,
      targetCastId: { fid: targetFid, hash: hexToBytes(targetHashHex) },
    },
    dataOptions(ctx),
    ctx.signer
  );
  if (result.isErr()) throw result.error;
  return ctx.client.submitMessage(result.value);
}

export async function unrecast(
  ctx: AuthContext,
  targetFid: number,
  targetHashHex: string
): Promise<Message> {
  const result = await makeReactionRemove(
    {
      type: ReactionType.RECAST,
      targetCastId: { fid: targetFid, hash: hexToBytes(targetHashHex) },
    },
    dataOptions(ctx),
    ctx.signer
  );
  if (result.isErr()) throw result.error;
  return ctx.client.submitMessage(result.value);
}

// ── Reply & Quote ─────────────────────────────────────────────────────────────

/** Reply to a cast (parentCastId variant of postCast). */
export async function replyCast(
  ctx: AuthContext,
  text: string,
  parentFid: number,
  parentHashHex: string
): Promise<Message> {
  return postCast(ctx, {
    text,
    parentCastId: { fid: parentFid, hash: parentHashHex },
  });
}

/**
 * Quote cast — posts a new cast that embeds the target cast.
 * The quoted cast appears as an embed in the new cast.
 */
export async function quoteCast(
  ctx: AuthContext,
  text: string,
  targetFid: number,
  targetHashHex: string
): Promise<Message> {
  const result = await makeCastAdd(
    {
      text,
      embeds: [{ castId: { fid: targetFid, hash: hexToBytes(targetHashHex) } }],
      mentions: [],
      mentionsPositions: [],
    },
    dataOptions(ctx),
    ctx.signer
  );
  if (result.isErr()) throw result.error;
  return ctx.client.submitMessage(result.value);
}
