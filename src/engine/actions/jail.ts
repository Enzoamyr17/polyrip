import { prisma } from '../../lib/prisma'
import { rollDice } from '../../lib/dice'
import { combine, isCurrentPlayer, isGameInProgress, isPhase, hasSufficientFunds, hasJailFreeCard } from '../validator'
import { endTurn } from './turn'
import { processLanding } from './property'
import { nextSeq } from './roll'
import { GAME_CONSTANTS } from '../../../config/game-constants'
import type { ActionResult } from '../types'

export async function goToJail(gameId: string, playerId: string, seq: number): Promise<ActionResult> {
  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: {
        position: GAME_CONSTANTS.JAIL_POSITION,
        isInJail: true,
        jailTurns: 0,
      },
    }),
    prisma.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq,
        eventType: 'WENT_TO_JAIL',
        payload: { position: GAME_CONSTANTS.JAIL_POSITION },
      },
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { doublesStreak: 0 },
    }),
  ])

  return endTurn(gameId, playerId, false)
}

export async function handleJailRoll(gameId: string, playerId: string): Promise<ActionResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, properties: true },
  })
  if (!game) return { ok: false, errorCode: 'GAME_NOT_FOUND', error: 'Game not found' }

  const player = game.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, errorCode: 'PLAYER_NOT_FOUND', error: 'Player not in game' }

  const roll = rollDice()
  const seq = await nextSeq(gameId)

  await prisma.gameEvent.create({
    data: {
      gameId,
      playerId,
      sequenceNumber: seq,
      eventType: 'DICE_ROLLED',
      payload: { die1: roll.die1, die2: roll.die2, doubles: roll.isDoubles, inJail: true },
    },
  })

  // Rolled doubles — escape jail, move forward, don't get extra turn for doubles from jail
  if (roll.isDoubles) {
    const newPosition = (GAME_CONSTANTS.JAIL_POSITION + roll.total) % GAME_CONSTANTS.BOARD_SIZE
    await prisma.player.update({
      where: { id: playerId },
      data: { isInJail: false, jailTurns: 0, position: newPosition },
    })
    const updatedGame = await prisma.game.findUniqueOrThrow({ where: { id: gameId }, include: { players: true, properties: true } })
    const updatedPlayer = updatedGame.players.find((p) => p.id === playerId)!
    return processLanding(updatedGame, updatedPlayer, { ...roll, isDoubles: false }, seq + 1)
  }

  // Third turn in jail — must pay fine and move
  if (player.jailTurns + 1 >= GAME_CONSTANTS.MAX_JAIL_TURNS) {
    const newPosition = (GAME_CONSTANTS.JAIL_POSITION + roll.total) % GAME_CONSTANTS.BOARD_SIZE
    await prisma.$transaction([
      prisma.player.update({
        where: { id: playerId },
        data: {
          isInJail: false,
          jailTurns: 0,
          position: newPosition,
          cash: { decrement: GAME_CONSTANTS.JAIL_FINE },
        },
      }),
      prisma.gameEvent.create({
        data: {
          gameId,
          playerId,
          sequenceNumber: seq + 1,
          eventType: 'JAIL_FINE_PAID',
          payload: { amount: GAME_CONSTANTS.JAIL_FINE, forced: true },
        },
      }),
    ])
    const updatedGame = await prisma.game.findUniqueOrThrow({ where: { id: gameId }, include: { players: true, properties: true } })
    const updatedPlayer = updatedGame.players.find((p) => p.id === playerId)!
    return processLanding(updatedGame, updatedPlayer, { ...roll, isDoubles: false }, seq + 2)
  }

  // Didn't roll doubles, still in jail
  await prisma.player.update({
    where: { id: playerId },
    data: { jailTurns: { increment: 1 } },
  })

  return endTurn(gameId, playerId, false)
}

export async function payJailFine(gameId: string, playerId: string): Promise<ActionResult> {
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
    isPhase(game, 'WAITING_FOR_ROLL'),
    hasSufficientFunds(player, GAME_CONSTANTS.JAIL_FINE),
  )
  if (!check.ok) return check

  if (!player.isInJail) {
    return { ok: false, errorCode: 'NOT_IN_JAIL', error: 'Player is not in jail' }
  }

  const seq = await nextSeq(gameId)
  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { isInJail: false, jailTurns: 0, cash: { decrement: GAME_CONSTANTS.JAIL_FINE } },
    }),
    prisma.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq,
        eventType: 'JAIL_FINE_PAID',
        payload: { amount: GAME_CONSTANTS.JAIL_FINE, forced: false },
      },
    }),
  ])

  // Player can now roll normally this turn — transition stays at WAITING_FOR_ROLL
  return { ok: true, events: ['JAIL_FINE_PAID'] }
}

export async function useJailFreeCard(gameId: string, playerId: string): Promise<ActionResult> {
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
    isPhase(game, 'WAITING_FOR_ROLL'),
    hasJailFreeCard(player),
  )
  if (!check.ok) return check

  if (!player.isInJail) {
    return { ok: false, errorCode: 'NOT_IN_JAIL', error: 'Player is not in jail' }
  }

  const seq = await nextSeq(gameId)
  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { isInJail: false, jailTurns: 0, jailFreeCards: { decrement: 1 } },
    }),
    prisma.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq,
        eventType: 'JAIL_FREE_CARD_USED',
        payload: {},
      },
    }),
  ])

  return { ok: true, events: ['JAIL_FREE_CARD_USED'] }
}
