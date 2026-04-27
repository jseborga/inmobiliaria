'use client';

import { useState } from 'react';
import { CalendarCheck, Loader2, Phone, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Step = 'phone' | 'otp' | 'details' | 'done';

interface Props {
  tenantSlug: string;
  propertyId: string;
  propertyTitle: string;
}

/**
 * Modal de 3 pasos para agendar visita.
 *  1. phone   → ingresar teléfono + nombre, click "Enviar código"
 *  2. otp     → ingresar código de 6 dígitos
 *  3. details → fecha/hora + nota opcional, confirmar
 *  done       → confirmación visual
 */
export function VisitBookingModal({ tenantSlug, propertyId, propertyTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('phone');
  const [busy, setBusy] = useState(false);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [otpDelivered, setOtpDelivered] = useState(false);
  const [otpReason, setOtpReason] = useState<string | null>(null);

  function reset() {
    setStep('phone');
    setPhone('');
    setName('');
    setEmail('');
    setCode('');
    setScheduledAt('');
    setNotes('');
    setOtpDelivered(false);
    setOtpReason(null);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function requestOtp() {
    if (!phone.trim() || !name.trim()) {
      toast.error('Completá nombre y teléfono');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/public/visits/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          tenantSlug,
          propertyId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        delivered?: boolean;
        deliveryReason?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(body.message ?? 'No pudimos enviar el código');
        return;
      }
      setOtpDelivered(!!body.delivered);
      setOtpReason(body.deliveryReason ?? null);
      setStep('otp');
      if (body.delivered) {
        toast.success('Código enviado por WhatsApp');
      } else if (body.deliveryReason === 'TEST_MODE') {
        toast.info('Modo prueba activo. El código quedó en logs del servidor.');
      } else {
        toast.warning(
          'WhatsApp no configurado por la inmobiliaria. Pedile el código por otro canal.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function bookVisit() {
    if (!code.trim() || !scheduledAt) {
      toast.error('Completá el código y la fecha/hora');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/public/visits/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          propertyId,
          visitorName: name.trim(),
          visitorPhone: phone.trim(),
          visitorEmail: email.trim() || undefined,
          otpCode: code.trim(),
          scheduledAt: new Date(scheduledAt).toISOString(),
          notes: notes.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        toast.error(body.message ?? 'No pudimos crear la visita');
        return;
      }
      setStep('done');
      toast.success('¡Visita agendada!');
    } finally {
      setBusy(false);
    }
  }

  // Mínimo +1h, máximo +30 días
  const minDt = new Date(Date.now() + 60 * 60_000);
  const maxDt = new Date(Date.now() + 30 * 86_400_000);
  const minDtStr = minDt.toISOString().slice(0, 16);
  const maxDtStr = maxDt.toISOString().slice(0, 16);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full" size="lg">
        <CalendarCheck className="mr-2 h-5 w-5" />
        Solicitar visita
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-md rounded-lg bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">
                {step === 'done' ? '¡Listo!' : 'Solicitar visita'}
              </h2>
              <button onClick={close} aria-label="Cerrar">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-5">
              {step === 'phone' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Te enviamos un código por WhatsApp para confirmar tu número.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="vname">Nombre completo</Label>
                    <Input
                      id="vname"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vphone">Teléfono (WhatsApp)</Label>
                    <Input
                      id="vphone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+591 7..."
                      inputMode="tel"
                      autoComplete="tel"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato internacional con código de país (ej: +591 77...).
                    </p>
                  </div>
                  <Button onClick={requestOtp} disabled={busy} className="w-full">
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="mr-2 h-4 w-4" />
                    )}
                    Enviar código
                  </Button>
                </>
              ) : null}

              {step === 'otp' ? (
                <>
                  <div
                    className={cn(
                      'rounded-md border-l-4 px-3 py-2 text-xs',
                      otpDelivered
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                        : 'border-amber-400 bg-amber-50 text-amber-900',
                    )}
                  >
                    {otpDelivered
                      ? `Te mandamos un código a ${phone}. Revisá WhatsApp.`
                      : otpReason === 'TEST_MODE'
                        ? 'Modo prueba: el código está en los logs del servidor (pediselo a la inmobiliaria).'
                        : 'WhatsApp no está configurado. Contactá a la inmobiliaria por otro canal.'}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="votp">Código de 6 dígitos</Label>
                    <Input
                      id="votp"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={6}
                      className="text-center font-mono text-lg tracking-widest"
                    />
                  </div>
                  <Button
                    onClick={() => setStep('details')}
                    disabled={code.length !== 6}
                    className="w-full"
                  >
                    Continuar
                  </Button>
                  <button
                    onClick={() => {
                      setStep('phone');
                      setCode('');
                    }}
                    className="block w-full text-center text-xs text-muted-foreground hover:underline"
                  >
                    Volver a ingresar teléfono
                  </button>
                </>
              ) : null}

              {step === 'details' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Visita a <strong>{propertyTitle}</strong>. Elegí cuándo querés ir y la
                    inmobiliaria confirma.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="vsched">Fecha y hora</Label>
                    <Input
                      id="vsched"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      min={minDtStr}
                      max={maxDtStr}
                    />
                    <p className="text-xs text-muted-foreground">
                      Próximas 4 semanas. La inmobiliaria confirma o sugiere otro horario.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vemail">Email (opcional)</Label>
                    <Input
                      id="vemail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="te enviamos confirmación"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vnotes">Nota opcional</Label>
                    <Textarea
                      id="vnotes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="¿Algo que el agente deba saber?"
                    />
                  </div>
                  <Button onClick={bookVisit} disabled={busy} className="w-full">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirmar visita
                  </Button>
                </>
              ) : null}

              {step === 'done' ? (
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                    <CalendarCheck className="h-6 w-6 text-emerald-700" />
                  </div>
                  <p className="font-medium">¡Tu solicitud fue registrada!</p>
                  <p className="text-sm text-muted-foreground">
                    La inmobiliaria recibirá la solicitud y se va a contactar para confirmar
                    el horario.
                  </p>
                  <Button onClick={close} variant="outline" className="w-full">
                    Cerrar
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
