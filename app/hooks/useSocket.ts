'use client'
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { GameSnapshot } from '../../src/engine/types'

export interface SocketError {
  code: string
  message: string
}

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameSnapshot | null>(null)
  const [lastError, setLastError] = useState<SocketError | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      console.log('[socket] no token — skipping connection')
      return
    }

    console.log('[socket] connecting with token:', token.slice(0, 20) + '...')
    const socket = io({ auth: { token } })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[socket] connected ✓  id:', socket.id)
      setConnected(true)
    })

    socket.on('connect_error', (err) => {
      console.error('[socket] connect_error:', err.message)
      setConnected(false)
    })

    socket.on('disconnect', (reason) => {
      console.warn('[socket] disconnected:', reason)
      setConnected(false)
    })

    socket.on('game:state', (snapshot: GameSnapshot) => {
      console.log('[socket] game:state  phase:', snapshot.phase, 'turn:', snapshot.turnNumber, 'players:', snapshot.players.length)
      setGameState(snapshot)
    })

    socket.on('game:error', (err: SocketError) => {
      console.warn('[socket] game:error', err.code, '—', err.message)
      setLastError(err)
    })

    socket.on('game:joined', ({ playerId: pid, gameId }: { gameId: string; playerId: string }) => {
      console.log('[socket] game:joined  gameId:', gameId, 'playerId:', pid)
      setPlayerId(pid)
    })

    socket.on('game:created', ({ gameId }: { gameId: string }) => {
      console.log('[socket] game:created  gameId:', gameId)
    })

    return () => {
      console.log('[socket] cleanup — disconnecting')
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [token])

  function emit(event: string, data?: unknown) {
    if (!socketRef.current?.connected) {
      console.warn('[socket] emit blocked — not connected. Event:', event)
      return
    }
    console.log('[socket] emit →', event, data ?? '')
    socketRef.current.emit(event, data)
    setLastError(null)
  }

  return { connected, gameState, lastError, playerId, emit }
}
