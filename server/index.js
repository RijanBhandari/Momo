const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express()

// Middleware
app.use(cors())
app.get('/health', (req, res) => {
    res.json({ok: true});
});

const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;

mongoose
.connect(MONGO_URI)
.then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, ()=> {
        console.log(`Server running on http://localhost:${PORT}`);
    });
})

.catch((err) => {
    console.error('MongoDB connection error', err);
});