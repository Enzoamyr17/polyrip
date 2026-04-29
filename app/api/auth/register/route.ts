import { NextRequest, NextResponse } from 'next/server'
import { registerUser } from '../../../../src/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { name, password } = await req.json()
    if (!name || !password) return NextResponse.json({ error: 'Name and password required' }, { status: 400 })
    const userId = await registerUser(name, password)
    return NextResponse.json({ userId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
