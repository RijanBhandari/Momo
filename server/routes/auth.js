const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const router = express.Router();

const util = require('util')
const jwt = require('jsonwebtoken');
const keyStore = require('../utils/keyStore')

//Promisify callback-based crypto.scrypt to support async/await
const scryptAsync = util.promisify(crypto.scrypt)

// Middle ware test
const authMiddleware = require('../middleware/auth');

router.post('/register', async(req, res) => {
    try{
        const {username, password} = req.body;

        if (!username || !password){
            return res.status(400).json({error: "Username and password are required."});
        }

        if (password.length < 6){
            return res.status(400).json({error: 'Password must be at least 6 characters.'});
        }

        const existingUser = await User.findOne({ username });
        if (existingUser){
            return res.status(400).json({error: 'Username is already taken.'});
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const encryptionSalt = crypto.randomBytes(16).toString('hex');

        const newUser = new User(
            {
                username,
                passwordHash,
                encryptionSalt,
            }
        );

        await newUser.save();

        res.status(201).json({message: 'User registered successfully.'});


    }
    catch (error){
        console.error('Registration error:', error);
        res.status(500).json({error: 'Internal server error.'});
    }
});

router.post('/login', async (req, res) => {
    try{
        const {username, password} = req.body;

        if (!username || !password){
            return res.status(400).json({error: 'Username and password are required.'})
        }

        const user = await User.findOne({ username });

        if (!user){
            return res.status(401).json({error: 'Invalid credentials. '});
        }
        // Verify identity using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid){
            return res.status(401).json({error: 'Invalid credentials. '});
        }
        // Derive 32-byte AES key using scrypt
        const derivedKey = await scryptAsync(password, user.encryptionSalt, 32);
        // Generate unique session ID
        const sessionId = crypto.randomUUID();

        // Store key in ram indexed by sessionId
        keyStore.set(sessionId, derivedKey);

        // Sign JWT containing userId and sessionId
        const token = jwt.sign(
            {userId: user._id, sessionId },
            process.env.JWT_SECRET,
            {expiresIn: '8h'}
        );

        // Return JWT token to client
        res.json({
            message: 'Login successful.',
            token,
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({error: 'Internal server error.'});
    }
});

// GET /api/auth/me (protected route test)
router.get('/me', authMiddleware, (req, res) => {
    res.json({
        message: 'Protected route accessed successfully!',
        userId: req.userId,
        hasEncryptionKey: Boolean(req.encryptionKey),
    });
});


module.exports = router;

