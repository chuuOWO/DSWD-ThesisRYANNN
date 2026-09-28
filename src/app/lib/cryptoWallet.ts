import { ethers } from 'ethers';

const DEFAULT_MASTER_KEY_HEX = 'e4b9d031c5fae448b11c97a840e69888d30e386050bf991cf8813fa25036e789';

export const getMasterEncryptionKey = (): string => {
  const envKey = (typeof process !== 'undefined' && process.env?.WALLET_ENCRYPTION_MASTER_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WALLET_ENCRYPTION_MASTER_KEY);
  return envKey?.trim() || DEFAULT_MASTER_KEY_HEX;
};

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const len = clean.length;
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

async function getCryptoKey(masterKeyHex: string): Promise<CryptoKey> {
  const rawKey = hexToBytes(masterKeyHex);
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  return await cryptoObj.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedWalletPayload {
  walletAddress: string;
  encryptedPrivateKey: string;
  keyIv: string;
  keyAuthTag: string;
}

/**
 * Encrypts a private key using AES-256-GCM.
 * Compatible with Node.js crypto and Web Crypto API.
 */
export async function encryptPrivateKey(
  privateKey: string,
  customMasterKeyHex?: string
): Promise<{ ciphertext: string; iv: string; authTag: string }> {
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  const key = await getCryptoKey(customMasterKeyHex || getMasterEncryptionKey());

  // Generate 12-byte IV for AES-GCM
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(privateKey.trim());

  // Web Crypto encrypt produces ciphertext + 16-byte authTag appended at the end
  const encryptedBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128
    },
    key,
    plaintext
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const tagLength = 16;
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - tagLength);
  const authTagBytes = encryptedBytes.slice(encryptedBytes.length - tagLength);

  return {
    ciphertext: bytesToHex(ciphertextBytes),
    iv: bytesToHex(iv),
    authTag: bytesToHex(authTagBytes)
  };
}

/**
 * Decrypts a private key using AES-256-GCM and verifies the authentication tag.
 */
export async function decryptPrivateKey(
  ciphertextHex: string,
  ivHex: string,
  authTagHex: string,
  customMasterKeyHex?: string
): Promise<string> {
  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
  const key = await getCryptoKey(customMasterKeyHex || getMasterEncryptionKey());

  const iv = hexToBytes(ivHex);
  const ciphertextBytes = hexToBytes(ciphertextHex);
  const authTagBytes = hexToBytes(authTagHex);

  // Combine ciphertext + authTag for Web Crypto API
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combined.set(ciphertextBytes, 0);
  combined.set(authTagBytes, ciphertextBytes.length);

  try {
    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      combined
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Custodial key decryption failed: Integrity tag mismatch or invalid master key.');
  }
}

/**
 * Generates a fresh EVM wallet and encrypts its private key for custodial provisioning.
 */
export async function createAndEncryptCustodialWallet(
  customMasterKeyHex?: string
): Promise<EncryptedWalletPayload> {
  const randomWallet = ethers.Wallet.createRandom();
  const encrypted = await encryptPrivateKey(randomWallet.privateKey, customMasterKeyHex);

  return {
    walletAddress: randomWallet.address,
    encryptedPrivateKey: encrypted.ciphertext,
    keyIv: encrypted.iv,
    keyAuthTag: encrypted.authTag
  };
}
