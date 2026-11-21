import { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import EntryList from './components/EntryList'

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState('');
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationStatusLoaded, setRegistrationStatusLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('http://localhost:4000/api/auth/registration-status')
      .then((res) => res.json())
      .then((data) => setRegistrationEnabled(data.enabled === true))
      .catch(() => setRegistrationEnabled(false))
      .finally(() => setRegistrationStatusLoaded(true));
  }, []);

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
      .catch(() => {
        setError('Your session has expired. Please sign in again.');
        handleLogout();
      });
  }, [token]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    setUserInfo(null);
  };

  if (!token) {
    const onLoginSuccess = (newToken) => setToken(newToken);
    if (window.location.pathname === '/register') {
      if (!registrationStatusLoaded) return <p>Loading…</p>;
      if (registrationEnabled) return <Register onLoginSuccess={onLoginSuccess} />;
      window.history.replaceState({}, '', '/');
    }
    return <Login
      onLoginSuccess={onLoginSuccess}
      registrationEnabled={registrationEnabled && registrationStatusLoaded}
    />;
  }

  return (
    <div className={`App${sidebarOpen ? ' sidebar-open' : ''}`}>
      <button className="mobile-menu-toggle" type="button" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>
        {sidebarOpen ? 'Close' : 'Menu'}
      </button>
      {error && <p className="app-error">{error}</p>}
      <EntryList onLogout={handleLogout} onCloseSidebar={() => setSidebarOpen(false)} />
    </div>
  );
}
