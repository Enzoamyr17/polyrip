import { prisma } from '../../lib/prisma'
import { nextSeq } from './roll'
import type { ActionResult } from '../types'

export async function endTurn(gameId: string, currentPlayerId: string, isDoubles: boolean): Promise<ActionResult> {
  // Doubles: same player rolls again (unless they just went to jail)
  if (isDoubles) {
    await prisma.game.update({
      where: { id: gameId },
      data: { phase: 'WAITING_FOR_ROLL', turnStartedAt: new Date() },
    })
    return { ok: true }
  }

  return advanceTurn(gameId, currentPlayerId)
}

export async function advanceTurn(gameId: string, currentPlayerId: string): Promise<ActionResult> {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true },
  })

  const solventPlayers = game.players.filter((p) => !p.isBankrupt).sort((a, b) => a.turnOrder - b.turnOrder)

  if (solventPlayers.length <= 1) {
    return declareWinner(game.id, solventPlayers[0]?.id ?? null)
  }

  const currentIndex = solventPlayers.findIndex((p) => p.id === currentPlayerId)
  const nextPlayer = solventPlayers[(currentIndex + 1) % solventPlayers.length]

  await prisma.game.update({
    where: { id: gameId },
    data: {
      currentPlayerId: nextPlayer.id,
      turnNumber: { increment: 1 },
      phase: 'WAITING_FOR_ROLL',
      doublesStreak: 0,
      turnStartedAt: new Date(),
    },
  })

  return { ok: true }
}

export async function checkBankruptcy(gameId: string, playerId: string): Promise<boolean> {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
  if (player.cash >= 0) return false

  const seq = await nextSeq(gameId)
  await prisma.$transaction([
    prisma.player.update({ where: { id: playerId }, data: { isBankrupt: true, cash: 0 } }),
    prisma.property.updateMany({ where: { gameId, ownerId: playerId }, data: { ownerId: null } }),
    prisma.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq,
        eventType: 'PLAYER_BANKRUPT',
        payload: { playerId },
      },
    }),
  ])

  return true
}

async function declareWinner(gameId: string, winnerId: string | null): Promise<ActionResult> {
  const seq = await nextSeq(gameId)
  await prisma.$transaction([
    prisma.game.update({
      where: { id: gameId },
      data: { status: 'ENDED', phase: 'ENDED' },
    }),
    prisma.gameEvent.create({
      data: {
        gameId,
        sequenceNumber: seq,
        eventType: 'GAME_ENDED',
        payload: { winnerId },
      },
    }),
  ])

  return { ok: true, events: ['GAME_ENDED'] }
}
