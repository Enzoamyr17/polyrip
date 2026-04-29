import type { Server as SocketServer } from 'socket.io'
import type { AuthenticatedSocket } from '../socket-server'
import { prisma } from '../../lib/prisma'
import { createGame, joinGame, startGame } from '../../engine/game-init'
import { handleRoll } from '../../engine/actions/roll'
import { buyProperty, declineProperty } from '../../engine/actions/property'
import { placeBid } from '../../engine/actions/auction'
import { payJailFine, useJailFreeCard } from '../../engine/actions/jail'
import { buildGameSnapshot } from '../../engine/state'
import type {
  ClientJoinPayload,
  ClientStartPayload,
  ClientRollPayload,
  ClientBuyPayload,
  ClientDeclinePayload,
  ClientBidPayload,
  ClientJailFinePayload,
  ClientJailCardPayload,
} from '../../engine/types'

// Seen idempotency keys per game — cleared on server restart (intentional; restarts reset ephemeral state)
const seenKeys = new Map<string, Set<string>>()

function isDuplicate(gameId: string, key: string): boolean {
  if (!seenKeys.has(gameId)) seenKeys.set(gameId, new Set())
  const keys = seenKeys.get(gameId)!
  if (keys.has(key)) return true
  keys.add(key)
  return false
}

async function broadcastState(io: SocketServer, gameId: string) {
  const snapshot = await buildGameSnapshot(gameId)
  io.to(`game:${gameId}`).emit('game:state', snapshot)
}

export function registerGameHandlers(io: SocketServer, socket: AuthenticatedSocket) {
  const emit = (event: string, data: unknown) => socket.emit(event, data)
  const error = (code: string, message: string) => emit('game:error', { code, message })

  socket.on('game:create', async () => {
    try {
      const gameId = await createGame(socket.userId)
      const player = await prisma.player.findFirstOrThrow({
        where: { gameId, userId: socket.userId },
      })
      socket.playerId = player.id
      await socket.join(`game:${gameId}`)
      emit('game:created', { gameId })
      await broadcastState(io, gameId)
    } catch (e: any) {
      error('CREATE_FAILED', e.message)
    }
  })

  socket.on('game:join', async ({ gameId, token }: ClientJoinPayload) => {
    try {
      const player = await prisma.player.findFirst({ where: { gameId, userId: socket.userId } })

      if (player) {
        // Rejoin existing session
        socket.playerId = player.id
      } else {
        const playerId = await joinGame(gameId, socket.userId)
        socket.playerId = playerId
      }

      await socket.join(`game:${gameId}`)
      emit('game:joined', { gameId, playerId: socket.playerId })
      await broadcastState(io, gameId)
    } catch (e: any) {
      error('JOIN_FAILED', e.message)
    }
  })

  socket.on('game:start', async ({ gameId }: ClientStartPayload) => {
    try {
      await startGame(gameId, socket.userId)
      await broadcastState(io, gameId)
    } catch (e: any) {
      error('START_FAILED', e.message)
    }
  })

  socket.on('game:roll', async ({ gameId, idempotencyKey }: ClientRollPayload) => {
    if (!socket.playerId) return error('NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return

    const result = await handleRoll(gameId, socket.playerId)
    if (!result.ok) return error(result.errorCode!, result.error!)
    await broadcastState(io, gameId)
  })

  socket.on('game:buy', async ({ gameId, idempotencyKey }: ClientBuyPayload) => {
    if (!socket.playerId) return error('NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return

    const result = await buyProperty(gameId, socket.playerId)
    if (!result.ok) return error(result.errorCode!, result.error!)
    await broadcastState(io, gameId)
  })

  socket.on('game:decline', async ({ gameId, idempotencyKey }: ClientDeclinePayload) => {
    if (!socket.playerId) return error('NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return

    const result = await declineProperty(gameId, socket.playerId)
    if (!result.ok) return error(result.errorCode!, result.error!)
    await broadcastState(io, gameId)
  })

  socket.on('game:bid', async ({ gameId, amount, idempotencyKey }: ClientBidPayload) => {
    if (!socket.playerId) return error('NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return

    const result = await placeBid(gameId, socket.playerId, amount)
    if (!result.ok) return error(result.errorCode!, result.error!)
    await broadcastState(io, gameId)
  })

  socket.on('game:pay_jail', async ({ gameId, idempotencyKey }: ClientJailFinePayload) => {
    if (!socket.playerId) return error('NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return

    const result = await payJailFine(gameId, socket.playerId)
    if (!result.ok) return error(result.errorCode!, result.error!)
    await broadcastState(io, gameId)
  })

  socket.on('game:jail_card', async ({ gameId, idempotencyKey }: ClientJailCardPayload) => {
    if (!socket.playerId) return error('NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return

    const result = await useJailFreeCard(gameId, socket.playerId)
    if (!result.ok) return error(result.errorCode!, result.error!)
    await broadcastState(io, gameId)
  })

  socket.on('disconnect', () => {
    // Socket.io automatically removes from rooms on disconnect
    // Player state persists in DB — they can rejoin via game:join
  })
}
