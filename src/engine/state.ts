import type { Game, Player, Property, Auction } from '../lib/prisma'
import { prisma } from '../lib/prisma'
import { getTile } from '../../config/board'
import type { GameSnapshot } from './types'

type FullGame = Game & {
  players: (Player & { user: { name: string } })[]
  properties: Property[]
  auctions: Auction[]
}

export async function buildGameSnapshot(gameId: string): Promise<GameSnapshot> {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      players: { include: { user: { select: { name: true } } } },
      properties: true,
      auctions: { where: { status: 'ACTIVE' } },
    },
  })

  const activeAuction = game.auctions[0] ?? null

  return {
    gameId: game.id,
    code: game.code,
    status: game.status as GameSnapshot['status'],
    phase: game.phase as GameSnapshot['phase'],
    currentPlayerId: game.currentPlayerId,
    turnNumber: game.turnNumber,
    turnStartedAt: game.turnStartedAt?.toISOString() ?? null,
    afkTimeoutSeconds: game.afkTimeoutSeconds,
    doublesStreak: game.doublesStreak,
    players: game.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      position: p.position,
      cash: p.cash,
      turnOrder: p.turnOrder,
      isInJail: p.isInJail,
      jailTurns: p.jailTurns,
      isBankrupt: p.isBankrupt,
      jailFreeCards: p.jailFreeCards,
    })),
    properties: game.properties.map((p) => ({
      tileIndex: p.tileIndex,
      tileName: getTile(p.tileIndex).name,
      ownerId: p.ownerId,
      houses: p.houses,
      hasHotel: p.hasHotel,
      isMortgaged: p.isMortgaged,
    })),
    activeAuction: activeAuction
      ? {
          id: activeAuction.id,
          propertyTileIndex: activeAuction.propertyTileIndex,
          propertyName: getTile(activeAuction.propertyTileIndex).name,
          status: activeAuction.status as 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
          highestBid: activeAuction.highestBid,
          highestBidderId: activeAuction.highestBidderId,
          endsAt: activeAuction.endsAt.toISOString(),
        }
      : null,
  }
}
