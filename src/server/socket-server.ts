import { Server as HttpServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { registerGameHandlers } from './handlers/game-handlers'
import { afkDaemon } from './afk-daemon'

export interface AuthenticatedSocket extends Socket {
  userId: string
  playerId?: string
}

const JWT_SECRET = process.env.JWT_SECRET!

export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000', credentials: true },
  })

  // Auth middleware — verify JWT on every connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('AUTH_REQUIRED'))

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (!user || user.status !== 'ACTIVE') return next(new Error('FORBIDDEN'))
      ;(socket as AuthenticatedSocket).userId = payload.userId
      next()
    } catch {
      next(new Error('INVALID_TOKEN'))
    }
  })

  io.on('connection', (socket) => {
    registerGameHandlers(io, socket as AuthenticatedSocket)
  })

  // Start AFK timer daemon
  afkDaemon(io)

  return io
}
