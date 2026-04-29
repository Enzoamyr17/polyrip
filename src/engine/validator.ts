import type { Game, Player, Auction } from '../lib/prisma'
import type { GamePhase } from './types'

export type ValidationError = { ok: false; errorCode: string; error: string }
export type ValidationOk = { ok: true }
export type ValidationResult = ValidationOk | ValidationError

function fail(errorCode: string, error: string): ValidationError {
  return { ok: false, errorCode, error }
}

export function isCurrentPlayer(game: Game & { currentPlayerId: string | null }, playerId: string): ValidationResult {
  if (game.currentPlayerId !== playerId) {
    return fail('NOT_YOUR_TURN', 'It is not your turn')
  }
  return { ok: true }
}

export function isPhase(game: Game, expected: GamePhase): ValidationResult {
  if (game.phase !== expected) {
    return fail('WRONG_PHASE', `Expected phase ${expected}, got ${game.phase}`)
  }
  return { ok: true }
}

export function isGameInProgress(game: Game): ValidationResult {
  if (game.status !== 'IN_PROGRESS') {
    return fail('GAME_NOT_ACTIVE', 'Game is not in progress')
  }
  return { ok: true }
}

export function hasSufficientFunds(player: Player, amount: number): ValidationResult {
  if (player.cash < amount) {
    return fail('INSUFFICIENT_FUNDS', `Need $${amount}, have $${player.cash}`)
  }
  return { ok: true }
}

export function isNotBankrupt(player: Player): ValidationResult {
  if (player.isBankrupt) {
    return fail('PLAYER_BANKRUPT', 'Player is bankrupt')
  }
  return { ok: true }
}

export function isNotInJail(player: Player): ValidationResult {
  if (player.isInJail) {
    return fail('IN_JAIL', 'Player is in jail — use jail-specific actions')
  }
  return { ok: true }
}

export function hasJailFreeCard(player: Player): ValidationResult {
  if (player.jailFreeCards < 1) {
    return fail('NO_JAIL_FREE_CARD', 'Player has no Get Out of Jail Free cards')
  }
  return { ok: true }
}

export function bidExceedsHighest(auction: Auction, amount: number): ValidationResult {
  if (amount <= auction.highestBid) {
    return fail('BID_TOO_LOW', `Bid must exceed current highest bid of $${auction.highestBid}`)
  }
  return { ok: true }
}

export function isAuctionActive(auction: Auction | null): ValidationResult {
  if (!auction || auction.status !== 'ACTIVE') {
    return fail('NO_ACTIVE_AUCTION', 'No active auction')
  }
  return { ok: true }
}

export function combine(...results: ValidationResult[]): ValidationResult {
  for (const r of results) {
    if (!r.ok) return r
  }
  return { ok: true }
}
