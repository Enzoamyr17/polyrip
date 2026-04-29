import type { Game, Player, Property } from '../../lib/prisma'
import { prisma } from '../../lib/prisma'
import { combine, isGameInProgress, isAuctionActive, bidExceedsHighest, hasSufficientFunds, isNotBankrupt } from '../validator'
import { endTurn } from './turn'
import { nextSeq } from './roll'
import type { ActionResult } from '../types'

type FullGame = Game & { players: Player[]; properties: Property[] }

export async function triggerAuction(
  game: FullGame,
  decliningPlayer: Player,
  tileIndex: number,
  seq: number,
): Promise<ActionResult> {
  const endsAt = new Date(Date.now() + game.afkTimeoutSeconds * 1000)

  await prisma.$transaction([
    prisma.auction.create({
      data: {
        gameId: game.id,
        propertyTileIndex: tileIndex,
        status: 'ACTIVE',
        highestBid: 0,
        endsAt,
      },
    }),
    prisma.game.update({
      where: { id: game.id },
      data: { phase: 'AUCTION' },
    }),
    prisma.gameEvent.create({
      data: {
        gameId: game.id,
        playerId: decliningPlayer.id,
        sequenceNumber: seq,
        eventType: 'AUCTION_STARTED',
        payload: { tileIndex, endsAt: endsAt.toISOString() },
      },
    }),
  ])

  return { ok: true, events: ['AUCTION_STARTED'] }
}

export async function placeBid(gameId: string, playerId: string, amount: number): Promise<ActionResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, properties: true },
  })
  if (!game) return { ok: false, errorCode: 'GAME_NOT_FOUND', error: 'Game not found' }

  const player = game.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, errorCode: 'PLAYER_NOT_FOUND', error: 'Player not in game' }

  const auction = await prisma.auction.findFirst({
    where: { gameId, status: 'ACTIVE' },
  })

  const check = combine(
    isGameInProgress(game),
    isNotBankrupt(player),
    isAuctionActive(auction),
    bidExceedsHighest(auction!, amount),
    hasSufficientFunds(player, amount),
  )
  if (!check.ok) return check

  const seq = await nextSeq(gameId)

  await prisma.$transaction([
    prisma.auctionBid.create({
      data: { auctionId: auction!.id, playerId, amount },
    }),
    prisma.auction.update({
      where: { id: auction!.id },
      data: { highestBid: amount, highestBidderId: playerId },
    }),
    prisma.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq,
        eventType: 'AUCTION_BID_PLACED',
        payload: { auctionId: auction!.id, amount },
      },
    }),
  ])

  return { ok: true, events: ['AUCTION_BID_PLACED'] }
}

export async function resolveAuction(gameId: string): Promise<ActionResult> {
  const auction = await prisma.auction.findFirst({
    where: { gameId, status: 'ACTIVE' },
  })

  if (!auction) return { ok: false, errorCode: 'NO_ACTIVE_AUCTION', error: 'No active auction' }

  const seq = await nextSeq(gameId)

  if (!auction.highestBidderId || auction.highestBid === 0) {
    // No bids — property returns to bank, no change
    await prisma.$transaction([
      prisma.auction.update({ where: { id: auction.id }, data: { status: 'CANCELLED' } }),
      prisma.game.update({ where: { id: gameId }, data: { phase: 'WAITING_FOR_ROLL' } }),
      prisma.gameEvent.create({
        data: {
          gameId,
          sequenceNumber: seq,
          eventType: 'AUCTION_CANCELLED',
          payload: { auctionId: auction.id, reason: 'no_bids' },
        },
      }),
    ])
    return advanceTurnAfterAuction(gameId, seq + 1)
  }

  // Award property to highest bidder
  await prisma.$transaction([
    prisma.player.update({
      where: { id: auction.highestBidderId },
      data: { cash: { decrement: auction.highestBid } },
    }),
    prisma.property.upsert({
      where: { gameId_tileIndex: { gameId, tileIndex: auction.propertyTileIndex } },
      create: { gameId, tileIndex: auction.propertyTileIndex, ownerId: auction.highestBidderId },
      update: { ownerId: auction.highestBidderId },
    }),
    prisma.auction.update({ where: { id: auction.id }, data: { status: 'COMPLETED' } }),
    prisma.gameEvent.create({
      data: {
        gameId,
        playerId: auction.highestBidderId,
        sequenceNumber: seq,
        eventType: 'AUCTION_WON',
        payload: {
          auctionId: auction.id,
          tileIndex: auction.propertyTileIndex,
          amount: auction.highestBid,
        },
      },
    }),
  ])

  return advanceTurnAfterAuction(gameId, seq + 1)
}

async function advanceTurnAfterAuction(gameId: string, seq: number): Promise<ActionResult> {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true },
  })

  // After auction always advance to next player (declining player forfeits extra roll chance)
  return endTurn(gameId, game.currentPlayerId!, false)
}
