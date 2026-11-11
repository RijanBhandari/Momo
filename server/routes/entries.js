const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const { encryptField, decryptField } = require('../utils/crypto')
const auth = require('../middleware/auth');

//Post /entries - Create new encrypted entry
router.post('/', auth, async (req, res) => {
    try{
        const { title, excerpt, body, date } = req.body;
        const sessionKey = req.encryptionKey;

        if (!title || !excerpt || !body) {
            return res.status(400).json({ error: 'Title, excerpt, and body are required fields.' });
        }

        // Encrypt each field independently (each gets its own unique IV)
        const encryptedTitle = encryptField(title, sessionKey);
        const encryptedExcerpt = encryptField(excerpt, sessionKey);
        const encryptBody = encryptField(body, sessionKey)

        const entry = new Entry({
            userId: req.userId,
            date: date || Date.now(),
            title: encryptedTitle,
            excerpt: encryptedExcerpt,
            body: encryptBody
        });

        await entry.save();

        res.status(201).json({
            message: 'Entry created successfully',
            entryId: entry._id
        });
    } catch (error) {
        console.error('Failed to create entry:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /entries - List all entries for the logged-in user (Decrypts title & excerpt only)
router.get('/', auth, async (req, res) => {
    try {
        const sessionKey = req.encryptionKey;

        //Fetch all entries belonging to this user, sorted by date (newest first)
        const entries = (await Entry.find({ userId: req.userId }).sort({ date: -1 }));

        // Map through entries and decrypt only title and excerpt for performance
        const decryptedEntries = entries.map(entry => {
            let decryptedTitle = 'Decryption Error';
            let decryptedExcerpt = 'Decryption Error';

            try {
                decryptedTitle = decryptField(entry.title, sessionKey);
                decryptedExcerpt = decryptField(entry.excerpt, sessionKey);
            } catch (err) {
                console.error(`Failed to decrypt entry ${entry._id}:`, err.message);
            }
            
            return {
                _id: entry._id,
                date: entry.date,
                title: decryptedTitle,
                excerpt: decryptedExcerpt,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            };
        });

        res.status(200).json(decryptedEntries);
    } catch (error) {
        console.error('Failed to fetch entries:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//GET /entries/:id - Fetch a single entry (Decrypts all fields + ownership security check)
router.get('/:id', auth, async (req, res) => {
    try {
        const sessionKey = req.encryptionKey;
        const entryId = req.params.id;

        const entry = await Entry.findById(entryId);

        if (!entry){
            return res.status(404).json({ error: 'Entry not found.' });
        }

        if (entry.userId.toString() != req.userId.toString()) {
            return res.status(403).json({ error: "Access denied." });
        }

        // Decrypt all three fields
        const decryptedTitle = decryptField(entry.title, sessionKey);
        const decryptedExcerpt = decryptField(entry.excerpt, sessionKey);
        const decryptedBody = decryptField(entry.body, sessionKey);

        res.status(200).json({
            _id: entry._id,
            date: entry.date,
            title: decryptedTitle,
            excerpt: decryptedExcerpt,
            body: decryptedBody,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        });
    } catch (error) {
        console.error('Failed to fetch single entry:', error);
        res.status(500).json({error: 'Internal server error' });
    }
});

module.exports = router;