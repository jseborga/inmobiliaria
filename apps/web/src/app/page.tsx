export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Inmobiliaria</h1>
      <p className="mt-4 text-lg text-slate-600">
        Plataforma multi-tenant en construcción. Fase 2: estructura base lista.
      </p>
      <ul className="mt-8 space-y-2 text-sm text-slate-500">
        <li>• Marketplace global (próximamente)</li>
        <li>• Sitios por inmobiliaria vía subdominio</li>
        <li>• Panel admin con gestión de propiedades y leads</li>
      </ul>
    </main>
  );
}
