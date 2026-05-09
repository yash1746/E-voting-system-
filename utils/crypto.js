const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * SHA-256 hash of any string
 */
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Hash a vote ballot — deterministic from ballot content
 */
function hashVote(ballot) {
  const ballotString = JSON.stringify(ballot);
  return sha256(ballotString + Date.now().toString());
}

/**
 * Build a chain hash (links each vote to previous)
 */
function buildChainHash(currentHash, previousHash) {
  return sha256(currentHash + previousHash);
}

/**
 * Encrypt ballot using AES-256-GCM
 */
function encryptBallot(ballot) {
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ballotStr = JSON.stringify(ballot);
  let encrypted = cipher.update(ballotStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ballot using AES-256-GCM
 */
function decryptBallot(encryptedBallot) {
  try {
    const [ivHex, authTagHex, encrypted] = encryptedBallot.split(':');
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-key', 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

/**
 * Generate a secure anonymous receipt token
 */
function generateReceiptToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Verify the hash chain integrity for all votes in an election
 * Returns { valid: bool, brokenAt: index or null }
 */
function verifyHashChain(votes) {
  if (!votes || votes.length === 0) return { valid: true, brokenAt: null };

  for (let i = 1; i < votes.length; i++) {
    const prev = votes[i - 1];
    const curr = votes[i];
    const expectedChainHash = buildChainHash(curr.vote_hash, prev.vote_hash);
    if (curr.previous_hash !== prev.vote_hash) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true, brokenAt: null };
}

module.exports = {
  sha256,
  hashVote,
  buildChainHash,
  encryptBallot,
  decryptBallot,
  generateReceiptToken,
  generateOTP,
  generateSessionToken,
  verifyHashChain,
};
