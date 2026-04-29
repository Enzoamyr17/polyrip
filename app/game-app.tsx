'use client'
import { useState, useEffect } from 'react'
import { useSocket } from './hooks/useSocket'
import { AuthForm } from './components/AuthForm'
import { Lobby } from './components/Lobby'
import { GameView } from './components/GameView'

type View = 'auth' | 'lobby' | 'game'

export function GameApp() {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('polyrip_token')
  })
  const [view, setView] = useState<View>(token ? 'lobby' : 'auth')

  const { connected, gameState, lastError, playerId, emit } = useSocket(token)
  const [isRolling, setIsRolling] = useState(false)

  // Switch to game view whenever we receive a game state while in the lobby
  useEffect(() => {
    if (gameState && view === 'lobby') setView('game')
  }, [gameState, view])

  // Clear rolling state as soon as the server responds with new state
  useEffect(() => { setIsRolling(false) }, [gameState])

  function handleEmit(event: string, data?: unknown) {
    if (event === 'game:roll') setIsRolling(true)
    emit(event, data)
  }

  function handleToken(t: string) {
    localStorage.setItem('polyrip_token', t)
    setToken(t)
    setView('lobby')
  }

  function handleLogout() {
    localStorage.removeItem('polyrip_token')
    setToken(null)
    setView('auth')
  }

  function handleCreate() {
    emit('game:create')
  }

  function handleJoin(code: string) {
    emit('game:join', { code })
    // View switches automatically once game:state arrives via useEffect above
  }

  function handleStart() {
    if (!gameState) return
    emit('game:start', { gameId: gameState.gameId })
  }

  function handleLeave() {
    setView('lobby')
  }

  if (view === 'auth') return <AuthForm onToken={handleToken} />

  if (view === 'lobby' || !gameState) {
    return (
      <Lobby
        connected={connected}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <GameView
      gameState={gameState}
      myPlayerId={playerId}
      lastError={lastError}
      onEmit={handleEmit}
      onStartGame={handleStart}
      onLeave={handleLeave}
      isRolling={isRolling}
    />
  )
}
