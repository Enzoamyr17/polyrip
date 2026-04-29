import { Server as HttpServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { log } from '../lib/logger'
import { registerGameHandlers } from './handlers/game-handlers'
import { afkDaemon } from './afk-daemon'

export interface AuthenticatedSocket extends Socket {
  userId: string
  playerId?: string
}

export function initSocketServer(httpServer: HttpServer): SocketServer {
  const JWT_SECRET = process.env.JWT_SECRET

  if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET env var is not set. Socket auth will fail for every connection.')
  }

  const io = new SocketServer(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000', credentials: true },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined

    if (!token) {
      log.fail('auth', 'AUTH_REQUIRED', `socket:${socket.id.slice(0, 6)} — no token provided`)
      return next(new Error('AUTH_REQUIRED'))
    }

    if (!JWT_SECRET) {
      log.fail('auth', 'CONFIG_ERROR', 'JWT_SECRET not set')
      return next(new Error('CONFIG_ERROR'))
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })

      if (!user) {
        log.fail('auth', 'USER_NOT_FOUND', `userId:${payload.userId.slice(0, 8)}`)
        return next(new Error('FORBIDDEN'))
      }
      if (user.status !== 'ACTIVE') {
        log.fail('auth', 'FORBIDDEN', `user:${user.name} status:${user.status}`)
        return next(new Error('FORBIDDEN'))
      }

      ;(socket as AuthenticatedSocket).userId = payload.userId
      log.connect(payload.userId, socket.id)
      next()
    } catch (err) {
      log.fail('auth', 'INVALID_TOKEN', err instanceof Error ? err.message : String(err))
      next(new Error('INVALID_TOKEN'))
    }
  })

  io.on('connection', (socket) => {
    registerGameHandlers(io, socket as AuthenticatedSocket)
  })

  afkDaemon(io)

  return io
}
