const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const { entryptField, encryptField } = require('../utils/crypto')
const auth = require('../middleware/auth');

//Post /entries - Create new encrypted entry
router.post('/', auth, async (req, res) => {
    try{
        const { title, excerpt, body, date } = req.body;
        const sessionkey = req.encryptionKey;

        if (!title || !excerpt || !body) {
            return res.status(400).json({ error: 'Title, excerpt, and body are required fields.' });
        }

        // Encrypt each field independently (each gets its own unique IV)
        const encryptedTitle = encryptField(title, sessionkey);
        const encryptedExcerpt = encryptField(excerpt, sessionkey);
        const encryptBody = encryptField(body, sessionkey)

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

module.exports = router;