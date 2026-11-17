const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a plaintext string.
 * @param {string} paintext - The text to encrypt
 * @param {Buffer} key - The 32-byte session encryption key
 * @returns {Object} {ciphertext, iv, authTag } as hex strings
 */

function encryptField(plaintext, key){
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        ciphertext,
        iv: iv.toString('hex'),
        authTag
    };
}

/**
 * Decrypts an encrypted field object.
 * Automatically throws an error if the authTag fails (data tampered or wrong key).
 * @param {object} encryptedObj - {ciphertext, iv, authTag } in hex format
 * @param {Buffer} key - The 32-byte session encryption key
 * @returns {string} The decrypted plaintext string
 */

function decryptField({ ciphertext, iv, authTag }, key) {
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
}

module.exports = {
    encryptField,
    decryptField,
}
