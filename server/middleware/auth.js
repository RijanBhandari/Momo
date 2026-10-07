const jwt = require('jsonwebtoken');
const keyStore = require('../utils/keyStore');

const authMiddleware = (req, res, next) => {
    try {
        // Get authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        // Extract the token
        const token = authHeader.split(' ')[1];

        // Verify token authenticity
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        // retive encryption key from in-memory keyStore
        const encryptionKey = keyStore.get(decoded.sessionId);
        if (!encryptionKey) {
            return res.status(401).json({
                error: 'Session expired or server restarted. Please login again.'
            })
        }
        
        // Attach user context to request
        req.userId = decoded.userId;
        req.encryptionKey = encryptionKey;

        // pass control to the next handler or route
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.'});
    }
};

module.exports = authMiddleware;