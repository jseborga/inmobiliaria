import type { Metadata } from 'next';
import './globals.css';
// CSS de Leaflet a nivel raíz: lo necesitan tanto el mapa público como el
// LocationPicker del admin. Importarlo acá garantiza que esté disponible
// cuando el componente se carga vía dynamic import (sin llegar tarde).
import 'leaflet/dist/leaflet.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: {
    default: 'Inmobiliaria',
    template: '%s · Inmobiliaria',
  },
  description: 'Marketplace inmobiliario multi-tenant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
