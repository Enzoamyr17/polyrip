'use client'
import dynamic from 'next/dynamic'

const GameApp = dynamic(() => import('./game-app').then((m) => ({ default: m.GameApp })), {
  ssr: false,
  loading: () => null,
})

export function ClientShell() {
  return <GameApp />
}
