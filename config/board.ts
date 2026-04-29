export type TileType =
  | 'GO'
  | 'PROPERTY'
  | 'RAILROAD'
  | 'UTILITY'
  | 'CHANCE'
  | 'COMMUNITY_CHEST'
  | 'INCOME_TAX'
  | 'LUXURY_TAX'
  | 'JAIL'
  | 'FREE_PARKING'
  | 'GO_TO_JAIL'

export type PropertyGroup =
  | 'BROWN'
  | 'LIGHT_BLUE'
  | 'PINK'
  | 'ORANGE'
  | 'RED'
  | 'YELLOW'
  | 'GREEN'
  | 'DARK_BLUE'
  | 'RAILROAD'
  | 'UTILITY'

export interface BoardTile {
  index: number
  type: TileType
  name: string
  group?: PropertyGroup
  price?: number
  mortgageValue?: number
  housePrice?: number
  hotelPrice?: number
  // rent[0]=no houses, [1]=1 house, [2]=2 houses, [3]=3 houses, [4]=4 houses, [5]=hotel
  rent?: [number, number, number, number, number, number]
  // railroadRent[n-1] = rent when player owns n railroads
  railroadRent?: [number, number, number, number]
  // utilityMultiplier[0]=1 owned, [1]=both owned; multiply by dice roll
  utilityMultiplier?: [number, number]
  taxAmount?: number
}

export const BOARD_TILES: BoardTile[] = [
  // 0
  { index: 0, type: 'GO', name: 'Go' },
  // 1
  {
    index: 1,
    type: 'PROPERTY',
    name: 'Mediterranean Avenue',
    group: 'BROWN',
    price: 60,
    mortgageValue: 30,
    housePrice: 50,
    hotelPrice: 50,
    rent: [2, 10, 30, 90, 160, 250],
  },
  // 2
  { index: 2, type: 'COMMUNITY_CHEST', name: 'Community Chest' },
  // 3
  {
    index: 3,
    type: 'PROPERTY',
    name: 'Baltic Avenue',
    group: 'BROWN',
    price: 60,
    mortgageValue: 30,
    housePrice: 50,
    hotelPrice: 50,
    rent: [4, 20, 60, 180, 320, 450],
  },
  // 4
  { index: 4, type: 'INCOME_TAX', name: 'Income Tax', taxAmount: 200 },
  // 5
  {
    index: 5,
    type: 'RAILROAD',
    name: 'Reading Railroad',
    group: 'RAILROAD',
    price: 200,
    mortgageValue: 100,
    railroadRent: [25, 50, 100, 200],
  },
  // 6
  {
    index: 6,
    type: 'PROPERTY',
    name: 'Oriental Avenue',
    group: 'LIGHT_BLUE',
    price: 100,
    mortgageValue: 50,
    housePrice: 50,
    hotelPrice: 50,
    rent: [6, 30, 90, 270, 400, 550],
  },
  // 7
  { index: 7, type: 'CHANCE', name: 'Chance' },
  // 8
  {
    index: 8,
    type: 'PROPERTY',
    name: 'Vermont Avenue',
    group: 'LIGHT_BLUE',
    price: 100,
    mortgageValue: 50,
    housePrice: 50,
    hotelPrice: 50,
    rent: [6, 30, 90, 270, 400, 550],
  },
  // 9
  {
    index: 9,
    type: 'PROPERTY',
    name: 'Connecticut Avenue',
    group: 'LIGHT_BLUE',
    price: 120,
    mortgageValue: 60,
    housePrice: 50,
    hotelPrice: 50,
    rent: [8, 40, 100, 300, 450, 600],
  },
  // 10
  { index: 10, type: 'JAIL', name: 'Just Visiting / Jail' },
  // 11
  {
    index: 11,
    type: 'PROPERTY',
    name: 'St. Charles Place',
    group: 'PINK',
    price: 140,
    mortgageValue: 70,
    housePrice: 100,
    hotelPrice: 100,
    rent: [10, 50, 150, 450, 625, 750],
  },
  // 12
  {
    index: 12,
    type: 'UTILITY',
    name: 'Electric Company',
    group: 'UTILITY',
    price: 150,
    mortgageValue: 75,
    utilityMultiplier: [4, 10],
  },
  // 13
  {
    index: 13,
    type: 'PROPERTY',
    name: 'States Avenue',
    group: 'PINK',
    price: 140,
    mortgageValue: 70,
    housePrice: 100,
    hotelPrice: 100,
    rent: [10, 50, 150, 450, 625, 750],
  },
  // 14
  {
    index: 14,
    type: 'PROPERTY',
    name: 'Virginia Avenue',
    group: 'PINK',
    price: 160,
    mortgageValue: 80,
    housePrice: 100,
    hotelPrice: 100,
    rent: [12, 60, 180, 500, 700, 900],
  },
  // 15
  {
    index: 15,
    type: 'RAILROAD',
    name: 'Pennsylvania Railroad',
    group: 'RAILROAD',
    price: 200,
    mortgageValue: 100,
    railroadRent: [25, 50, 100, 200],
  },
  // 16
  {
    index: 16,
    type: 'PROPERTY',
    name: 'St. James Place',
    group: 'ORANGE',
    price: 180,
    mortgageValue: 90,
    housePrice: 100,
    hotelPrice: 100,
    rent: [14, 70, 200, 550, 750, 950],
  },
  // 17
  { index: 17, type: 'COMMUNITY_CHEST', name: 'Community Chest' },
  // 18
  {
    index: 18,
    type: 'PROPERTY',
    name: 'Tennessee Avenue',
    group: 'ORANGE',
    price: 180,
    mortgageValue: 90,
    housePrice: 100,
    hotelPrice: 100,
    rent: [14, 70, 200, 550, 750, 950],
  },
  // 19
  {
    index: 19,
    type: 'PROPERTY',
    name: 'New York Avenue',
    group: 'ORANGE',
    price: 200,
    mortgageValue: 100,
    housePrice: 100,
    hotelPrice: 100,
    rent: [16, 80, 220, 600, 800, 1000],
  },
  // 20
  { index: 20, type: 'FREE_PARKING', name: 'Free Parking' },
  // 21
  {
    index: 21,
    type: 'PROPERTY',
    name: 'Kentucky Avenue',
    group: 'RED',
    price: 220,
    mortgageValue: 110,
    housePrice: 150,
    hotelPrice: 150,
    rent: [18, 90, 250, 700, 875, 1050],
  },
  // 22
  { index: 22, type: 'CHANCE', name: 'Chance' },
  // 23
  {
    index: 23,
    type: 'PROPERTY',
    name: 'Indiana Avenue',
    group: 'RED',
    price: 220,
    mortgageValue: 110,
    housePrice: 150,
    hotelPrice: 150,
    rent: [18, 90, 250, 700, 875, 1050],
  },
  // 24
  {
    index: 24,
    type: 'PROPERTY',
    name: 'Illinois Avenue',
    group: 'RED',
    price: 240,
    mortgageValue: 120,
    housePrice: 150,
    hotelPrice: 150,
    rent: [20, 100, 300, 750, 925, 1100],
  },
  // 25
  {
    index: 25,
    type: 'RAILROAD',
    name: 'B. & O. Railroad',
    group: 'RAILROAD',
    price: 200,
    mortgageValue: 100,
    railroadRent: [25, 50, 100, 200],
  },
  // 26
  {
    index: 26,
    type: 'PROPERTY',
    name: 'Atlantic Avenue',
    group: 'YELLOW',
    price: 260,
    mortgageValue: 130,
    housePrice: 150,
    hotelPrice: 150,
    rent: [22, 110, 330, 800, 975, 1150],
  },
  // 27
  {
    index: 27,
    type: 'PROPERTY',
    name: 'Ventnor Avenue',
    group: 'YELLOW',
    price: 260,
    mortgageValue: 130,
    housePrice: 150,
    hotelPrice: 150,
    rent: [22, 110, 330, 800, 975, 1150],
  },
  // 28
  {
    index: 28,
    type: 'UTILITY',
    name: 'Water Works',
    group: 'UTILITY',
    price: 150,
    mortgageValue: 75,
    utilityMultiplier: [4, 10],
  },
  // 29
  {
    index: 29,
    type: 'PROPERTY',
    name: 'Marvin Gardens',
    group: 'YELLOW',
    price: 280,
    mortgageValue: 140,
    housePrice: 150,
    hotelPrice: 150,
    rent: [24, 120, 360, 850, 1025, 1200],
  },
  // 30
  { index: 30, type: 'GO_TO_JAIL', name: 'Go to Jail' },
  // 31
  {
    index: 31,
    type: 'PROPERTY',
    name: 'Pacific Avenue',
    group: 'GREEN',
    price: 300,
    mortgageValue: 150,
    housePrice: 200,
    hotelPrice: 200,
    rent: [26, 130, 390, 900, 1100, 1275],
  },
  // 32
  {
    index: 32,
    type: 'PROPERTY',
    name: 'North Carolina Avenue',
    group: 'GREEN',
    price: 300,
    mortgageValue: 150,
    housePrice: 200,
    hotelPrice: 200,
    rent: [26, 130, 390, 900, 1100, 1275],
  },
  // 33
  { index: 33, type: 'COMMUNITY_CHEST', name: 'Community Chest' },
  // 34
  {
    index: 34,
    type: 'PROPERTY',
    name: 'Pennsylvania Avenue',
    group: 'GREEN',
    price: 320,
    mortgageValue: 160,
    housePrice: 200,
    hotelPrice: 200,
    rent: [28, 150, 450, 1000, 1200, 1400],
  },
  // 35
  {
    index: 35,
    type: 'RAILROAD',
    name: 'Short Line',
    group: 'RAILROAD',
    price: 200,
    mortgageValue: 100,
    railroadRent: [25, 50, 100, 200],
  },
  // 36
  { index: 36, type: 'CHANCE', name: 'Chance' },
  // 37
  {
    index: 37,
    type: 'PROPERTY',
    name: 'Park Place',
    group: 'DARK_BLUE',
    price: 350,
    mortgageValue: 175,
    housePrice: 200,
    hotelPrice: 200,
    rent: [35, 175, 500, 1100, 1300, 1500],
  },
  // 38
  { index: 38, type: 'LUXURY_TAX', name: 'Luxury Tax', taxAmount: 75 },
  // 39
  {
    index: 39,
    type: 'PROPERTY',
    name: 'Boardwalk',
    group: 'DARK_BLUE',
    price: 400,
    mortgageValue: 200,
    housePrice: 200,
    hotelPrice: 200,
    rent: [50, 200, 600, 1400, 1700, 2000],
  },
]

export function getTile(index: number): BoardTile {
  const tile = BOARD_TILES[index]
  if (!tile) throw new Error(`Invalid tile index: ${index}`)
  return tile
}

export function getTilesByGroup(group: PropertyGroup): BoardTile[] {
  return BOARD_TILES.filter((t) => t.group === group)
}
