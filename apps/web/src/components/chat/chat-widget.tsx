'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SuggestedProperty {
  id: string;
  slug: string;
  title: string;
  price: string;
  currency: string;
  operation: string;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  suggested?: SuggestedProperty[];
  ts: number;
}

interface Props {
  tenantSlug: string;
  /** Nombre de la inmobiliaria (para mostrar en el header del widget). */
  tenantName?: string;
  /** Path o full URL para los links de propiedades sugeridas. Default: /properties/[slug] */
  propertyHref?: (slug: string) => string;
}

const STORAGE_KEY_PREFIX = 'inmo:chat:session:';
const HISTORY_KEY_PREFIX = 'inmo:chat:history:';

function makeSessionId(): string {
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fmtPrice(p: SuggestedProperty): string {
  const n = Number(p.price);
  const symbol = p.currency === 'USD' ? '$us' : 'Bs';
  return Number.isFinite(n) ? `${symbol} ${n.toLocaleString('es-BO')}` : `${symbol} ${p.price}`;
}

function opLabel(op: string): string {
  return op === 'SALE' ? 'Venta' : op === 'RENT' ? 'Alquiler' : op === 'ANTICRETICO' ? 'Anticrético' : op;
}

/**
 * Widget flotante de chat. Aparece como botón redondo bottom-right; click abre
 * panel con historial + input.
 *
 * Persistencia:
 *   - sessionId guardado en localStorage por tenantSlug → mismo hilo entre
 *     sesiones del navegador.
 *   - historial visible (últimos N mensajes) también en localStorage.
 *   - El backend igual mantiene la sesión completa en DB.
 */
export function ChatWidget({ tenantSlug, tenantName, propertyHref }: Props) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Inicializar session + cargar historial.
  useEffect(() => {
    const sk = STORAGE_KEY_PREFIX + tenantSlug;
    const hk = HISTORY_KEY_PREFIX + tenantSlug;
    let sid = localStorage.getItem(sk);
    if (!sid) {
      sid = makeSessionId();
      localStorage.setItem(sk, sid);
    }
    setSessionId(sid);
    try {
      const raw = localStorage.getItem(hk);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        setMessages(parsed.slice(-30));
      }
    } catch {
      // ignore corrupt history
    }
  }, [tenantSlug]);

  // Persistir historial cuando cambia.
  useEffect(() => {
    if (!sessionId) return;
    const hk = HISTORY_KEY_PREFIX + tenantSlug;
    try {
      localStorage.setItem(hk, JSON.stringify(messages.slice(-30)));
    } catch {
      // localStorage full or disabled — ignore
    }
  }, [messages, sessionId, tenantSlug]);

  // Auto-scroll al fondo cuando llegan mensajes nuevos.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || !sessionId || busy) return;
    setInput('');
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      const res = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, sessionId, message: text }),
      });
      const body = (await res.json().catch(() => null)) as
        | { reply?: string; suggestedProperties?: SuggestedProperty[]; message?: string }
        | null;
      if (!res.ok || !body?.reply) {
        const err: Message = {
          id: `e-${Date.now()}`,
          role: 'bot',
          text: body?.message ?? 'No pude procesar tu mensaje. Probá en unos segundos.',
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, err]);
        return;
      }
      const reply: Message = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: body.reply,
        suggested: body.suggestedProperties,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'bot',
          text: 'No pude conectarme. Revisá tu conexión.',
          ts: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const linkBuilder = propertyHref ?? ((slug) => `/properties/${slug}`);

  return (
    <>
      {/* Botón flotante */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
          aria-label="Abrir chat"
        >
          <MessageCircle className="h-4 w-4" />
          Chatear
        </button>
      ) : null}

      {/* Panel de chat */}
      {open ? (
        <div
          className="fixed bottom-0 right-0 z-50 flex h-[min(640px,100vh)] w-full flex-col bg-card shadow-2xl sm:bottom-5 sm:right-5 sm:h-[min(560px,80vh)] sm:w-[min(380px,calc(100vw-2.5rem))] sm:rounded-lg sm:border"
          role="dialog"
          aria-label="Chat"
        >
          <header className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground sm:rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/15">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">
                  {tenantName ?? 'Asesor virtual'}
                </p>
                <p className="text-[10px] opacity-80">en línea</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
                <Bot className="h-8 w-8 opacity-40" />
                <p>
                  ¡Hola! Soy el asesor virtual. Contame qué buscás (zona, presupuesto, tipo de
                  propiedad) y te ayudo a encontrarla.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex',
                    m.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-card border rounded-bl-sm',
                    )}
                  >
                    {m.text}
                    {m.suggested && m.suggested.length > 0 ? (
                      <div className="mt-2 space-y-1.5 border-t pt-2">
                        <p className="text-[10px] uppercase tracking-wide opacity-70">
                          Propiedades que te pueden interesar
                        </p>
                        {m.suggested.slice(0, 3).map((p) => (
                          <Link
                            key={p.id}
                            href={
                              `${linkBuilder(p.slug)}?tenantSlug=${tenantSlug}` as never
                            }
                            target="_blank"
                            className="block rounded-md border bg-background p-2 text-xs hover:bg-muted"
                          >
                            <p className="font-medium text-foreground">{p.title}</p>
                            <p className="text-muted-foreground">
                              {opLabel(p.operation)} · {fmtPrice(p)}
                            </p>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {busy ? (
              <div className="flex justify-start">
                <div className="rounded-lg border bg-card px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t bg-card p-3 sm:rounded-b-lg"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribí tu consulta…"
              disabled={busy}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
