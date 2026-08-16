const crypto = require('crypto');

// Standard encryption key from environment variable (or dummy for mock fallback)
const ENCRYPTION_KEY = process.env.MEDICAL_ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; // Must be 32 bytes
const IV_LENGTH = 12; // For AES-GCM
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:encrypted_content_hex
 */
const encrypt = (text) => {
  try {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Return combined representation
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
};

/**
 * Decrypt a combined AES-256-GCM ciphertext.
 * Ciphertext format: iv_hex:auth_tag_hex:encrypted_content_hex
 */
const decrypt = (ciphertext) => {
  try {
    if (!ciphertext) return null;
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      // Return raw if it wasn't encrypted or wrong format
      return ciphertext;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf-8'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return ciphertext; // Fallback to returning ciphertext to avoid breaking UI
  }
};

module.exports = {
  encrypt,
  decrypt
};
