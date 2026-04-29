'use client'
import { useState } from 'react'

interface Props {
  connected: boolean
  onCreate: () => void
  onJoin: (gameId: string) => void
  onLogout: () => void
}

export function Lobby({ connected, onCreate, onJoin, onLogout }: Props) {
  const [code, setCode] = useState('')

  function joinByCode() {
    if (code.trim()) onJoin(code.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg border border-gray-200 p-8 w-full max-w-sm shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Polyrip</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>
          <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-700">
            Logout
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={onCreate}
            disabled={!connected}
            className="bg-gray-900 hover:bg-gray-700 text-white rounded px-4 py-3 text-sm font-medium disabled:opacity-50 w-full"
          >
            Create New Game
          </button>

          <div className="flex items-center gap-2">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-400">or join</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Game code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="border rounded px-3 py-2 text-sm flex-1 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-gray-400"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
            />
            <button
              onClick={joinByCode}
              disabled={!connected || !code.trim()}
              className="bg-gray-600 hover:bg-gray-500 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              Join
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Share the game code with other players to have them join.
          </p>
        </div>
      </div>
    </div>
  )
}
