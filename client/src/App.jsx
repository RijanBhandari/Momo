import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState("Connecting to backend...");

  useEffect(()=>{
    fetch('http://localhost:4000/health')
    .then((res) => res.json())
    .then((data) => {
      if (data.ok){
        setStatus('Connected to backend successfully');
      } else{
        setStatus('Server responded, but status is not OK.')
      }
    })
    .catch((err) => {
      console.error('Fetch error:', err);
      setStatus('Failed to connect to backend.');
    });
  }, []
  );

  return (
    <div style={{padding: '2rem', fontFamily: 'sans-serif'}}>
      <h1>Journal App</h1>
      <p>
        Backend Status: <strong>{status}</strong>
      </p>
    </div>
  )
}

export default App
