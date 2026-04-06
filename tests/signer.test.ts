import assert from "node:assert/strict";
import test from "node:test";

import {
  bytesToHex,
  hexToBytes,
  signerFromEnv,
  signerFromMnemonic,
  signerFromPrivateKey,
} from "../src/crypto/signer";

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

test("signerFromPrivateKey rejects non-hex keys", () => {
  assert.throws(
    () => signerFromPrivateKey("zz".repeat(32)),
    /must contain only hexadecimal characters/
  );
});

test("signerFromPrivateKey accepts valid 0x-prefixed keys", async () => {
  const signer = signerFromPrivateKey(`0x${"11".repeat(32)}`);
  const result = await signer.getSignerKey();
  assert.equal(result.isOk(), true);
});

test("signerFromMnemonic rejects invalid seed phrases", () => {
  assert.throws(
    () => signerFromMnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon nope"),
    /not a valid BIP-39 English seed phrase/
  );
});

test("signerFromEnv rejects ambiguous key configuration", async () => {
  await withEnv(
    {
      SIGNER_PRIVATE_KEY: "11".repeat(32),
      SIGNER_MNEMONIC:
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    },
    () => {
      assert.throws(() => signerFromEnv(), /not both/);
    }
  );
});

test("hexToBytes rejects malformed hash input instead of truncating it", () => {
  assert.throws(() => hexToBytes("abzz", "Cast hash"), /must contain only hexadecimal characters/);
});

test("hexToBytes round-trips valid values", () => {
  const original = `0x${"ab".repeat(20)}`;
  assert.equal(bytesToHex(hexToBytes(original)), original);
});
