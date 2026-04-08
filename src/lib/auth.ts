import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'set-SESSION_SECRET-env-var-before-running',
  cookieName: 'mc-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  },
};

export interface SessionData {
  isLoggedIn: boolean;
  username?: string;
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
