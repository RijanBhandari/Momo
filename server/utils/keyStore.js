// Map structure: sessionId (string) -> derivedKey (Buffer)

// const keyStore = new Map();
// module.exports = keyStore;

const sessions = new Map();

// Session duration
const SESSION_TTL = 60 * 60 * 1000;

// Background sweep every 10 minutes to clear expired keys from RAM
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now > session.expiresAt) {
            sessions.delete(sessionId);
        }
    }
}, 10*60*1000);

module.exports = {
    set(sessionId, key) {
        sessions.set(sessionId, {
            encryptionKey: key,
            expiresAt: Date.now() + SESSION_TTL
        });
    },
    get(sessionId) {
        const session = sessions.get(sessionId);
        if (!session) return null;

        if (Date.now() > session.expiresAt) {
            session.delete(sessionId);
            return null;
        }
        return session.encryptionKey;
    },
    delete(sessionId) {
        sessions.delete(sessionId);
    }
};