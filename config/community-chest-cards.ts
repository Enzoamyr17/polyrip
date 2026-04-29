import type { Card } from './chance-cards'

export const COMMUNITY_CHEST_CARDS: Card[] = [
  {
    index: 0,
    text: 'Advance to Go (Collect $200)',
    action: { type: 'MOVE_TO', position: 0, collectGo: true },
  },
  {
    index: 1,
    text: 'Bank error in your favor. Collect $200.',
    action: { type: 'CASH', amount: 200 },
  },
  {
    index: 2,
    text: "Doctor's fees. Pay $50.",
    action: { type: 'CASH', amount: -50 },
  },
  {
    index: 3,
    text: 'From sale of stock you get $50.',
    action: { type: 'CASH', amount: 50 },
  },
  {
    index: 4,
    text: 'Get out of Jail Free.',
    action: { type: 'GET_OUT_OF_JAIL_FREE' },
  },
  {
    index: 5,
    text: 'Go to Jail. Go directly to Jail, do not pass Go, do not collect $200.',
    action: { type: 'GO_TO_JAIL' },
  },
  {
    index: 6,
    text: 'Grand Opera Night. Collect $50 from every player for opening night seats.',
    action: { type: 'CASH', amount: 50 },
  },
  {
    index: 7,
    text: 'Holiday Fund matures. Receive $100.',
    action: { type: 'CASH', amount: 100 },
  },
  {
    index: 8,
    text: 'Income tax refund. Collect $20.',
    action: { type: 'CASH', amount: 20 },
  },
  {
    index: 9,
    text: "It is your birthday. Collect $10 from every player.",
    action: { type: 'CASH', amount: 10 },
  },
  {
    index: 10,
    text: 'Life insurance matures. Collect $100.',
    action: { type: 'CASH', amount: 100 },
  },
  {
    index: 11,
    text: 'Pay hospital fees of $100.',
    action: { type: 'CASH', amount: -100 },
  },
  {
    index: 12,
    text: 'Pay school fees of $150.',
    action: { type: 'CASH', amount: -150 },
  },
  {
    index: 13,
    text: 'Receive $25 consultancy fee.',
    action: { type: 'CASH', amount: 25 },
  },
  {
    index: 14,
    text: 'You are assessed for street repairs. $40 per house, $115 per hotel.',
    action: { type: 'CASH_PER_HOUSE', house: -40, hotel: -115 },
  },
  {
    index: 15,
    text: 'You have won second prize in a beauty contest. Collect $10.',
    action: { type: 'CASH', amount: 10 },
  },
  {
    index: 16,
    text: 'You inherit $100.',
    action: { type: 'CASH', amount: 100 },
  },
]
