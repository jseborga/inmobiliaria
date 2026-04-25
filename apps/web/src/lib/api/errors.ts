/**
 * Error tipado para respuestas no-2xx de la API.
 * Conserva el statusCode y el body parseado para que la UI lo presente.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
  }

  /** Mensaje legible para mostrar al usuario, si la API lo trae. */
  get displayMessage(): string {
    if (this.body && typeof this.body === 'object') {
      const b = this.body as { message?: string | string[]; error?: string };
      if (Array.isArray(b.message)) return b.message.join(', ');
      if (typeof b.message === 'string') return b.message;
      if (typeof b.error === 'string') return b.error;
    }
    return this.message;
  }
}
