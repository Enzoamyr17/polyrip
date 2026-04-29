'use client'
import { Board } from './Board'
import { ActionPanel } from './ActionPanel'
import type { GameSnapshot } from '../../src/engine/types'

interface Props {
  gameState: GameSnapshot
  myPlayerId: string | null
  lastError: { code: string; message: string } | null
  onEmit: (event: string, data?: unknown) => void
  onStartGame: () => void
  onLeave: () => void
  isRolling: boolean
}

export function GameView({ gameState, myPlayerId, lastError, onEmit, onStartGame, onLeave, isRolling }: Props) {
  const me = gameState.players.find((p) => p.id === myPlayerId)
  const isHost = me?.turnOrder === 1

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 shrink-0">
        <h1 className="font-bold text-gray-900">Polyrip</h1>
        <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
          {gameState.code}
        </span>
        <span className="text-xs text-gray-400 uppercase">{gameState.status}</span>
        {lastError && (
          <span className="text-xs text-red-500 font-medium ml-2">
            ⚠ {lastError.code}: {lastError.message}
          </span>
        )}
        <div className="flex-1" />
        {gameState.status === 'LOBBY' && isHost && (
          <button
            onClick={onStartGame}
            disabled={gameState.players.length < 2}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded disabled:opacity-50"
          >
            Start Game ({gameState.players.length} players)
          </button>
        )}
        {gameState.status === 'LOBBY' && !isHost && (
          <span className="text-xs text-gray-400 italic">Waiting for host to start...</span>
        )}
        {(gameState.status === 'ENDED' || gameState.status === 'ABANDONED') && (
          <span className="text-xs font-bold text-gray-600">Game Over</span>
        )}
        <button onClick={onLeave} className="text-xs text-gray-400 hover:text-gray-700">
          Leave
        </button>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2">
        {/* Board */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="w-full" style={{ maxWidth: 'min(calc(100vh - 80px), calc(100vw - 260px))' }}>
            <Board gameState={gameState} myPlayerId={myPlayerId} isRolling={isRolling} />
          </div>
        </div>

        {/* Side panel */}
        <div className="w-56 shrink-0 overflow-y-auto">
          <ActionPanel
            gameState={gameState}
            myPlayerId={myPlayerId}
            onEmit={onEmit}
          />
        </div>
      </div>
    </div>
  )
}
