import { useState, useEffect } from 'react';
import Login from './Login';
import EntryList from './components/EntryList'
import Editor from './components/Editor';

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState('');

  // Navigation & Editor State
  const [currentView, setCurrentView] = useState('list');
  const [activeEntryId, setActiveEntryId] = useState(null);

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
    <div className="App" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h2
          style={{ cursor: 'pointer', margin: 0 }}
          onClick={() => { setCurrentView('list'); setActiveEntryId(null); }}
        >Momo Journal
        </h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {currentView == 'list' && (
            <button
              onClick={() => {setActiveEntryId(null); setCurrentView('editor');}}
              style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
              + New Entry
            </button>
          )}
        <botton onClick={handleLogout} style={{ padding: '8px 12px', cursor: 'pointer' }}>
            Log Out
        </botton>
        </div>
      </header>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Conditional view rendering */}
      {currentView === 'list' ? (
        <EntryList
          onSelectEntry={(id) => {
            setActiveEntryId(id);
            setCurrentView('editor');
        }}
        />
      ) : (
        <Editor
          entryId={activeEntryId}
          onSave={() => {
            setCurrentView('list');
            setActiveEntryId(null);
          }}
          onCancel={() => {
            setCurrentView('list');
            setActiveEntryId(null);
          }}
          />
        )}
    </div>
  );
}
