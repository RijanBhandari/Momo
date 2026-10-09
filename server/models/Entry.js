const mongoose = require('mongoose');

// Resuable schema for encrypted field
const encryptedFieldSchema = new mongoose.Schema(
    {
        ciphertext: { type: String, required: true },
        iv: { type: String, required: true},
        authTag: { type: String, required: true }
    },
    { _id: false } // So that mongoose doesn't generate id for sub documnets
);

const entrySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        title: {
            type: encryptedFieldSchema,
            required: true
        },
        excerpt: {
            type: encryptedFieldSchema,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Entry', entrySchema);