import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const validUsername = process.env.MC_USERNAME;
  const validPassword = process.env.MC_PASSWORD;
  if (!validUsername || !validPassword) {
    return NextResponse.json({ error: 'Server not configured — set MC_USERNAME and MC_PASSWORD env vars' }, { status: 500 });
  }

  if (username === validUsername && password === validPassword) {
    const session = await getSession();
    session.isLoggedIn = true;
    session.username = username;
    await session.save();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ success: true });
}
