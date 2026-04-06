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

const NETWORK_MAP: Record<string, FarcasterNetwork> = {
  mainnet: FarcasterNetwork.MAINNET,
  testnet: FarcasterNetwork.TESTNET,
  devnet: FarcasterNetwork.DEVNET,
};

function parseGrpcAddress(value: string): string {
  const grpcAddr = value.trim();
  if (!grpcAddr) {
    throw new Error("HYPERSNAP_GRPC is set but empty.");
  }
  if (grpcAddr.includes("://")) {
    throw new Error("HYPERSNAP_GRPC must be host:port without http:// or https://.");
  }

  let parsed: URL;
  try {
    parsed = new URL(`http://${grpcAddr}`);
  } catch {
    throw new Error("HYPERSNAP_GRPC must be a valid host:port pair.");
  }

  if (!parsed.hostname || !parsed.port || parsed.pathname !== "/") {
    throw new Error("HYPERSNAP_GRPC must be a valid host:port pair.");
  }
  return grpcAddr;
}

function parseHttpAddress(value: string): string {
  const httpAddr = value.trim().replace(/\/+$/, "");
  if (!httpAddr) {
    throw new Error("HYPERSNAP_HTTP is set but empty.");
  }

  let parsed: URL;
  try {
    parsed = new URL(httpAddr);
  } catch {
    throw new Error("HYPERSNAP_HTTP must be a valid http:// or https:// URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("HYPERSNAP_HTTP must use http:// or https://.");
  }

  return httpAddr;
}

function parseNetwork(value?: string): FarcasterNetwork {
  const networkStr = (value?.trim() || "mainnet").toLowerCase();
  const network = NETWORK_MAP[networkStr];
  if (network == null) {
    throw new Error(
      "FARCASTER_NETWORK must be one of: mainnet, testnet, devnet."
    );
  }
  return network;
}

function parseBooleanEnv(name: string, value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`${name} must be set to true or false when provided.`);
}

export function defaultConfig(): HyperSnapConfig {
  const grpcEnv = process.env.HYPERSNAP_GRPC?.trim();
  const httpEnv = process.env.HYPERSNAP_HTTP?.trim();

  if (!grpcEnv) {
    throw new Error(
      "HYPERSNAP_GRPC is not set.\n" +
        "Set it to a remote Snapchain node, e.g.:\n" +
        "  HYPERSNAP_GRPC=snapchain.example.com:3383\n" +
        "Managed options: Neynar (https://neynar.com) provides hosted hub access."
    );
  }
  if (!httpEnv) {
    throw new Error(
      "HYPERSNAP_HTTP is not set.\n" +
        "Set it to the HTTP address of the same node, e.g.:\n" +
        "  HYPERSNAP_HTTP=https://snapchain.example.com:3381"
    );
  }

  const grpcAddr = parseGrpcAddress(grpcEnv);
  const httpAddr = parseHttpAddress(httpEnv);
  const network = parseNetwork(process.env.FARCASTER_NETWORK);
  const ssl = parseBooleanEnv("HYPERSNAP_SSL", process.env.HYPERSNAP_SSL);

  const username = process.env.HYPERSNAP_USERNAME?.trim();
  const password = process.env.HYPERSNAP_PASSWORD?.trim();
  if ((username && !password) || (!username && password)) {
    throw new Error(
      "Set both HYPERSNAP_USERNAME and HYPERSNAP_PASSWORD for Basic Auth."
    );
  }
  const auth = username && password ? { username, password } : undefined;

  const apiKey = process.env.HYPERSNAP_API_KEY?.trim() || undefined;

  return {
    grpcAddr,
    httpAddr,
    network,
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
  async submitMessage(message: Message): Promise<Message> {
    const result = await this.rpc.submitMessage(message, this.authMetadata());
    if (result.isErr()) throw result.error;
    return result.value;
  }

  // ── Casts ─────────────────────────────────────────────────────────────────

  async getCastsByFid(fid: number, pageSize = 20): Promise<Message[]> {
    const result = await this.rpc.getCastsByFid(
      { fid, pageSize },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  async getCast(fid: number, hash: Uint8Array): Promise<Message> {
    const result = await this.rpc.getCast({ fid, hash }, this.authMetadata());
    if (result.isErr()) throw result.error;
    return result.value;
  }

  async getCastsByParent(parentFid: number, parentHash: Uint8Array): Promise<Message[]> {
    const result = await this.rpc.getCastsByParent(
      { parentCastId: { fid: parentFid, hash: parentHash } },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  async getReactionsByFid(fid: number, pageSize = 20): Promise<Message[]> {
    const result = await this.rpc.getReactionsByFid(
      { fid, pageSize },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  async getReactionsByCast(targetFid: number, targetHash: Uint8Array): Promise<Message[]> {
    const result = await this.rpc.getReactionsByCast(
      { targetCastId: { fid: targetFid, hash: targetHash } },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  async getUserDataByFid(fid: number): Promise<Message[]> {
    const result = await this.rpc.getUserDataByFid(
      { fid },
      this.authMetadata()
    );
    if (result.isErr()) throw result.error;
    return result.value.messages;
  }

  // ── Node info ─────────────────────────────────────────────────────────────

  async getNodeInfo(): Promise<NodeInfo> {
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
