/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@inmobiliaria/shared'],
  // Standalone output empaqueta el server + dependencias mínimas en
  // `.next/standalone`, lo que nos deja correr `node server.js` sin pnpm
  // ni node_modules completo en el runtime image (~150 MB → ~50 MB).
  output: 'standalone',
  experimental: {
    typedRoutes: true,
    // Habilita instrumentation.ts → carga de Sentry en boot.
    instrumentationHook: true,
  },
};

export default nextConfig;
