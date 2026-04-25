import { NextResponse, type NextRequest } from 'next/server';
import { ApiError } from '@/lib/api';
import { getPublicApi } from '@/lib/api/public';

/**
 * Proxy server-side de la captura de leads pública.
 *
 * El cliente postea aquí; el server llama a `POST /public/leads` del API
 * preservando:
 *   - el tenantSlug resuelto por middleware (subdominio / header)
 *   - el `User-Agent` del cliente (relevante para auditoría)
 *
 * IP y referrer los toma el API directamente del request en producción
 * (X-Forwarded-For del reverse proxy).
 */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  }

  const api = getPublicApi();
  try {
    const result = await api.post('/public/leads', payload, {
      headers: {
        ...(req.headers.get('user-agent')
          ? { 'User-Agent': req.headers.get('user-agent') as string }
          : {}),
        ...(req.headers.get('referer')
          ? { Referer: req.headers.get('referer') as string }
          : {}),
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json(
      { message: 'Error al enviar el lead' },
      { status: 500 },
    );
  }
}
