import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export default function EntryList({ onSelectEntry }) {
    const [entries, setEntries] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEntries();
    }, []);

    const fetchEntries = async (query = '') => {
        try{
            setLoading(true);
            const endpoint = query ? `/api/entries/search?q=${encodeURIComponent(query)}` : '/api/entries';
            const res = await apiFetch(endpoint);
            const data = await res.json();
            setEntries(data);
        } catch (err) {
            console.error('Failed to load entries', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchEntries(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    return (
        <div>
            <h2>My Entries</h2>
            <input
                type="text"
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
                {loading ? <p>Loading...</p> : entries.length === 0 ? (<p>No entries found. Click "+ New Entry" to write your first one!</p>) : (
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px'}}>
                        {entries.map((entry) => (
                            <li 
                                key={entry._id}
                                onClick={() => onSelectEntry(entry._id)}
                                style={{
                                    border: '1px solid #ddd',
                                    padding: '15px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    backgroundColor: '#fafafa',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                                > 
                                <small>{new Date(entry.date).toLocaleDateString()}</small>
                                <h3>{entry.title}</h3>
                                <p>{entry.excerpt}</p>
                            </li>
                        ))}
                    </ul>
                )}
        </div>
    );
}