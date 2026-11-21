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

        if (typeof body !== 'string') {
            return res.status(400).json({ error: 'Body is a required field.' });
        }

        // Encrypt each field independently (each gets its own unique IV)
        const encryptedTitle = title ? encryptField(title, sessionKey) : undefined;
        const encryptedExcerpt = excerpt ? encryptField(excerpt, sessionKey) : undefined;
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
                decryptedTitle = decryptField(entry.title, sessionKey) || '';
                decryptedExcerpt = decryptField(entry.excerpt, sessionKey) || '';
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

// GET /entries/dates - List this user's entry dates without decrypting fields
router.get('/dates', auth, async (req, res) => {
    try {
        const entries = await Entry.find({ userId: req.userId })
            .select('date -_id')
            .sort({ date: 1 });

        res.status(200).json(entries.map(entry => entry.date));
    } catch (error) {
        console.error('Failed to fetch entry dates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /entries/range - Fetch and decrypt entries by date range or explicit dates
router.get('/range', auth, async (req, res) => {
    try {
        const sessionKey = req.encryptionKey;
        const { start, end } = req.query;
        const requestedDates = req.query.dates;
        let dateFilter;

        if (start !== undefined || end !== undefined) {
            if (typeof start !== 'string' || typeof end !== 'string') {
                return res.status(400).json({ error: 'Both start and end dates are required.' });
            }

            const startDate = new Date(start);
            const endDate = new Date(end);
            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
                return res.status(400).json({ error: 'A valid start and end date are required.' });
            }

            // Treat YYYY-MM-DD endpoints as whole UTC calendar days.
            if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
                endDate.setUTCDate(endDate.getUTCDate() + 1);
                dateFilter = { $gte: startDate, $lt: endDate };
            } else {
                dateFilter = { $gte: startDate, $lte: endDate };
            }
        } else if (requestedDates !== undefined) {
            const dates = (Array.isArray(requestedDates) ? requestedDates : [requestedDates])
                .flatMap(value => value.split(','))
                .map(value => value.trim());

            if (!dates.length || dates.some(value => !value || Number.isNaN(new Date(value).getTime()))) {
                return res.status(400).json({ error: 'The dates parameter must contain valid dates.' });
            }

            dateFilter = {
                $or: dates.map(value => {
                    const date = new Date(value);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                        const nextDate = new Date(date);
                        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
                        return { date: { $gte: date, $lt: nextDate } };
                    }
                    return { date };
                })
            };
        } else {
            return res.status(400).json({ error: 'Provide start and end dates or a dates parameter.' });
        }

        const entryFilter = dateFilter.$or
            ? { userId: req.userId, ...dateFilter }
            : { userId: req.userId, date: dateFilter };
        const entries = await Entry.find(entryFilter).sort({ date: 1 });
        const decryptedEntries = entries.map(entry => ({
            _id: entry._id,
            date: entry.date,
            title: decryptField(entry.title, sessionKey) || '',
            excerpt: decryptField(entry.excerpt, sessionKey) || '',
            body: decryptField(entry.body, sessionKey),
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt
        }));

        res.status(200).json(decryptedEntries);
    } catch (error) {
        console.error('Failed to fetch entries by date:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/search', auth, async (req, res) => {
    try {
        const sessionKey = req.encryptionKey;
        const searchQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (!searchQuery) return res.status(200).json({ matches: [], truncated: false });

        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = [];
        let truncated = false;
        const cursor = Entry.find({ userId: req.userId })
            .select('date title excerpt body')
            .sort({ date: -1 })
            .lean()
            .cursor({ batchSize: 50 });

        try {
          for await (const entry of cursor) {
            try {
                const title = decryptField(entry.title, sessionKey) || '';
                const excerpt = decryptField(entry.excerpt, sessionKey) || '';
                const body = decryptField(entry.body, sessionKey) || '';
                let entryMatchCount = 0;
                for (const [field, text] of [['body', body], ['title', title], ['excerpt', excerpt]]) {
                    const expression = new RegExp(escapedQuery, 'gi');
                    for (const match of text.matchAll(expression)) {
                        if (entryMatchCount >= 20 || matches.length >= 200) {
                            truncated = true;
                            break;
                        }
                        const matchStart = match.index;
                        const matchLength = match[0].length;
                        const snippetStart = Math.max(0, matchStart - 50);
                        const snippetEnd = Math.min(text.length, matchStart + matchLength + 70);
                        const leadingEllipsis = snippetStart > 0 ? '…' : '';
                        matches.push({
                            date: entry.date,
                            field,
                            start: matchStart,
                            length: matchLength,
                            snippet: `${leadingEllipsis}${text.slice(snippetStart, snippetEnd)}${snippetEnd < text.length ? '…' : ''}`,
                            snippetStart: matchStart - snippetStart + leadingEllipsis.length
                        });
                        entryMatchCount += 1;
                    }
                    if (truncated) break;
                }
            } catch (err) {
                // Corrupt or legacy entries should not prevent searching the rest.
            }
            if (truncated) break;
          }
        } finally {
            await cursor.close();
        }

        res.status(200).json({ matches, truncated });
    } catch (error) {
        console.error('Search failed:', error);
        res.status(500).json({error: 'Internal server error' });
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
        const decryptedTitle = decryptField(entry.title, sessionKey) || '';
        const decryptedExcerpt = decryptField(entry.excerpt, sessionKey) || '';
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

router.put('/:id', auth, async (req, res) => {
    try {
        const sessionKey = req.encryptionKey;
        const entryId = req.params.id;
        const {title, excerpt, body, date } = req.body;

        const entry = await Entry.findById(entryId);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found.' });
        }

        if (entry.userId.toString() != req.userId.toString()) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        if (title !== undefined) entry.title = title ? encryptField(title, sessionKey) : undefined;
        if (excerpt !== undefined) entry.excerpt = excerpt ? encryptField(excerpt, sessionKey) : undefined;
        if (body !== undefined) entry.body = encryptField(body, sessionKey);
        if (date) entry.date = date;

        await entry.save();

        res.status(200).json({
            message: 'Entry updated successfully',
            entryId: entry._id
        });
    } catch (error) {
        console.error('Failed to update entry:', error);
        res.status(500).json({error: 'Internal server error' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const entryId = req.params.id;

        const entry = await Entry.findById(entryId);
        if (!entry) {
            return res.status(404).json({ error: 'Entry not found. '});
        }

        if (entry.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        await Entry.findByIdAndDelete(entryId);

        res.status(200).json({ message: 'Entry deleted successfully' });
    } catch (error) {
        console.error('Failed to delete entry:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
