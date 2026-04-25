import Link from 'next/link';
import type { ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/sidebar';
import { LogoutButton } from '@/components/admin/logout-button';
import { requireUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser('/admin');
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="border-b p-4">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5" />
            <span className="truncate">{user.tenant.name}</span>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {user.tenant.slug}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminSidebar />
        </div>
        <div className="border-t p-3 text-sm">
          <p className="truncate font-medium">{fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.role.toLowerCase()} · {user.email}
          </p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3 md:hidden">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Building2 className="h-5 w-5" />
            {user.tenant.name}
          </Link>
          <LogoutButton />
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
