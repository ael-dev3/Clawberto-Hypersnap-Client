/**
 * client/hypersnap.ts
 * Remote-first Farcaster hub client targeting any Snapchain-compatible node
 * (HyperSnap, community nodes, or managed services like Neynar).
 *
 * Supports:
 *   - Plaintext gRPC  (most self-hosted nodes)
 *   - TLS/SSL gRPC    (managed providers, set HYPERSNAP_SSL=true)
 *   - HTTP Basic Auth  (HYPERSNAP_USERNAME / HYPERSNAP_PASSWORD)
 *   - Neynar API key   (HYPERSNAP_API_KEY, sent as x-api-key header)
 */

import {
  getInsecureHubRpcClient,
  getSSLHubRpcClient,
  HubRpcClient,
  Metadata,
  Message,
  FarcasterNetwork,
} from "@farcaster/hub-nodejs";

export interface HyperSnapConfig {
  /** gRPC address, e.g. "hub.example.com:3383" */
  grpcAddr: string;
  /** HTTP address, e.g. "https://hub.example.com:3381" */
  httpAddr: string;
  network: FarcasterNetwork;
  /** Use TLS for the gRPC connection (required for most managed providers) */
  ssl: boolean;
  /** Optional Basic Auth credentials (username:password) */
  auth?: { username: string; password: string };
  /** Optional API key (forwarded as x-api-key, used by Neynar and similar) */
  apiKey?: string;
}

export function defaultConfig(): HyperSnapConfig {
  const grpcAddr = process.env.HYPERSNAP_GRPC?.trim();
  const httpAddr = process.env.HYPERSNAP_HTTP?.trim();

  if (!grpcAddr) {
    throw new Error(
      "HYPERSNAP_GRPC is not set.\n" +
        "Set it to a remote Snapchain node, e.g.:\n" +
        "  HYPERSNAP_GRPC=snapchain.example.com:3383\n" +
        "Managed options: Neynar (https://neynar.com) provides hosted hub access."
    );
  }
  if (!httpAddr) {
    throw new Error(
      "HYPERSNAP_HTTP is not set.\n" +
        "Set it to the HTTP address of the same node, e.g.:\n" +
        "  HYPERSNAP_HTTP=https://snapchain.example.com:3381"
    );
  }

  const networkStr = (process.env.FARCASTER_NETWORK ?? "mainnet").toLowerCase();
  const networkMap: Record<string, FarcasterNetwork> = {
    mainnet: FarcasterNetwork.MAINNET,
    testnet: FarcasterNetwork.TESTNET,
    devnet: FarcasterNetwork.DEVNET,
  };

  const ssl = process.env.HYPERSNAP_SSL?.trim().toLowerCase() === "true";

  const username = process.env.HYPERSNAP_USERNAME?.trim();
  const password = process.env.HYPERSNAP_PASSWORD?.trim();
  const auth =
    username && password ? { username, password } : undefined;

  const apiKey = process.env.HYPERSNAP_API_KEY?.trim() || undefined;

  return {
    grpcAddr,
    httpAddr,
    network: networkMap[networkStr] ?? FarcasterNetwork.MAINNET,
    ssl,
    auth,
    apiKey,
  };
}

export class HyperSnapClient {
  readonly config: HyperSnapConfig;
  private rpc: HubRpcClient;

  constructor(config: HyperSnapConfig = defaultConfig()) {
    this.config = config;
    this.rpc = config.ssl
      ? getSSLHubRpcClient(config.grpcAddr)
      : getInsecureHubRpcClient(config.grpcAddr);
  }

  /** Build gRPC Metadata for authenticated requests. */
  private authMetadata(): Metadata {
    const meta = new Metadata();
    if (this.config.auth) {
      const token = Buffer.from(
        `${this.config.auth.username}:${this.config.auth.password}`
      ).toString("base64");
      meta.add("authorization", `Basic ${token}`);
    }
    if (this.config.apiKey) {
      meta.add("x-api-key", this.config.apiKey);
    }
    return meta;
  }

  /** Build fetch headers for HTTP requests. */
  private httpHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.config.auth) {
      const token = Buffer.from(
        `${this.config.auth.username}:${this.config.auth.password}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${token}`;
    }
    if (this.config.apiKey) {
      headers["x-api-key"] = this.config.apiKey;
    }
    return headers;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /** Submit any signed Farcaster Message to the remote node. */
  async submitMessage(message: Message) {
    const result = await this.rpc.submitMessage(message, this.authMetadata());
    if (result.isErr()) throw result.error;
    return result.value;
  }

  // ── Casts ─────────────────────────────────────────────────────────────────

  async getCastsByFid(fid: number, pageSize = 20) {
    const result = await this.rpc.getCastsByFid(
      { fid, pageSize },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  async getCast(fid: number, hash: Uint8Array) {
    const result = await this.rpc.getCast({ fid, hash }, this.authMetadata());
    if (result.isErr()) throw result.error;
    return result.value;
  }

  async getCastsByParent(parentFid: number, parentHash: Uint8Array) {
    const result = await this.rpc.getCastsByParent(
      { parentCastId: { fid: parentFid, hash: parentHash } },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  async getReactionsByFid(fid: number, pageSize = 20) {
    const result = await this.rpc.getReactionsByFid(
      { fid, pageSize },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  async getReactionsByCast(targetFid: number, targetHash: Uint8Array) {
    const result = await this.rpc.getReactionsByCast(
      { targetCastId: { fid: targetFid, hash: targetHash } },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async getUserDataByFid(fid: number) {
    const result = await this.rpc.getUserDataByFid(
      { fid },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Node info ─────────────────────────────────────────────────────────────

  async getNodeInfo() {
    const res = await fetch(
      `${this.config.httpAddr}/v1/info`,
      { headers: this.httpHeaders() }
    );
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
