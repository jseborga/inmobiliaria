'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort: igual mandamos al login
    }
    toast.success('Sesión cerrada');
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} disabled={loading}>
      <LogOut className="mr-2 h-4 w-4" />
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </Button>
  );
}
