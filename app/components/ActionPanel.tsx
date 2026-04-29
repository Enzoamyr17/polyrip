'use client'
import { useState, useEffect } from 'react'
import type { GameSnapshot, PlayerSnapshot } from '../../src/engine/types'

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']

interface Props {
  gameState: GameSnapshot
  myPlayerId: string | null
  onEmit: (event: string, data?: unknown) => void
}

function key(): string {
  return crypto.randomUUID()
}

export function ActionPanel({ gameState, myPlayerId, onEmit }: Props) {
  const [bidAmount, setBidAmount] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [auctionSecsLeft, setAuctionSecsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!gameState.activeAuction) { setAuctionSecsLeft(null); return }
    const endsAt = new Date(gameState.activeAuction.endsAt).getTime()
    function tick() { setAuctionSecsLeft(Math.max(0, Math.floor((endsAt - Date.now()) / 1000))) }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [gameState.activeAuction?.endsAt])

  const me = gameState.players.find((p) => p.id === myPlayerId)
  const isMyTurn = gameState.currentPlayerId === myPlayerId
  const currentPlayer = gameState.players.find((p) => p.id === gameState.currentPlayerId)
  const playerColors = Object.fromEntries(
    gameState.players.map((p, i) => [p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]])
  )

  function roll() {
    onEmit('game:roll', { gameId: gameState.gameId, idempotencyKey: key() })
  }

  function buy() {
    onEmit('game:buy', { gameId: gameState.gameId, idempotencyKey: key() })
  }

  function decline() {
    onEmit('game:decline', { gameId: gameState.gameId, idempotencyKey: key() })
  }

  function bid() {
    const amt = parseInt(bidAmount, 10)
    if (isNaN(amt) || amt <= 0) return
    onEmit('game:bid', { gameId: gameState.gameId, amount: amt, idempotencyKey: key() })
    setBidAmount('')
  }

  function payJail() {
    onEmit('game:pay_jail', { gameId: gameState.gameId, idempotencyKey: key() })
  }

  function jailCard() {
    onEmit('game:jail_card', { gameId: gameState.gameId, idempotencyKey: key() })
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Status */}
      <div className="bg-gray-100 rounded p-2">
        <p className="text-xs text-black">Game Code</p>
        <p className="font-mono font-bold text-lg tracking-widest text-black">{gameState.code}</p>
        <p className="text-xs text-black mt-1">Phase</p>
        <p className="font-semibold text-black uppercase text-xs">{gameState.phase.replace(/_/g, ' ')}</p>
        {currentPlayer && (
          <p className="text-xs mt-1">
            <span className="text-black">Turn: </span>
            <span
              className="font-bold"
              style={{ color: playerColors[currentPlayer.id] }}
            >
              {currentPlayer.name}
            </span>
          </p>
        )}
      </div>

      {/* Player list */}
      <div className="bg-gray-50 rounded p-2">
        <p className="text-xs text-black mb-1 font-semibold">PLAYERS</p>
        {gameState.players.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 py-0.5 ${p.isBankrupt ? 'opacity-40 line-through' : ''}`}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow"
              style={{ backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
            />
            <span className={`flex-1 text-xs text-black ${p.id === myPlayerId ? 'font-bold' : ''}`}>
              {p.name} {p.id === myPlayerId && '(you)'}
            </span>
            <span className="text-xs font-mono text-green-700">${p.cash}</span>
            {p.isInJail && <span className="text-[9px] bg-red-100 text-red-600 rounded px-1">JAIL</span>}
            {p.jailFreeCards > 0 && (
              <span className="text-[9px] bg-green-100 text-green-700 rounded px-1">
                🎴×{p.jailFreeCards}
              </span>
            )}
            {gameState.currentPlayerId === p.id && (
              <span className="text-[9px] text-yellow-600">▶</span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {me && !me.isBankrupt && gameState.status === 'IN_PROGRESS' && (
        <div className="bg-white border border-gray-200 rounded p-2 flex flex-col gap-2">
          <p className="text-xs text-gray-500 font-semibold">ACTIONS</p>

          {/* Auction — available to all */}
          {gameState.phase === 'AUCTION' && gameState.activeAuction && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">
                  Auction: <span className="font-bold">{gameState.activeAuction.propertyName}</span>
                </p>
                {auctionSecsLeft !== null && (
                  <span
                    className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                      auctionSecsLeft <= 10 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {auctionSecsLeft > 0 ? `${auctionSecsLeft}s` : 'Ending…'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                High bid: <span className="font-bold text-green-700">${gameState.activeAuction.highestBid}</span>
                {gameState.activeAuction.highestBidderId === myPlayerId && ' (you)'}
              </p>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Bid amount"
                  className="flex-1 border rounded px-2 py-1 text-xs"
                  min={gameState.activeAuction.highestBid + 1}
                />
                <button
                  onClick={bid}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-2 py-1 rounded"
                >
                  BID
                </button>
              </div>
            </div>
          )}

          {/* Current player actions */}
          {isMyTurn && (
            <>
              {gameState.phase === 'WAITING_FOR_ROLL' && (
                <div className="flex flex-col gap-1">
                  {me.isInJail ? (
                    <>
                      <p className="text-xs text-red-600 font-medium">You are in Jail (turn {me.jailTurns}/3)</p>
                      <button onClick={roll} className="btn-primary">
                        Roll for Doubles
                      </button>
                      <button onClick={payJail} className="btn-secondary">
                        Pay $50 Fine
                      </button>
                      {me.jailFreeCards > 0 && (
                        <button onClick={jailCard} className="btn-secondary">
                          Use Get Out of Jail Free
                        </button>
                      )}
                    </>
                  ) : (
                    <button onClick={roll} className="btn-primary">
                      Roll Dice
                    </button>
                  )}
                </div>
              )}

              {gameState.phase === 'AWAITING_ACTION' && (
                <div className="flex gap-2">
                  <button onClick={buy} className="btn-primary flex-1">
                    Buy
                  </button>
                  <button onClick={decline} className="btn-secondary flex-1">
                    Decline
                  </button>
                </div>
              )}
            </>
          )}

          {!isMyTurn && gameState.phase !== 'AUCTION' && (
            <p className="text-xs text-gray-400 italic">Waiting for {currentPlayer?.name}...</p>
          )}
        </div>
      )}

      {/* Properties owned by me */}
      {me && (
        <div className="bg-gray-50 rounded p-2">
          <p className="text-xs text-black font-semibold mb-1">MY PROPERTIES</p>
          {gameState.properties.filter((p) => p.ownerId === myPlayerId).length === 0 ? (
            <p className="text-xs text-black italic">None</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {gameState.properties
                .filter((p) => p.ownerId === myPlayerId)
                .map((p) => (
                  <div key={p.tileIndex} className="flex items-center gap-1 text-xs text-black">
                    <span className="truncate flex-1">{p.tileName}</span>
                    {p.houses > 0 && (
                      <span className="text-green-600 text-[9px]">{'🏠'.repeat(p.houses)}</span>
                    )}
                    {p.hasHotel && <span className="text-red-600 text-[9px]">🏨</span>}
                    {p.isMortgaged && (
                      <span className="text-[9px] bg-red-100 text-red-600 rounded px-0.5">M</span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
