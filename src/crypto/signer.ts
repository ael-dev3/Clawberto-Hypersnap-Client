/**
 * crypto/signer.ts
 * Ed25519 key management for Farcaster message signing.
 * Supports raw private key (hex) and BIP-39 mnemonic via SLIP-0010.
 */

import { Ed25519Signer } from "@farcaster/hub-nodejs";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha2";
import { mnemonicToSeedSync } from "@scure/bip39";

/**
 * Create a signer from a raw hex-encoded Ed25519 private key.
 * The key should be 32 bytes (64 hex chars), with or without 0x prefix.
 */
export function signerFromPrivateKey(hexKey: string): Ed25519Signer {
  const clean = hexKey.replace(/^0x/, "");
  if (clean.length !== 64) {
    throw new Error(
      `Private key must be 32 bytes (64 hex chars), got ${clean.length / 2} bytes`
    );
  }
  const bytes = hexToBytes(clean);
  return new Ed25519Signer(bytes);
}

/**
 * Create a signer by deriving an Ed25519 private key from a BIP-39 mnemonic.
 * Uses SLIP-0010 master key derivation ("ed25519 seed" HMAC-SHA512).
 */
export function signerFromMnemonic(mnemonic: string): Ed25519Signer {
  const seed = mnemonicToSeedSync(mnemonic.trim());
  // SLIP-0010: I = HMAC-SHA512(Key="ed25519 seed", Data=seed)
  const I = hmac(sha512, Buffer.from("ed25519 seed"), seed);
  const privateKey = I.slice(0, 32);
  return new Ed25519Signer(privateKey);
}

/**
 * Load a signer from environment variables.
 * Prefers SIGNER_PRIVATE_KEY; falls back to SIGNER_MNEMONIC.
 */
export function signerFromEnv(): Ed25519Signer {
  const rawKey = process.env.SIGNER_PRIVATE_KEY?.trim();
  if (rawKey) return signerFromPrivateKey(rawKey);

  const mnemonic = process.env.SIGNER_MNEMONIC?.trim();
  if (mnemonic) return signerFromMnemonic(mnemonic);

  throw new Error(
    "No signing key configured. Set SIGNER_PRIVATE_KEY or SIGNER_MNEMONIC in .env"
  );
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex.replace(/^0x/, ""), "hex"));
}

export function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Buffer.from(bytes).toString("hex");
}
