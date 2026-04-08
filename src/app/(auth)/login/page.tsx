'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1117' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-transparent.png" alt="Prometheus Beacon" className="mx-auto mb-4" style={{ maxWidth: '560px' }} />
        </div>

        {/* Card */}
        <div className="rounded-lg border p-6" style={{ background: '#161b22', borderColor: '#30363d' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8b949e' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-md border text-sm outline-none transition-colors"
                style={{
                  background: '#0d1117',
                  borderColor: '#30363d',
                  color: '#e6edf3',
                }}
                onFocus={e => (e.target.style.borderColor = '#58a6ff')}
                onBlur={e => (e.target.style.borderColor = '#30363d')}
                placeholder="admin"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#8b949e' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md border text-sm outline-none transition-colors"
                style={{
                  background: '#0d1117',
                  borderColor: '#30363d',
                  color: '#e6edf3',
                }}
                onFocus={e => (e.target.style.borderColor = '#58a6ff')}
                onBlur={e => (e.target.style.borderColor = '#30363d')}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="text-sm rounded-md px-3 py-2" style={{ color: '#f85149', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: '#58a6ff',
                color: '#0d1117',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#30363d' }}>
          Prometheus · Beacon
        </p>
      </div>
    </div>
  );
}
