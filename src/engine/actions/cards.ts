import type { Game, Player, Property } from '../../lib/prisma'
import { prisma } from '../../lib/prisma'
import { goToJail } from './jail'
import { endTurn } from './turn'
import { nextSeq } from './roll'
import { processLanding } from './property'
import { BOARD_TILES, getTile } from '../../../config/board'
import { CHANCE_CARDS } from '../../../config/chance-cards'
import { COMMUNITY_CHEST_CARDS } from '../../../config/community-chest-cards'
import { GAME_CONSTANTS } from '../../../config/game-constants'
import type { ActionResult, DiceRoll } from '../types'
import type { DeckType } from '../types'

type FullGame = Game & { players: Player[]; properties: Property[] }

export async function drawCard(
  game: FullGame,
  player: Player,
  deckType: DeckType,
  seq: number,
  roll: DiceRoll,
): Promise<ActionResult> {
  const deck = await prisma.cardDeck.findUnique({
    where: { gameId_deckType: { gameId: game.id, deckType } },
  })
  if (!deck) return { ok: false, errorCode: 'DECK_NOT_FOUND', error: 'Card deck not initialized' }

  const cards = deckType === 'CHANCE' ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS
  const cardIndex = deck.cardOrder[deck.drawPointer % deck.cardOrder.length]
  const card = cards[cardIndex]

  await prisma.$transaction([
    prisma.cardDeck.update({
      where: { id: deck.id },
      data: { drawPointer: { increment: 1 } },
    }),
    prisma.gameEvent.create({
      data: {
        gameId: game.id,
        playerId: player.id,
        sequenceNumber: seq,
        eventType: 'CARD_DRAWN',
        payload: { deckType, cardIndex: card.index, text: card.text },
      },
    }),
  ])

  return applyCardEffect(game, player, card, seq + 1, roll)
}

async function applyCardEffect(
  game: FullGame,
  player: Player,
  card: (typeof CHANCE_CARDS)[number],
  seq: number,
  roll: DiceRoll,
): Promise<ActionResult> {
  const { action } = card

  switch (action.type) {
    case 'GO_TO_JAIL': {
      await logEffect(game.id, player.id, seq, card.index, action)
      return goToJail(game.id, player.id, seq + 1)
    }

    case 'GET_OUT_OF_JAIL_FREE': {
      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { jailFreeCards: { increment: 1 } } }),
        logEffect(game.id, player.id, seq, card.index, action),
      ])
      return endTurn(game.id, player.id, roll.isDoubles)
    }

    case 'CASH': {
      const amount = action.amount
      // Positive: player collects. Negative: player pays bank (or each player for special cards)
      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { cash: { increment: amount } } }),
        logEffect(game.id, player.id, seq, card.index, action),
      ])
      return endTurn(game.id, player.id, roll.isDoubles)
    }

    case 'CASH_PER_HOUSE': {
      const playerProperties = game.properties.filter((p) => p.ownerId === player.id)
      const houseCount = playerProperties.reduce((n, p) => n + (p.hasHotel ? 0 : p.houses), 0)
      const hotelCount = playerProperties.filter((p) => p.hasHotel).length
      const total = houseCount * action.house + hotelCount * action.hotel
      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { cash: { increment: total } } }),
        logEffect(game.id, player.id, seq, card.index, { ...action, computed: total }),
      ])
      return endTurn(game.id, player.id, roll.isDoubles)
    }

    case 'MOVE_TO': {
      const newPos = action.position
      const passedGo = newPos < player.position && action.collectGo

      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { position: newPos } }),
        prisma.player.update({
          where: { id: player.id },
          data: passedGo ? { cash: { increment: GAME_CONSTANTS.GO_SALARY } } : {},
        }),
        logEffect(game.id, player.id, seq, card.index, { ...action, passedGo }),
      ])

      const updatedGame = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { players: true, properties: true },
      })
      const updatedPlayer = updatedGame.players.find((p) => p.id === player.id)!
      return processLanding(updatedGame, updatedPlayer, roll, seq + 1)
    }

    case 'MOVE_BACK': {
      const newPos = ((player.position - action.steps) + GAME_CONSTANTS.BOARD_SIZE) % GAME_CONSTANTS.BOARD_SIZE

      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { position: newPos } }),
        logEffect(game.id, player.id, seq, card.index, { ...action, to: newPos }),
      ])

      const updatedGame = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { players: true, properties: true },
      })
      const updatedPlayer = updatedGame.players.find((p) => p.id === player.id)!
      return processLanding(updatedGame, updatedPlayer, roll, seq + 1)
    }

    case 'MOVE_TO_NEAREST': {
      const nearestIndex = findNearest(player.position, action.tileType)
      const nearestTile = getTile(nearestIndex)
      const newPos = nearestIndex
      const passedGo = newPos < player.position

      const targetProperty = game.properties.find((p) => p.tileIndex === nearestIndex)

      await prisma.$transaction([
        prisma.player.update({ where: { id: player.id }, data: { position: newPos } }),
        passedGo
          ? prisma.player.update({ where: { id: player.id }, data: { cash: { increment: GAME_CONSTANTS.GO_SALARY } } })
          : prisma.player.update({ where: { id: player.id }, data: {} }),
        logEffect(game.id, player.id, seq, card.index, { ...action, to: newPos, passedGo }),
      ])

      const updatedGame = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
        include: { players: true, properties: true },
      })
      const updatedPlayer = updatedGame.players.find((p) => p.id === player.id)!

      // If double-rent applies on an owned property, it'll be handled by processLanding via the
      // roll total that was already saved — processLanding uses game.properties for ownership check
      return processLanding(updatedGame, updatedPlayer, roll, seq + 1)
    }

    default:
      return endTurn(game.id, player.id, roll.isDoubles)
  }
}

function findNearest(currentPosition: number, tileType: 'RAILROAD' | 'UTILITY'): number {
  const targets = BOARD_TILES.filter((t) => t.type === tileType).map((t) => t.index)
  let nearest: number = targets[0] ?? 0
  let minDist: number = GAME_CONSTANTS.BOARD_SIZE

  for (const idx of targets) {
    const dist = (idx - currentPosition + GAME_CONSTANTS.BOARD_SIZE) % GAME_CONSTANTS.BOARD_SIZE
    if (dist < minDist) {
      minDist = dist
      nearest = idx
    }
  }

  return nearest
}

function logEffect(gameId: string, playerId: string, seq: number, cardIndex: number, action: object) {
  return prisma.gameEvent.create({
    data: {
      gameId,
      playerId,
      sequenceNumber: seq,
      eventType: 'CARD_EFFECT_APPLIED',
      payload: { cardIndex, action },
    },
  })
}
