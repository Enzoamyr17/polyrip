import type { Server as SocketServer } from 'socket.io'
import type { AuthenticatedSocket } from '../socket-server'
import { prisma } from '../../lib/prisma'
import { log } from '../../lib/logger'
import { createGame, joinGame, startGame } from '../../engine/game-init'
import { handleRoll } from '../../engine/actions/roll'
import { buyProperty, declineProperty } from '../../engine/actions/property'
import { placeBid } from '../../engine/actions/auction'
import { payJailFine, useJailFreeCard } from '../../engine/actions/jail'
import { buildGameSnapshot } from '../../engine/state'
import type {
  ClientStartPayload,
  ClientRollPayload,
  ClientBuyPayload,
  ClientDeclinePayload,
  ClientBidPayload,
  ClientJailFinePayload,
  ClientJailCardPayload,
} from '../../engine/types'

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
  log.db('broadcast', `game:${gameId.slice(0, 8)} → ${io.sockets.adapter.rooms.get(`game:${gameId}`)?.size ?? 0} clients`)
}

export function registerGameHandlers(io: SocketServer, socket: AuthenticatedSocket) {
  const uid = socket.userId
  const sid = socket.id
  const reply = (event: string, data: unknown) => socket.emit(event, data)
  const sendError = (event: string, code: string, message: string) => {
    log.fail(event, code, message)
    reply('game:error', { code, message })
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  socket.on('game:create', async () => {
    log.action('game:create', uid)
    try {
      const gameId = await createGame(uid)
      log.db('createGame', `game:${gameId.slice(0, 8)}`)

      const player = await prisma.player.findFirstOrThrow({
        where: { gameId, userId: uid },
      })
      socket.playerId = player.id
      log.db('findPlayer', `player:${player.id.slice(0, 8)}`)

      await socket.join(`game:${gameId}`)
      // Emit game:joined so the client sets its playerId (same as the join flow)
      reply('game:joined', { gameId, playerId: player.id })
      reply('game:created', { gameId })
      await broadcastState(io, gameId)
      const created = await prisma.game.findUnique({ where: { id: gameId }, select: { code: true } })
      log.ok('game:create', `game:${gameId.slice(0, 8)} code:${created?.code}`)
    } catch (err) {
      log.error('game:create', err)
      sendError('game:create', 'CREATE_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  // ─── Join ─────────────────────────────────────────────────────────────────

  socket.on('game:join', async ({ code }: { code: string }) => {
    const upperCode = code?.toUpperCase?.() ?? ''
    log.action('game:join', uid, { code: upperCode })
    try {
      const game = await prisma.game.findUnique({ where: { code: upperCode } })
      if (!game) return sendError('game:join', 'GAME_NOT_FOUND', `No game with code "${upperCode}"`)
      log.db('findGame', `game:${game.id.slice(0, 8)} status:${game.status}`)

      const gameId = game.id
      const existing = await prisma.player.findFirst({ where: { gameId, userId: uid } })

      if (existing) {
        socket.playerId = existing.id
        log.db('rejoin', `player:${existing.id.slice(0, 8)}`)
      } else {
        const playerId = await joinGame(gameId, uid)
        socket.playerId = playerId
        log.db('joinGame', `player:${playerId.slice(0, 8)}`)
      }

      await socket.join(`game:${gameId}`)
      reply('game:joined', { gameId, playerId: socket.playerId })
      await broadcastState(io, gameId)
      log.ok('game:join', `user:${uid.slice(0, 8)} → game:${gameId.slice(0, 8)}`)
    } catch (err) {
      log.error('game:join', err)
      sendError('game:join', 'JOIN_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  // ─── Start ────────────────────────────────────────────────────────────────

  socket.on('game:start', async ({ gameId }: ClientStartPayload) => {
    log.action('game:start', uid, { game: gameId.slice(0, 8) })
    try {
      await startGame(gameId, uid)
      await broadcastState(io, gameId)
      log.ok('game:start', `game:${gameId.slice(0, 8)} started`)
    } catch (err) {
      log.error('game:start', err)
      sendError('game:start', 'START_FAILED', err instanceof Error ? err.message : String(err))
    }
  })

  // ─── Roll ─────────────────────────────────────────────────────────────────

  socket.on('game:roll', async ({ gameId, idempotencyKey }: ClientRollPayload) => {
    if (!socket.playerId) return sendError('game:roll', 'NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) {
      log.fail('game:roll', 'DUPLICATE', `key:${idempotencyKey.slice(0, 8)}`)
      return
    }
    log.action('game:roll', uid, { game: gameId.slice(0, 8), player: socket.playerId.slice(0, 8) })

    const result = await handleRoll(gameId, socket.playerId)
    if (!result.ok) return sendError('game:roll', result.errorCode!, result.error!)
    await broadcastState(io, gameId)
    log.ok('game:roll', `events:[${result.events?.join(',')}]`)
  })

  // ─── Buy ──────────────────────────────────────────────────────────────────

  socket.on('game:buy', async ({ gameId, idempotencyKey }: ClientBuyPayload) => {
    if (!socket.playerId) return sendError('game:buy', 'NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return
    log.action('game:buy', uid, { game: gameId.slice(0, 8), player: socket.playerId.slice(0, 8) })

    const result = await buyProperty(gameId, socket.playerId)
    if (!result.ok) return sendError('game:buy', result.errorCode!, result.error!)
    await broadcastState(io, gameId)
    log.ok('game:buy', `events:[${result.events?.join(',')}]`)
  })

  // ─── Decline ──────────────────────────────────────────────────────────────

  socket.on('game:decline', async ({ gameId, idempotencyKey }: ClientDeclinePayload) => {
    if (!socket.playerId) return sendError('game:decline', 'NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return
    log.action('game:decline', uid, { game: gameId.slice(0, 8), player: socket.playerId.slice(0, 8) })

    const result = await declineProperty(gameId, socket.playerId)
    if (!result.ok) return sendError('game:decline', result.errorCode!, result.error!)
    await broadcastState(io, gameId)
    log.ok('game:decline', `auction triggered`)
  })

  // ─── Bid ──────────────────────────────────────────────────────────────────

  socket.on('game:bid', async ({ gameId, amount, idempotencyKey }: ClientBidPayload) => {
    if (!socket.playerId) return sendError('game:bid', 'NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return
    log.action('game:bid', uid, { game: gameId.slice(0, 8), amount })

    const result = await placeBid(gameId, socket.playerId, amount)
    if (!result.ok) return sendError('game:bid', result.errorCode!, result.error!)
    await broadcastState(io, gameId)
    log.ok('game:bid', `$${amount}`)
  })

  // ─── Jail fine ────────────────────────────────────────────────────────────

  socket.on('game:pay_jail', async ({ gameId, idempotencyKey }: ClientJailFinePayload) => {
    if (!socket.playerId) return sendError('game:pay_jail', 'NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return
    log.action('game:pay_jail', uid, { game: gameId.slice(0, 8) })

    const result = await payJailFine(gameId, socket.playerId)
    if (!result.ok) return sendError('game:pay_jail', result.errorCode!, result.error!)
    await broadcastState(io, gameId)
    log.ok('game:pay_jail', `$50 paid`)
  })

  // ─── Jail card ────────────────────────────────────────────────────────────

  socket.on('game:jail_card', async ({ gameId, idempotencyKey }: ClientJailCardPayload) => {
    if (!socket.playerId) return sendError('game:jail_card', 'NO_PLAYER', 'Join a game first')
    if (isDuplicate(gameId, idempotencyKey)) return
    log.action('game:jail_card', uid, { game: gameId.slice(0, 8) })

    const result = await useJailFreeCard(gameId, socket.playerId)
    if (!result.ok) return sendError('game:jail_card', result.errorCode!, result.error!)
    await broadcastState(io, gameId)
    log.ok('game:jail_card', `card used`)
  })

  // ─── Disconnect ───────────────────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    log.disconnect(uid, sid)
    log.db('disconnect', `reason:${reason} player:${socket.playerId?.slice(0, 8) ?? 'none'}`)
  })
}
