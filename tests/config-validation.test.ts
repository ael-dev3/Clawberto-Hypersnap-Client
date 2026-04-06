import assert from "node:assert/strict";
import test from "node:test";

import { defaultConfig } from "../src/client/hypersnap";
import { loadAuth } from "../src/skills/auth";

async function withEnv<T>(
  updates: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(updates)) {
    previous.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

const BASE_CONFIG_ENV = {
  HYPERSNAP_GRPC: "hub.neynar.com:3383",
  HYPERSNAP_HTTP: "https://hub.neynar.com:3381/",
  HYPERSNAP_SSL: "true",
  HYPERSNAP_USERNAME: undefined,
  HYPERSNAP_PASSWORD: undefined,
  HYPERSNAP_API_KEY: undefined,
  FARCASTER_NETWORK: "mainnet",
};

test("defaultConfig normalizes valid config values", async () => {
  await withEnv(BASE_CONFIG_ENV, () => {
    const config = defaultConfig();
    assert.equal(config.grpcAddr, "hub.neynar.com:3383");
    assert.equal(config.httpAddr, "https://hub.neynar.com:3381");
    assert.equal(config.ssl, true);
  });
});

test("defaultConfig rejects malformed network names", async () => {
  await withEnv(
    {
      ...BASE_CONFIG_ENV,
      FARCASTER_NETWORK: "staging",
    },
    () => {
      assert.throws(() => defaultConfig(), /FARCASTER_NETWORK must be one of/);
    }
  );
});

test("defaultConfig rejects partial basic auth configuration", async () => {
  await withEnv(
    {
      ...BASE_CONFIG_ENV,
      HYPERSNAP_USERNAME: "alice",
    },
    () => {
      assert.throws(() => defaultConfig(), /Set both HYPERSNAP_USERNAME and HYPERSNAP_PASSWORD/);
    }
  );
});

test("defaultConfig rejects malformed gRPC addresses", async () => {
  await withEnv(
    {
      ...BASE_CONFIG_ENV,
      HYPERSNAP_GRPC: "https://hub.neynar.com:3383",
    },
    () => {
      assert.throws(() => defaultConfig(), /HYPERSNAP_GRPC must be host:port/);
    }
  );
});

test("loadAuth rejects non-integer FIDs before attempting network access", async () => {
  await withEnv(
    {
      FARCASTER_FID: "12.5",
      SIGNER_PRIVATE_KEY: undefined,
      SIGNER_MNEMONIC: undefined,
    },
    async () => {
      await assert.rejects(loadAuth(), /FARCASTER_FID must be a positive integer/);
    }
  );
});
