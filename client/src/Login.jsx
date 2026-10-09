import { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:4000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }), 
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed.');
            }

            // Store JWT token in sessionStorage
            sessionStorage.setItem('token', data.token);

            // Notify parent component login succeeded
            if (onLoginSuccess){
                onLoginSuccess(data.token);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '40px auto', fontFamily: 'sans-serif' }}>
            <h2>Log In</h2>

        {error && (
            <div style={{color: 'red', marginButtom: '12px', padding: '8px', border: '1px solid red', borderRadius: '4px'}}>
            {error}
            </div>
        )}

        <form onSubmit={handleSubmit}>
            <div style={{ marginButtom: '12px' }}>
                <label style={{display: 'block', marginButtom: '4px'}}>Username:</label>
                <input
                    type='text'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
            </div>
            <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
            <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color:'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                {loading ? 'Logging in...' : 'Login In'}
            </button>
        </form>
        </div>
    );
}