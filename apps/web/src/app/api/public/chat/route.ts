import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

/** Proxy del widget de chat al endpoint público del API. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  const apiRes = await fetch(`${env.internalApiUrl}/public/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await apiRes.json().catch(() => ({}));
  return NextResponse.json(payload, { status: apiRes.status });
}
