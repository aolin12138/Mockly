import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const TAG_LENGTH = 16; // GCM auth tag length

/**
 * Get the encryption key from environment variable.
 * Must be a 32-byte key encoded as base64.
 */
function getEncryptionKey() {
  const keyBase64 = process.env.ELEVENLABS_KEY_ENC_KEY;
  if (!keyBase64) {
    throw new Error('ELEVENLABS_KEY_ENC_KEY environment variable is not set');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('ELEVENLABS_KEY_ENC_KEY must be a 32-byte key (base64 encoded)');
  }
  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param {string} plaintext - The string to encrypt
 * @returns {{ ciphertext: Buffer, iv: Buffer, tag: Buffer }}
 */
export function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv,
    tag
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 * @param {Buffer} ciphertext
 * @param {Buffer} iv
 * @param {Buffer} tag
 * @returns {string} The decrypted plaintext
 */
export function decrypt(ciphertext, iv, tag) {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
