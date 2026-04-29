'use client'
import { BOARD_TILES, type BoardTile, type PropertyGroup } from '../../config/board'
import type { GameSnapshot, PlayerSnapshot } from '../../src/engine/types'

const GROUP_COLORS: Record<PropertyGroup, string> = {
  BROWN: '#92400e',
  LIGHT_BLUE: '#0ea5e9',
  PINK: '#ec4899',
  ORANGE: '#f97316',
  RED: '#ef4444',
  YELLOW: '#eab308',
  GREEN: '#22c55e',
  DARK_BLUE: '#1d4ed8',
  RAILROAD: '#6b7280',
  UTILITY: '#a78bfa',
}

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']

// Maps tile index → [row, col] on an 11×11 grid (0-indexed, row 0 = top)
function tileGridPos(index: number): [number, number] {
  if (index <= 10) return [10, 10 - index]          // bottom row, right→left
  if (index <= 19) return [10 - (index - 10), 0]    // left col, bottom→top
  if (index <= 30) return [0, index - 20]            // top row, left→right
  return [index - 30, 10]                            // right col, top→bottom
}

interface TileProps {
  tile: BoardTile
  players: PlayerSnapshot[]
  playerColors: Record<string, string>
  isCurrentTurn: boolean
  myPosition: number | null
}

function Tile({ tile, players, playerColors, isCurrentTurn, myPosition }: TileProps) {
  const isCorner = [0, 10, 20, 30].includes(tile.index)
  const tokens = players.filter((p) => p.position === tile.index && !p.isBankrupt)
  const isMyPos = myPosition === tile.index

  const groupColor = tile.group ? GROUP_COLORS[tile.group] : null
  const typeLabel: Record<string, string> = {
    GO: 'GO',
    JAIL: 'JAIL',
    FREE_PARKING: 'FREE',
    GO_TO_JAIL: '→JAIL',
    INCOME_TAX: 'TAX',
    LUXURY_TAX: 'LUX',
    CHANCE: '?',
    COMMUNITY_CHEST: 'CC',
  }

  return (
    <div
      className="relative border border-gray-300 flex flex-col overflow-hidden select-none"
      style={{
        backgroundColor: isMyPos ? '#fef9c3' : '#fff',
        minHeight: isCorner ? 64 : 48,
        minWidth: isCorner ? 64 : 48,
      }}
    >
      {groupColor && (
        <div className="h-2 w-full shrink-0" style={{ backgroundColor: groupColor }} />
      )}
      <div className="flex-1 flex flex-col items-center justify-center p-0.5 gap-0.5">
        <span className="text-[7px] leading-tight text-center text-black font-mono">
          {tile.index}
        </span>
        <span className="text-[6px] leading-tight text-center text-black font-semibold break-words text-wrap">
          {typeLabel[tile.type] ?? tile.name.split(' ').slice(0, 2).join('\n')}
        </span>
        {tile.price && (
          <span className="text-[6px] text-black">${tile.price}</span>
        )}
      </div>
      {tokens.length > 0 && (
        <div className="absolute bottom-0.5 right-0.5 flex flex-wrap gap-0.5 justify-end">
          {tokens.map((p) => (
            <div
              key={p.id}
              className="w-3 h-3 rounded-full border border-white shadow text-[5px] flex items-center justify-center font-bold text-white"
              style={{ backgroundColor: playerColors[p.id] }}
              title={p.name}
            >
              {p.name[0].toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface BoardProps {
  gameState: GameSnapshot
  myPlayerId: string | null
  isRolling: boolean
}

export function Board({ gameState, myPlayerId, isRolling }: BoardProps) {
  const myPlayer = gameState.players.find((p) => p.id === myPlayerId)

  const playerColors = Object.fromEntries(
    gameState.players.map((p, i) => [p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]])
  )

  // Build 11×11 grid
  const grid: (BoardTile | null)[][] = Array.from({ length: 11 }, () => Array(11).fill(null))
  for (const tile of BOARD_TILES) {
    const [r, c] = tileGridPos(tile.index)
    grid[r][c] = tile
  }

  return (
    <div
      className="grid gap-px bg-gray-200"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(11, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(11, minmax(0, 1fr))',
        width: '100%',
        aspectRatio: '1',
      }}
    >
      {grid.flatMap((row, r) =>
        row.map((tile, c) => {
          if (!tile) {
            // Center cells — show game info
            if (r === 4 && c === 4) {
              const roll = gameState.lastRoll
              return (
                <div
                  key={`center-info`}
                  className="bg-emerald-50 flex flex-col items-center justify-center text-center p-2"
                  style={{ gridColumn: '5 / 11', gridRow: '5 / 11' }}
                >
                  <p className="text-xs font-bold text-emerald-700">POLYRIP</p>
                  <p className="text-[10px] text-black mt-1">Turn #{gameState.turnNumber}</p>
                  <p className="text-[10px] text-black font-mono uppercase mt-0.5">
                    {gameState.phase.replace(/_/g, ' ')}
                  </p>

                  {/* Dice result / rolling indicator */}
                  <div className="mt-2">
                    {isRolling ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex gap-1">
                          <span className="text-lg animate-bounce">🎲</span>
                          <span className="text-lg animate-bounce" style={{ animationDelay: '0.15s' }}>🎲</span>
                        </div>
                        <p className="text-[9px] text-black">Rolling…</p>
                      </div>
                    ) : roll ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <p className="text-2xl font-black text-black leading-none">{roll.total}</p>
                        <p className="text-[9px] text-black font-mono">{roll.die1} + {roll.die2}</p>
                        {roll.isDoubles && (
                          <p className="text-[8px] font-bold text-emerald-700 bg-emerald-100 rounded px-1">DOUBLES</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {gameState.activeAuction && (
                    <div className="mt-1 text-[9px] bg-yellow-100 rounded px-1 py-0.5">
                      <p className="font-bold text-yellow-800">AUCTION</p>
                      <p className="text-black">{gameState.activeAuction.propertyName}</p>
                      <p className="text-black">High: ${gameState.activeAuction.highestBid}</p>
                    </div>
                  )}
                </div>
              )
            }
            if (r >= 4 && c >= 4 && r < 10 && c < 10) return null
            return <div key={`empty-${r}-${c}`} className="bg-emerald-50" />
          }

          return (
            <Tile
              key={tile.index}
              tile={tile}
              players={gameState.players}
              playerColors={playerColors}
              isCurrentTurn={gameState.currentPlayerId !== null}
              myPosition={myPlayer?.position ?? null}
            />
          )
        })
      ).filter(Boolean)}
    </div>
  )
}
