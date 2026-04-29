import { randomInt } from 'crypto'
import type { DiceRoll } from '../engine/types'

export function rollDice(): DiceRoll {
  const die1 = randomInt(1, 7)
  const die2 = randomInt(1, 7)
  return {
    die1,
    die2,
    total: die1 + die2,
    isDoubles: die1 === die2,
  }
}
