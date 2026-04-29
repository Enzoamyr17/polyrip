const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BLUE = '\x1b[34m'
const MAGENTA = '\x1b[35m'

function ts() {
  return DIM + new Date().toTimeString().slice(0, 8) + RESET
}

function short(id: string | null | undefined, len = 8) {
  return id ? id.slice(0, len) : 'n/a'
}

export const log = {
  connect(userId: string, socketId: string) {
    console.log(`${ts()} ${CYAN}${BOLD}CONNECT  ${RESET} user:${short(userId)} socket:${short(socketId, 6)}`)
  },

  disconnect(userId: string, socketId: string) {
    console.log(`${ts()} ${DIM}DISCONN  ${RESET} user:${short(userId)} socket:${short(socketId, 6)}`)
  },

  action(event: string, userId: string, extra?: Record<string, unknown>) {
    const extras = extra ? '  ' + Object.entries(extra).map(([k, v]) => `${k}:${v}`).join(' ') : ''
    console.log(`${ts()} ${BLUE}${BOLD}→ ${event.padEnd(14)}${RESET} user:${short(userId)}${extras}`)
  },

  ok(event: string, detail: string) {
    console.log(`${ts()} ${GREEN}${BOLD}✓ ${event.padEnd(14)}${RESET} ${detail}`)
  },

  fail(event: string, code: string, message: string) {
    console.log(`${ts()} ${YELLOW}${BOLD}✗ ${event.padEnd(14)}${RESET} ${YELLOW}${code}${RESET} ${message}`)
  },

  error(event: string, err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error(`${ts()} ${RED}${BOLD}✗ ${event.padEnd(14)}${RESET} ${RED}${msg}${RESET}`)
    if (stack) console.error(DIM + stack + RESET)
  },

  db(op: string, detail: string) {
    console.log(`${ts()} ${MAGENTA}  db:${op.padEnd(12)}${RESET} ${DIM}${detail}${RESET}`)
  },
}
