import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export default function Editor({ entryId, onSave, onCancel }) {
    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // If an entryId is provided, fetch its full details for editing
    useEffect(() => {
        if (!entryId) return;

        async function fetchEntry() {
            try {
                setLoading(true);
                const res = await apiFetch(`/api/entries/${entryId}`);
                if (!res.ok) throw new Error('Failed to fetch entry details');
                const data = await res.json();
                setTitle(data.title || '');
                setExcerpt(data.excerpt || '');
                setBody(data.body || '');
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchEntry();
    }, [entryId]);

    //Hadle Save (Create or Update)
    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try{
            const endpoint = entryId ? `/api/entries/${entryId}` : '/api/entries';
            const method = entryId ? 'PUT' : 'POST';

            const res = await apiFetch(endpoint, {
                method,
                body: JSON.stringify({ title, excerpt, body }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save entry');
            }

            //Notify parent component to return to list / refresh
            if (onSave) onSave();

        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };
    
    // Handle Delete
    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this entry? This action cannot be undone.')){
            return;
        }

        setSaving(true);
        setError('');

        try {
            const res = await apiFetch(`/api/entries/${entryId}`, {
                method: 'DELETE'
            });

            if (!res.ok){
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete entry');
            }

            if (onSave) onSave();
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };


if (loading) return <p>Loading entry...</p>;

return (
    <div style={{maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h3>{entryId ? 'Entry Journal Entry' : 'New Journal Entry'}</h3>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <form onSubmit={handleSave} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Title</label>
                <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '8px' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Excerpt (Optional summary)</label>
                <input
                    type="text"
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="A brief preview of your thoughts..."
                    style={{ width: '100%', padding: '8px' }}
                    />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Body</label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows="10"
                    required
                    style={{ width: '100%', padding: '8px' }}
                    />
            </div>


            
            <div styles={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{display: 'flex', gap: '10px' }}>
                    <button type="submit" disabled={saving} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                        {saving ? 'Saving...' : 'Save Entry'}
                    </button>
                    {onCancel && (
                        <button type="button" onClick={onCancel} style={{ padding: '10px 20px', cursor: 'pointer'}}>
                            Cancel
                        </button>
                    )}
                </div>

                {/* Delete button only appears if editing an existing entry */}
                {entryId && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving}
                        style={{ padding: '10px 20px', cursor:'pointer' , backgroundColor:'#dc3545', color:'#fff', border: 'none', borderRadius: '4px' }}
                        >
                            Delete
                        </button>
                )}
            </div>
        </form>
    </div>
);
}