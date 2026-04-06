/**
 * crypto/signer.ts
 * Ed25519 key management for Farcaster message signing.
 * Supports raw private key (hex) and BIP-39 mnemonic via SLIP-0010.
 */

import { NobleEd25519Signer, type Ed25519Signer } from "@farcaster/hub-nodejs";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha2";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";

const HEX_RE = /^[0-9a-f]+$/i;

function normalizeHex(
  hex: string,
  label: string,
  expectedBytes?: number
): string {
  const clean = hex.trim().replace(/^0x/i, "");
  if (!clean) {
    throw new Error(`${label} is empty.`);
  }
  if (clean.length % 2 !== 0) {
    throw new Error(`${label} must contain an even number of hex characters.`);
  }
  if (!HEX_RE.test(clean)) {
    throw new Error(`${label} must contain only hexadecimal characters.`);
  }
  if (expectedBytes != null && clean.length !== expectedBytes * 2) {
    throw new Error(
      `${label} must be ${expectedBytes} bytes (${expectedBytes * 2} hex chars), got ${clean.length / 2} bytes.`
    );
  }
  return clean.toLowerCase();
}

/**
 * Create a signer from a raw hex-encoded Ed25519 private key.
 * The key should be 32 bytes (64 hex chars), with or without 0x prefix.
 */
export function signerFromPrivateKey(hexKey: string): Ed25519Signer {
  const clean = normalizeHex(hexKey, "Private key", 32);
  const bytes = hexToBytes(clean);
  return new NobleEd25519Signer(bytes);
}

/**
 * Create a signer by deriving an Ed25519 private key from a BIP-39 mnemonic.
 * Uses SLIP-0010 master key derivation ("ed25519 seed" HMAC-SHA512).
 */
export function signerFromMnemonic(mnemonic: string): Ed25519Signer {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, " ");
  if (!validateMnemonic(normalizedMnemonic, englishWordlist)) {
    throw new Error("Mnemonic is not a valid BIP-39 English seed phrase.");
  }

  const seed = mnemonicToSeedSync(normalizedMnemonic);
  // SLIP-0010: I = HMAC-SHA512(Key="ed25519 seed", Data=seed)
  const I = hmac(sha512, Buffer.from("ed25519 seed"), seed);
  const privateKey = I.slice(0, 32);
  return new NobleEd25519Signer(privateKey);
}

/**
 * Load a signer from environment variables.
 * Prefers SIGNER_PRIVATE_KEY; falls back to SIGNER_MNEMONIC.
 */
export function signerFromEnv(): Ed25519Signer {
  const rawKey = process.env.SIGNER_PRIVATE_KEY?.trim();
  const mnemonic = process.env.SIGNER_MNEMONIC?.trim();

  if (rawKey && mnemonic) {
    throw new Error(
      "Set either SIGNER_PRIVATE_KEY or SIGNER_MNEMONIC in .env, not both."
    );
  }
  if (rawKey) return signerFromPrivateKey(rawKey);
  if (mnemonic) return signerFromMnemonic(mnemonic);

  throw new Error(
    "No signing key configured. Set SIGNER_PRIVATE_KEY or SIGNER_MNEMONIC in .env"
  );
}

export function hexToBytes(hex: string, label = "Hex value"): Uint8Array {
  return new Uint8Array(Buffer.from(normalizeHex(hex, label), "hex"));
}

export function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Buffer.from(bytes).toString("hex");
}
