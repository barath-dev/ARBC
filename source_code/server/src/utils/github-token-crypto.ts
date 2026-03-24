import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

/**
 * Returns a 32-byte key derived from GITHUB_TOKEN_ENCRYPTION_KEY env var.
 * Accepts either a 64-char hex string (raw 32 bytes) or any string (scrypt-derived).
 */
function getKey(): Buffer {
    const raw = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY env var is not set. Cannot encrypt/decrypt GitHub tokens.");
    }
    // If it looks like a 64-char hex string, use it directly.
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        return Buffer.from(raw, "hex");
    }
    // Otherwise derive a key with a static salt (acceptable here since the
    // passphrase itself is the secret and must stay private in env).
    return scryptSync(raw, "arbc-gh-token-salt", 32);
}

/**
 * Encrypts a plaintext token using AES-256-GCM.
 * Returns a base64 string: <12-byte IV> + <ciphertext> + <16-byte auth tag>
 */
export function encryptToken(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/**
 * Decrypts a base64 token string produced by `encryptToken`.
 * Returns the original plaintext string.
 */
export function decryptToken(ciphertext: string): string {
    const key = getKey();
    const data = Buffer.from(ciphertext, "base64");

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(data.length - TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final("utf8");
}
