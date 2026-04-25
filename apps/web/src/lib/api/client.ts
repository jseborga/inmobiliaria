import { ApiError } from './errors';

/**
 * Cliente HTTP minimalista sobre fetch nativo.
 *
 * Diseño:
 * - Un único punto de configuración (`createApiClient`) para inyectar
 *   `baseUrl`, `accessToken` y `tenantSlug` desde el caller.
 * - Server-side se construye por request (con headers desde middleware).
 * - Client-side se obtiene vía hook (`useApi()`) que toma la sesión del
 *   provider.
 * - Los errores no-2xx se convierten en `ApiError` con body parseado.
 */

export interface ApiClientOptions {
  baseUrl: string;
  accessToken?: string | null;
  tenantSlug?: string | null;
  /** Forwardea cookies al backend (refresh token httpOnly). Solo server-side. */
  cookieHeader?: string | null;
  /** Cache strategy de Next.js (server-side). */
  cache?: RequestCache;
  /** Tags para revalidación granular (server-side). */
  tags?: string[];
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  /** Querystring serializable. */
  query?: Record<string, string | number | boolean | undefined | null>;
  cache?: RequestCache;
  tags?: string[];
}

export interface ApiClient {
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  get<T = unknown>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  delete<T = unknown>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const baseUrl = opts.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers, query, cache, tags, ...rest } = options;
    const url = buildUrl(baseUrl, path, query);

    const finalHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(headers ?? {}),
    };
    if (body !== undefined && !(body instanceof FormData)) {
      finalHeaders['Content-Type'] ??= 'application/json';
    }
    if (opts.accessToken) {
      finalHeaders['Authorization'] ??= `Bearer ${opts.accessToken}`;
    }
    if (opts.tenantSlug) {
      finalHeaders['X-Tenant-Slug'] ??= opts.tenantSlug;
    }
    if (opts.cookieHeader) {
      finalHeaders['Cookie'] ??= opts.cookieHeader;
    }

    const init: RequestInit = {
      ...rest,
      headers: finalHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
          ? body
          : JSON.stringify(body),
    };

    // Next.js extensions: cache + tags solo aplican en server.
    if (cache ?? opts.cache) (init as RequestInit & { cache?: RequestCache }).cache = cache ?? opts.cache;
    if (tags ?? opts.tags) {
      (init as RequestInit & { next?: { tags?: string[] } }).next = {
        tags: tags ?? opts.tags,
      };
    }

    const res = await fetch(url, init);

    // 204 No Content
    if (res.status === 204) return undefined as T;

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      throw new ApiError(res.status, payload);
    }
    return payload as T;
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}
