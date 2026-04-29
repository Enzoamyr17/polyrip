import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

const SALT_ROUNDS = 12
const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = '7d'

export async function registerUser(name: string, password: string): Promise<string> {
  const existing = await prisma.user.findFirst({ where: { name } })
  if (existing) throw new Error('Username already taken')

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const user = await prisma.user.create({ data: { name, passwordHash } })
  return user.id
}

export async function loginUser(name: string, password: string): Promise<string> {
  const user = await prisma.user.findFirst({ where: { name } })
  if (!user) throw new Error('Invalid credentials')
  if (user.status !== 'ACTIVE') throw new Error('Account suspended')

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new Error('Invalid credentials')

  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string }
}
