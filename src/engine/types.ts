import type { BoardTile } from '../../config/board'
import type { Card } from '../../config/chance-cards'

// ─── DB-mirrored enums ────────────────────────────────────────────────────────

export type UserStatus = 'ACTIVE' | 'BANNED' | 'SUSPENDED'
export type GameStatus = 'LOBBY' | 'IN_PROGRESS' | 'ENDED' | 'ABANDONED'
export type GamePhase = 'WAITING_FOR_ROLL' | 'AWAITING_ACTION' | 'AUCTION' | 'ENDED'
export type DeckType = 'CHANCE' | 'COMMUNITY_CHEST'
export type AuctionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export type EventType =
  | 'GAME_STARTED'
  | 'DICE_ROLLED'
  | 'PLAYER_MOVED'
  | 'PASSED_GO'
  | 'PROPERTY_BOUGHT'
  | 'PROPERTY_DECLINED'
  | 'RENT_PAID'
  | 'TAX_PAID'
  | 'CARD_DRAWN'
  | 'CARD_EFFECT_APPLIED'
  | 'WENT_TO_JAIL'
  | 'JAIL_FINE_PAID'
  | 'JAIL_FREE_CARD_USED'
  | 'HOUSE_BUILT'
  | 'HOTEL_BUILT'
  | 'AUCTION_STARTED'
  | 'AUCTION_BID_PLACED'
  | 'AUCTION_WON'
  | 'AUCTION_CANCELLED'
  | 'PLAYER_BANKRUPT'
  | 'GAME_ENDED'
  | 'TURN_SKIPPED_AFK'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface DiceRoll {
  die1: number
  die2: number
  total: number
  isDoubles: boolean
}

export interface LandingResult {
  type:
    | 'UNOWNED_PROPERTY'
    | 'OWNED_PROPERTY'
    | 'OWNED_RAILROAD'
    | 'OWNED_UTILITY'
    | 'CHANCE'
    | 'COMMUNITY_CHEST'
    | 'TAX'
    | 'GO_TO_JAIL'
    | 'PASS_THROUGH'
  tile: BoardTile
  rentDue?: number
  taxDue?: number
  cardDrawn?: Card
}

// ─── Game snapshot (serialized for clients) ───────────────────────────────────

export interface PlayerSnapshot {
  id: string
  userId: string
  name: string
  position: number
  cash: number
  turnOrder: number
  isInJail: boolean
  jailTurns: number
  isBankrupt: boolean
  jailFreeCards: number
}

export interface PropertySnapshot {
  tileIndex: number
  tileName: string
  ownerId: string | null
  houses: number
  hasHotel: boolean
  isMortgaged: boolean
}

export interface AuctionSnapshot {
  id: string
  propertyTileIndex: number
  propertyName: string
  status: AuctionStatus
  highestBid: number
  highestBidderId: string | null
  endsAt: string
}

export interface DiceRollSnapshot {
  die1: number
  die2: number
  total: number
  isDoubles: boolean
}

export interface GameSnapshot {
  gameId: string
  code: string
  status: GameStatus
  phase: GamePhase
  currentPlayerId: string | null
  turnNumber: number
  turnStartedAt: string | null
  afkTimeoutSeconds: number
  doublesStreak: number
  players: PlayerSnapshot[]
  properties: PropertySnapshot[]
  activeAuction: AuctionSnapshot | null
  lastRoll: DiceRollSnapshot | null
}

// ─── Engine action results ────────────────────────────────────────────────────

export interface ActionResult {
  ok: boolean
  error?: string
  errorCode?: string
  events?: EventType[]
}

// ─── Socket event payloads ────────────────────────────────────────────────────

export interface ClientRollPayload {
  gameId: string
  idempotencyKey: string
}

export interface ClientBuyPayload {
  gameId: string
  idempotencyKey: string
}

export interface ClientDeclinePayload {
  gameId: string
  idempotencyKey: string
}

export interface ClientBidPayload {
  gameId: string
  amount: number
  idempotencyKey: string
}

export interface ClientJailFinePayload {
  gameId: string
  idempotencyKey: string
}

export interface ClientJailCardPayload {
  gameId: string
  idempotencyKey: string
}

export interface ClientJoinPayload {
  code: string
}

export interface ClientStartPayload {
  gameId: string
}
