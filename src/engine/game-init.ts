import { prisma } from '../lib/prisma'
import { shuffleDeck } from '../lib/deck'
import { CHANCE_CARDS } from '../../config/chance-cards'
import { COMMUNITY_CHEST_CARDS } from '../../config/community-chest-cards'
import { BOARD_TILES } from '../../config/board'
import { GAME_CONSTANTS } from '../../config/game-constants'
import { randomBytes } from 'crypto'

function generateCode(): string {
  return randomBytes(3).toString('hex').toUpperCase()
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export async function createGame(hostUserId: string, maxPlayers = 6): Promise<string> {
  const code = generateCode()

  const game = await prisma.game.create({
    data: {
      code,
      maxPlayers,
      status: 'LOBBY',
      phase: 'WAITING_FOR_ROLL',
      afkTimeoutSeconds: GAME_CONSTANTS.DEFAULT_AFK_TIMEOUT_SECONDS,
    },
  })

  // Host is first player
  await prisma.player.create({
    data: {
      userId: hostUserId,
      gameId: game.id,
      cash: GAME_CONSTANTS.STARTING_CASH,
      turnOrder: 1,
    },
  })

  return game.id
}

export async function joinGame(gameId: string, userId: string): Promise<string> {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true },
  })

  if (game.status !== 'LOBBY') throw new Error('Game already started')
  if (game.players.length >= game.maxPlayers) throw new Error('Game is full')
  if (game.players.some((p) => p.userId === userId)) throw new Error('Already in this game')

  const player = await prisma.player.create({
    data: {
      userId,
      gameId,
      cash: GAME_CONSTANTS.STARTING_CASH,
      turnOrder: game.players.length + 1,
    },
  })

  return player.id
}

export async function startGame(gameId: string, hostUserId: string): Promise<void> {
  const game = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true },
  })

  if (game.status !== 'LOBBY') throw new Error('Game already started')
  if (game.players.length < 2) throw new Error('Need at least 2 players')
  if (game.players[0].userId !== hostUserId) throw new Error('Only the host can start the game')

  // Randomize turn order
  const shuffledPlayers = shuffleArray(game.players)

  // Seed purchasable properties into the property table (all unowned)
  const purchasableTiles = BOARD_TILES.filter(
    (t) => t.type === 'PROPERTY' || t.type === 'RAILROAD' || t.type === 'UTILITY',
  )

  const seq = 1
  const firstPlayer = shuffledPlayers[0]

  await prisma.$transaction([
    // Update turn order
    ...shuffledPlayers.map((p, i) =>
      prisma.player.update({ where: { id: p.id }, data: { turnOrder: i + 1 } }),
    ),
    // Create all properties as unowned
    ...purchasableTiles.map((tile) =>
      prisma.property.create({ data: { gameId, tileIndex: tile.index } }),
    ),
    // Create shuffled card decks
    prisma.cardDeck.create({
      data: {
        gameId,
        deckType: 'CHANCE',
        cardOrder: shuffleDeck(CHANCE_CARDS.length),
        drawPointer: 0,
      },
    }),
    prisma.cardDeck.create({
      data: {
        gameId,
        deckType: 'COMMUNITY_CHEST',
        cardOrder: shuffleDeck(COMMUNITY_CHEST_CARDS.length),
        drawPointer: 0,
      },
    }),
    // Start the game
    prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'IN_PROGRESS',
        phase: 'WAITING_FOR_ROLL',
        currentPlayerId: firstPlayer.id,
        turnNumber: 1,
        turnStartedAt: new Date(),
      },
    }),
    // Log game started event
    prisma.gameEvent.create({
      data: {
        gameId,
        sequenceNumber: seq,
        eventType: 'GAME_STARTED',
        payload: { firstPlayerId: firstPlayer.id, playerOrder: shuffledPlayers.map((p) => p.id) },
      },
    }),
  ])
}
