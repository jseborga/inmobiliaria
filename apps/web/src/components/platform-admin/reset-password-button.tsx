'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { resetUserPasswordAction } from '@/lib/actions/platform-tenants';

interface ResetPasswordButtonProps {
  tenantId: string;
  userId: string;
  userEmail: string;
}

export function ResetPasswordButton({
  tenantId,
  userId,
  userEmail,
}: ResetPasswordButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    const newPassword = window.prompt(
      `Nueva contraseña para ${userEmail} (mín 8 caracteres, máx 72):`,
    );
    if (!newPassword) return;
    if (newPassword.length < 8) {
      toast.error('La password debe tener al menos 8 caracteres');
      return;
    }
    setPending(true);
    try {
      const res = await resetUserPasswordAction(tenantId, userId, { newPassword });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Password reseteada. Sesiones del user revocadas.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <KeyRound className="mr-1 h-3.5 w-3.5" />
      {pending ? 'Reseteando…' : 'Resetear password'}
    </Button>
  );
}
