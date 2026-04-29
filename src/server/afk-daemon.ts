import type { Server as SocketServer } from 'socket.io'
import { prisma } from '../lib/prisma'
import { handleRoll } from '../engine/actions/roll'
import { resolveAuction } from '../engine/actions/auction'
import { advanceTurn, checkBankruptcy } from '../engine/actions/turn'
import { nextSeq } from '../engine/actions/roll'
import { buildGameSnapshot } from '../engine/state'
import { GAME_CONSTANTS } from '../../config/game-constants'

export function afkDaemon(io: SocketServer) {
  setInterval(async () => {
    await tickAfkCheck(io)
  }, GAME_CONSTANTS.AFK_POLL_INTERVAL_MS)
}

async function tickAfkCheck(io: SocketServer) {
  const now = new Date()

  // Check for expired auctions
  const expiredAuctions = await prisma.auction.findMany({
    where: { status: 'ACTIVE', endsAt: { lte: now } },
    select: { gameId: true },
  })

  for (const { gameId } of expiredAuctions) {
    try {
      await resolveAuction(gameId)
      const snapshot = await buildGameSnapshot(gameId)
      io.to(`game:${gameId}`).emit('game:state', snapshot)
    } catch {}
  }

  // Check for AFK players (turn timeout exceeded)
  const afkGames = await prisma.game.findMany({
    where: {
      status: 'IN_PROGRESS',
      phase: 'WAITING_FOR_ROLL',
      turnStartedAt: {
        lte: new Date(now.getTime() - GAME_CONSTANTS.DEFAULT_AFK_TIMEOUT_SECONDS * 1000),
      },
    },
    include: { players: true },
  })

  for (const game of afkGames) {
    if (!game.currentPlayerId) continue

    try {
      const seq = await nextSeq(game.id)
      await prisma.$transaction([
        prisma.gameEvent.create({
          data: {
            gameId: game.id,
            playerId: game.currentPlayerId,
            sequenceNumber: seq,
            eventType: 'TURN_SKIPPED_AFK',
            payload: { playerId: game.currentPlayerId },
          },
        }),
      ])

      // Track consecutive AFK skips using jailTurns field repurposed — or we count from events
      const recentAfk = await prisma.gameEvent.count({
        where: {
          gameId: game.id,
          playerId: game.currentPlayerId,
          eventType: 'TURN_SKIPPED_AFK',
        },
      })

      if (recentAfk >= GAME_CONSTANTS.MAX_AFK_SKIPS_BEFORE_BANKRUPTCY) {
        // Mark player bankrupt
        await prisma.player.update({
          where: { id: game.currentPlayerId },
          data: { isBankrupt: true, cash: 0 },
        })
        await prisma.property.updateMany({
          where: { gameId: game.id, ownerId: game.currentPlayerId },
          data: { ownerId: null },
        })
      }

      await advanceTurn(game.id, game.currentPlayerId)
      const snapshot = await buildGameSnapshot(game.id)
      io.to(`game:${game.id}`).emit('game:state', snapshot)
    } catch {}
  }
}
