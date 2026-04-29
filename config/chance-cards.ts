export type CardAction =
  | { type: 'MOVE_TO'; position: number; collectGo: boolean }
  | { type: 'MOVE_TO_NEAREST'; tileType: 'RAILROAD' | 'UTILITY'; payDouble: boolean }
  | { type: 'MOVE_BACK'; steps: number }
  | { type: 'CASH'; amount: number }
  | { type: 'CASH_PER_HOUSE'; house: number; hotel: number }
  | { type: 'GO_TO_JAIL' }
  | { type: 'GET_OUT_OF_JAIL_FREE' }

export interface Card {
  index: number
  text: string
  action: CardAction
}

export const CHANCE_CARDS: Card[] = [
  {
    index: 0,
    text: 'Advance to Go (Collect $200)',
    action: { type: 'MOVE_TO', position: 0, collectGo: true },
  },
  {
    index: 1,
    text: 'Advance to Illinois Avenue. If you pass Go, collect $200.',
    action: { type: 'MOVE_TO', position: 24, collectGo: true },
  },
  {
    index: 2,
    text: 'Advance to St. Charles Place. If you pass Go, collect $200.',
    action: { type: 'MOVE_TO', position: 11, collectGo: true },
  },
  {
    index: 3,
    text: 'Advance token to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total ten times amount thrown.',
    action: { type: 'MOVE_TO_NEAREST', tileType: 'UTILITY', payDouble: true },
  },
  {
    index: 4,
    text: 'Advance token to the nearest Railroad and pay owner twice the rental to which they are otherwise entitled. If Railroad is unowned, you may buy it from the Bank.',
    action: { type: 'MOVE_TO_NEAREST', tileType: 'RAILROAD', payDouble: true },
  },
  {
    index: 5,
    text: 'Advance token to the nearest Railroad and pay owner twice the rental to which they are otherwise entitled. If Railroad is unowned, you may buy it from the Bank.',
    action: { type: 'MOVE_TO_NEAREST', tileType: 'RAILROAD', payDouble: true },
  },
  {
    index: 6,
    text: 'Bank pays you dividend of $50.',
    action: { type: 'CASH', amount: 50 },
  },
  {
    index: 7,
    text: 'Get out of Jail Free.',
    action: { type: 'GET_OUT_OF_JAIL_FREE' },
  },
  {
    index: 8,
    text: 'Go Back 3 Spaces.',
    action: { type: 'MOVE_BACK', steps: 3 },
  },
  {
    index: 9,
    text: 'Go to Jail. Go directly to Jail, do not pass Go, do not collect $200.',
    action: { type: 'GO_TO_JAIL' },
  },
  {
    index: 10,
    text: 'Make general repairs on all your property. For each house pay $25, for each hotel pay $100.',
    action: { type: 'CASH_PER_HOUSE', house: -25, hotel: -100 },
  },
  {
    index: 11,
    text: 'Pay poor tax of $15.',
    action: { type: 'CASH', amount: -15 },
  },
  {
    index: 12,
    text: 'Take a trip to Reading Railroad. If you pass Go, collect $200.',
    action: { type: 'MOVE_TO', position: 5, collectGo: true },
  },
  {
    index: 13,
    text: 'Take a walk on the Boardwalk. Advance token to Boardwalk.',
    action: { type: 'MOVE_TO', position: 39, collectGo: false },
  },
  {
    index: 14,
    text: 'You have been elected Chairman of the Board. Pay each player $50.',
    action: { type: 'CASH', amount: -50 },
  },
  {
    index: 15,
    text: 'Your building and loan matures. Collect $150.',
    action: { type: 'CASH', amount: 150 },
  },
]
