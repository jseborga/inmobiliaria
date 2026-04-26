'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PlatformLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await fetch('/api/platform-admin/auth/logout', { method: 'POST' });
      router.push('/platform-admin/login' as never);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      <LogOut className="mr-2 h-4 w-4" />
      {pending ? 'Saliendo…' : 'Salir'}
    </Button>
  );
}
