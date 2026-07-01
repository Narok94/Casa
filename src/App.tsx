import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-base-bg w-full max-w-[414px] mx-auto relative shadow-2xl">Carregando...</div>;
  }

  return user ? <Dashboard user={user} onLogout={handleLogout} /> : <Login onLogin={setUser} />;
}
