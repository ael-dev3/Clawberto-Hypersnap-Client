/**
 * skills/auth/index.ts
 * Authentication skill — loads and validates the signing identity.
 * Call loadAuth() once at startup; pass the result to post/view skills.
 */

import { Ed25519Signer } from "@farcaster/hub-nodejs";
import { signerFromEnv, bytesToHex } from "../../crypto/signer";
import { HyperSnapClient } from "../../client/hypersnap";

export interface AuthContext {
  fid: number;
  signer: Ed25519Signer;
  /** 0x-prefixed hex public key that must be registered on-chain */
  publicKeyHex: string;
  client: HyperSnapClient;
}

/**
 * Load auth from environment variables and verify the HyperSnap node is reachable.
 * Throws if configuration is missing or the node is unreachable.
 */
export async function loadAuth(): Promise<AuthContext> {
  const fidStr = process.env.FARCASTER_FID?.trim();
  if (!fidStr || isNaN(Number(fidStr))) {
    throw new Error("FARCASTER_FID is not set or invalid in .env");
  }
  const fid = Number(fidStr);

  const signer = signerFromEnv();

  const pubKeyResult = await signer.getSignerKey();
  if (pubKeyResult.isErr()) throw pubKeyResult.error;
  const publicKeyHex = bytesToHex(pubKeyResult.value);

  const client = new HyperSnapClient();

  // Sanity-check: verify we can reach the HyperSnap node
  try {
    const info = await client.getNodeInfo();
    console.log(
      `[auth] Connected to HyperSnap — ${info.numShards} shard(s), ` +
        `${info.dbStats.numMessages.toLocaleString()} messages`
    );
  } catch (err) {
    throw new Error(
      `Cannot reach HyperSnap node at ${client.config.httpAddr}. ` +
        `Make sure the node is running. (${(err as Error).message})`
    );
  }

  console.log(`[auth] Loaded signer for FID ${fid} — pubkey ${publicKeyHex}`);
  return { fid, signer, publicKeyHex, client };
}
