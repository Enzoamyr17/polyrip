'use client'
import { useState } from 'react'

interface Props {
  onToken: (token: string) => void
}

export function AuthForm({ onToken }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (mode === 'register') {
        setMode('login')
        setError('Registered! Please log in.')
        setLoading(false)
        return
      }

      onToken(data.token)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg border border-gray-200 p-8 w-full max-w-sm shadow">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Polyrip</h1>
        <p className="text-sm text-gray-500 mb-6">Monopoly Engine Test</p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            required
          />
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-gray-900 hover:bg-gray-700 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? '...' : mode === 'login' ? 'Log In' : 'Register'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          className="mt-4 text-xs text-gray-400 hover:text-gray-700 w-full text-center"
        >
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
