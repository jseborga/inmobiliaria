import type { ReactNode } from 'react';

/**
 * Layout del área de super-admin. Pelado a propósito — cada page decide
 * si requiere auth (login no, dashboard sí). El header con info del admin
 * y el botón de salir vive en cada page autenticada para no leer la sesión
 * de más en pages públicas.
 */
export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-muted/20">{children}</div>;
}
