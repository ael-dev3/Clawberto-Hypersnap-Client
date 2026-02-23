/**
 * client/hypersnap.ts
 * Thin wrapper around @farcaster/hub-nodejs that points at the local
 * HyperSnap node instead of a public Farcaster hub.
 */

import {
  getInsecureHubRpcClient,
  HubRpcClient,
  Message,
  FarcasterNetwork,
} from "@farcaster/hub-nodejs";

export interface HyperSnapConfig {
  grpcAddr: string;
  httpAddr: string;
  network: FarcasterNetwork;
}

export function defaultConfig(): HyperSnapConfig {
  const networkStr = (process.env.FARCASTER_NETWORK ?? "mainnet").toLowerCase();
  const networkMap: Record<string, FarcasterNetwork> = {
    mainnet: FarcasterNetwork.MAINNET,
    testnet: FarcasterNetwork.TESTNET,
    devnet: FarcasterNetwork.DEVNET,
  };
  return {
    grpcAddr: process.env.HYPERSNAP_GRPC ?? "localhost:3383",
    httpAddr: process.env.HYPERSNAP_HTTP ?? "http://localhost:3381",
    network: networkMap[networkStr] ?? FarcasterNetwork.MAINNET,
  };
}

export class HyperSnapClient {
  readonly config: HyperSnapConfig;
  private rpc: HubRpcClient;

  constructor(config: HyperSnapConfig = defaultConfig()) {
    this.config = config;
    this.rpc = getInsecureHubRpcClient(config.grpcAddr);
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /** Submit any signed Farcaster Message to HyperSnap. */
  async submitMessage(message: Message) {
    const result = await this.rpc.submitMessage(message);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  // ── Casts ─────────────────────────────────────────────────────────────────

  async getCastsByFid(fid: number, pageSize = 20) {
    const result = await this.rpc.getCastsByFid({ fid, pageSize });
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  async getCast(fid: number, hash: Uint8Array) {
    const result = await this.rpc.getCast({ fid, hash });
    if (result.isErr()) throw result.error;
    return result.value;
  }

  async getCastsByParent(parentFid: number, parentHash: Uint8Array) {
    const result = await this.rpc.getCastsByParent({
      parentCastId: { fid: parentFid, hash: parentHash },
    });
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  async getReactionsByFid(fid: number, pageSize = 20) {
    const result = await this.rpc.getReactionsByFid({ fid, pageSize });
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  async getReactionsByCast(targetFid: number, targetHash: Uint8Array) {
    const result = await this.rpc.getReactionsByCast({
      targetCastId: { fid: targetFid, hash: targetHash },
    });
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async getUserDataByFid(fid: number) {
    const result = await this.rpc.getUserDataByFid({ fid });
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Node info ─────────────────────────────────────────────────────────────

  async getNodeInfo() {
    const res = await fetch(`${this.config.httpAddr}/v1/info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json() as Promise<NodeInfo>;
  }
}

export interface NodeInfo {
  dbStats: { numMessages: number; numFidRegistrations: number; approxSize: number };
  numShards: number;
  shardInfos: Array<{
    shardId: number;
    maxHeight: number;
    numMessages: number;
    blockDelay: number;
    mempoolSize: number;
  }>;
}
