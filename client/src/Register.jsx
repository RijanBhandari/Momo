import { useState } from 'react';

export default function Register({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const registerResponse = await fetch('http://localhost:4000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const registerData = await registerResponse.json();
      if (!registerResponse.ok) {
        throw new Error(registerData.error || 'Registration failed.');
      }

      const loginResponse = await fetch('http://localhost:4000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const loginData = await loginResponse.json();
      if (!loginResponse.ok) {
        throw new Error(loginData.error || 'Registration succeeded, but login failed.');
      }

      sessionStorage.setItem('token', loginData.token);
      onLoginSuccess(loginData.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Register</h2>
      {error && <div role="alert" style={{ color: 'red', marginBottom: '12px' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="register-username" style={{ display: 'block', marginBottom: '4px' }}>Username:</label>
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="register-password" style={{ display: 'block', marginBottom: '4px' }}>Password:</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
          {loading ? 'Registering…' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: '16px', textAlign: 'center' }}>
        Already registered? <a href="/">Log in</a>
      </p>
    </div>
  );
}
