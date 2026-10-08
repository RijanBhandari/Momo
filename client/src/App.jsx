import { useState, useEffect } from 'react';
import Login from './Login';

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState('');

  // Automatically test token against protected endpoint when token exists
  useEffect(() => {
    if (!token) return;

    fetch('http://localhost:4000/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session invalid or expired');
        return res.json();
      })
      .then((data) => setUserInfo(data))
      .catch((err) => {
        setError(err.message);
        handleLogout();
      });
  }, [token]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    setUserInfo(null);
  };

  if (!token) {
    return <Login onLoginSuccess={(newToken) => setToken(newToken)} />;
  }

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Dashboard</h2>
      {userInfo ? (
        <div>
          <p><strong>Status:</strong> Authenticated</p>
          <p><strong>User ID:</strong> {userInfo.userId}</p>
          <p><strong>Encryption Key Status:</strong> {userInfo.hasEncryptionKey ? 'Loaded in RAM' : 'Missing'}</p>
          <button onClick={handleLogout} style={{ padding: '8px 16px', marginTop: '12px' }}>
            Log Out
          </button>
        </div>
      ) : (
        <p>Loading session data...</p>
      )}
    </div>
  );
}