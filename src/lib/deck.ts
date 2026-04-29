import { randomInt } from 'crypto'

export function shuffleDeck(size: number): number[] {
  const deck = Array.from({ length: size }, (_, i) => i)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}
