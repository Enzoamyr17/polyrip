import { prisma } from '../../lib/prisma'
import { rollDice } from '../../lib/dice'
import { combine, isCurrentPlayer, isGameInProgress, isPhase, isNotBankrupt } from '../validator'
import { processLanding } from './property'
import { goToJail } from './jail'
import { endTurn } from './turn'
import { GAME_CONSTANTS } from '../../../config/game-constants'
import type { ActionResult } from '../types'

export async function handleRoll(gameId: string, playerId: string): Promise<ActionResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true, properties: true },
  })
  if (!game) return { ok: false, errorCode: 'GAME_NOT_FOUND', error: 'Game not found' }

  const player = game.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, errorCode: 'PLAYER_NOT_FOUND', error: 'Player not found in this game' }

  const check = combine(
    isGameInProgress(game),
    isCurrentPlayer(game, playerId),
    isPhase(game, 'WAITING_FOR_ROLL'),
    isNotBankrupt(player),
  )
  if (!check.ok) return check

  // Player is in jail — delegate to jail roll logic
  if (player.isInJail) {
    const { handleJailRoll } = await import('./jail')
    return handleJailRoll(gameId, playerId)
  }

  const roll = rollDice()
  const nextSequence = await nextSeq(gameId)

  // 3 consecutive doubles → go to jail
  if (roll.isDoubles && game.doublesStreak + 1 >= GAME_CONSTANTS.MAX_DOUBLES_STREAK) {
    await prisma.$transaction([
      prisma.gameEvent.create({
        data: {
          gameId,
          playerId,
          sequenceNumber: nextSequence,
          eventType: 'DICE_ROLLED',
          payload: { die1: roll.die1, die2: roll.die2, doubles: true, streak: game.doublesStreak + 1 },
        },
      }),
      prisma.game.update({
        where: { id: gameId },
        data: { doublesStreak: 0 },
      }),
    ])
    return goToJail(gameId, playerId, nextSequence + 1)
  }

  // Move the player
  const newPosition = (player.position + roll.total) % GAME_CONSTANTS.BOARD_SIZE
  const passedGo = newPosition < player.position && player.position + roll.total >= GAME_CONSTANTS.BOARD_SIZE

  const events = await prisma.$transaction(async (tx) => {
    const seq = nextSequence
    await tx.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq,
        eventType: 'DICE_ROLLED',
        payload: { die1: roll.die1, die2: roll.die2, doubles: roll.isDoubles },
      },
    })

    await tx.player.update({
      where: { id: playerId },
      data: { position: newPosition },
    })

    await tx.gameEvent.create({
      data: {
        gameId,
        playerId,
        sequenceNumber: seq + 1,
        eventType: 'PLAYER_MOVED',
        payload: { from: player.position, to: newPosition, passedGo },
      },
    })

    let cashBonus = 0
    if (passedGo) {
      cashBonus = GAME_CONSTANTS.GO_SALARY
      await tx.player.update({ where: { id: playerId }, data: { cash: { increment: cashBonus } } })
      await tx.gameEvent.create({
        data: {
          gameId,
          playerId,
          sequenceNumber: seq + 2,
          eventType: 'PASSED_GO',
          payload: { amount: cashBonus },
        },
      })
    }

    await tx.game.update({
      where: { id: gameId },
      data: { doublesStreak: roll.isDoubles ? { increment: 1 } : 0 },
    })

    return seq + (passedGo ? 3 : 2)
  })

  const updatedPlayer = await prisma.player.findUniqueOrThrow({ where: { id: playerId } })
  const updatedGame = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true, properties: true },
  })

  return processLanding(updatedGame, updatedPlayer, roll, events)
}

export async function nextSeq(gameId: string): Promise<number> {
  const last = await prisma.gameEvent.findFirst({
    where: { gameId },
    orderBy: { sequenceNumber: 'desc' },
  })
  return (last?.sequenceNumber ?? 0) + 1
}
