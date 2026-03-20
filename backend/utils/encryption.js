const crypto = require("crypto");

// AES-256-GCM config
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex"); // 32 bytes
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes for GCM

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + ciphertext and encode in Base64
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(payload) {
  const data = Buffer.from(payload, "base64");

  const iv = data.slice(0, IV_LENGTH);
  const authTag = data.slice(IV_LENGTH, IV_LENGTH + 16); // 16 bytes auth tag
  const encryptedText = data.slice(IV_LENGTH + 16);

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
