import type { Game, Player, Property } from '../../lib/prisma'
import { prisma } from '../../lib/prisma'
import { combine, isCurrentPlayer, isGameInProgress, isPhase, hasSufficientFunds, isNotBankrupt } from '../validator'
import { endTurn } from './turn'
import { triggerAuction } from './auction'
import { drawCard } from './cards'
import { goToJail } from './jail'
import { nextSeq } from './roll'
import { BOARD_TILES, getTile, getTilesByGroup } from '../../../config/board'
import { GAME_CONSTANTS } from '../../../config/game-constants'
import type { ActionResult, DiceRoll, LandingResult } from '../types'

type FullGame = Game & { players: Player[]; properties: Property[] }

export async function processLanding(
  game: FullGame,
  player: Player,
  roll: DiceRoll,
  nextSequenceStart: number,
): Promise<ActionResult> {
  const tile = getTile(player.position)
  let seq = nextSequenceStart

  switch (tile.type) {
    case 'GO':
    case 'FREE_PARKING':
    case 'JAIL': {
      return endTurn(game.id, player.id, roll.isDoubles)
    }

    case 'GO_TO_JAIL': {
      return goToJail(game.id, player.id, seq)
    }

    case 'INCOME_TAX':
    case 'LUXURY_TAX': {
      const taxDue = tile.taxAmount!
      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { cash: { decrement: taxDue } } }),
        prisma.gameEvent.create({
          data: {
            gameId: game.id,
            playerId: player.id,
            sequenceNumber: seq,
            eventType: 'TAX_PAID',
            payload: { tileIndex: tile.index, amount: taxDue },
          },
        }),
      ])
      return endTurn(game.id, player.id, roll.isDoubles)
    }

    case 'CHANCE': {
      return drawCard(game, player, 'CHANCE', seq, roll)
    }

    case 'COMMUNITY_CHEST': {
      return drawCard(game, player, 'COMMUNITY_CHEST', seq, roll)
    }

    case 'RAILROAD':
    case 'UTILITY':
    case 'PROPERTY': {
      const property = game.properties.find((p) => p.tileIndex === tile.index)

      // Unowned — offer buy or auction
      if (!property || !property.ownerId) {
        await prisma.game.update({
          where: { id: game.id },
          data: { phase: 'AWAITING_ACTION' },
        })
        return { ok: true, events: ['PROPERTY_DECLINED'] }
      }

      // Owned by current player or mortgaged — no rent
      if (property.ownerId === player.id || property.isMortgaged) {
        return endTurn(game.id, player.id, roll.isDoubles)
      }

      // Pay rent
      const rentDue = calculateRent(tile, property, game.properties, game.players, roll)
      const owner = game.players.find((p) => p.id === property.ownerId)!

      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { cash: { decrement: rentDue } } }),
        prisma.player.update({ where: { id: owner.id }, data: { cash: { increment: rentDue } } }),
        prisma.gameEvent.create({
          data: {
            gameId: game.id,
            playerId: player.id,
            sequenceNumber: seq,
            eventType: 'RENT_PAID',
            payload: { tileIndex: tile.index, amount: rentDue, toPlayerId: owner.id },
          },
        }),
      ])

      return endTurn(game.id, player.id, roll.isDoubles)
    }

    default:
      return endTurn(game.id, player.id, roll.isDoubles)
  }
}

function calculateRent(
  tile: ReturnType<typeof getTile>,
  property: Property,
  allProperties: Property[],
  allPlayers: Player[],
  roll: DiceRoll,
): number {
  if (tile.type === 'RAILROAD') {
    const ownerRailroads = allProperties.filter(
      (p) => p.ownerId === property.ownerId && getTile(p.tileIndex).type === 'RAILROAD',
    ).length
    return tile.railroadRent![ownerRailroads - 1]
  }

  if (tile.type === 'UTILITY') {
    const ownerUtilities = allProperties.filter(
      (p) => p.ownerId === property.ownerId && getTile(p.tileIndex).type === 'UTILITY',
    ).length
    const multiplier = tile.utilityMultiplier![ownerUtilities - 1]
    return multiplier * roll.total
  }

  // Standard property
  if (property.hasHotel) return tile.rent![5]
  if (property.houses > 0) return tile.rent![property.houses]

  // Check monopoly (no houses but owner has full color group)
  const groupTiles = getTilesByGroup(tile.group!)
  const ownsAll = groupTiles.every((t) =>
    allProperties.some((p) => p.tileIndex === t.index && p.ownerId === property.ownerId),
  )
  return ownsAll ? tile.rent![0] * 2 : tile.rent![0]
}

export async function buyProperty(gameId: string, playerId: string): Promise<ActionResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, properties: true },
  })
  if (!game) return { ok: false, errorCode: 'GAME_NOT_FOUND', error: 'Game not found' }

  const player = game.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, errorCode: 'PLAYER_NOT_FOUND', error: 'Player not in game' }

  const check = combine(
    isGameInProgress(game),
    isCurrentPlayer(game, playerId),
    isPhase(game, 'AWAITING_ACTION'),
    isNotBankrupt(player),
  )
  if (!check.ok) return check

  const tile = getTile(player.position)
  if (!tile.price) return { ok: false, errorCode: 'NOT_PURCHASABLE', error: 'This tile cannot be purchased' }

  const fundCheck = hasSufficientFunds(player, tile.price)
  if (!fundCheck.ok) return fundCheck

  const seq = await nextSeq(gameId)

  await prisma.$transaction([
    prisma.player.update({ where: { id: playerId }, data: { cash: { decrement: tile.price } } }),
    prisma.property.upsert({
      where: { gameId_tileIndex: { gameId, tileIndex: tile.index } },
      create: { gameId, tileIndex: tile.index, ownerId: playerId },
      update: { ownerId: playerId },
    }),
    prisma.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq,
        eventType: 'PROPERTY_BOUGHT',
        payload: { tileIndex: tile.index, price: tile.price },
      },
    }),
  ])

  // Doubles streak: check if player was on doubles and should roll again
  const updatedGame = await prisma.game.findUniqueOrThrow({ where: { id: gameId } })
  return endTurn(gameId, playerId, updatedGame.doublesStreak > 0)
}

export async function declineProperty(gameId: string, playerId: string): Promise<ActionResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, properties: true },
  })
  if (!game) return { ok: false, errorCode: 'GAME_NOT_FOUND', error: 'Game not found' }

  const player = game.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, errorCode: 'PLAYER_NOT_FOUND', error: 'Player not in game' }

  const check = combine(
    isGameInProgress(game),
    isCurrentPlayer(game, playerId),
    isPhase(game, 'AWAITING_ACTION'),
  )
  if (!check.ok) return check

  const seq = await nextSeq(gameId)
  const tile = getTile(player.position)

  await prisma.gameEvent.create({
    data: {
      gameId,
      playerId,
      sequenceNumber: seq,
      eventType: 'PROPERTY_DECLINED',
      payload: { tileIndex: tile.index },
    },
  })

  return triggerAuction(game as FullGame, player, tile.index, seq + 1)
}
