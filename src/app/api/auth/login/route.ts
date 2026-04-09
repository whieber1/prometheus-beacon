import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const validUsername = process.env.MC_USERNAME;
  const validPassword = process.env.MC_PASSWORD;

  if (!validUsername || !validPassword) {
    // Should never happen — server.ts auto-generates credentials on startup.
    // If it does, the user started Next.js directly instead of via server.ts.
    return NextResponse.json(
      { error: 'Auth not configured. Start with: npm run dev (not next dev)' },
      { status: 500 },
    );
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
