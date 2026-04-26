import { Play, Compass, ExternalLink } from 'lucide-react';

interface MediaViewerProps {
  videoUrl?: string | null;
  tour360Url?: string | null;
}

/**
 * Convierte URL de YouTube/Vimeo a embed src. Si no es reconocible, devuelve null
 * (el caller cae a un link con thumbnail). Soporta:
 *   - youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
 *   - vimeo.com/ID
 */
function videoEmbedSrc(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.pathname.startsWith('/embed/')) return raw;
  }
  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === 'player.vimeo.com') return raw;
  return null;
}

/**
 * Algunos proveedores de tour 360 soportan iframe; otros bloquean por X-Frame-Options.
 * Whitelist pragmática: matterport, kuula, pannellum. Para el resto, mostramos link
 * "abrir en nueva pestaña" en vez de iframe roto.
 */
function tour360EmbedSrc(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (
    host.endsWith('matterport.com') ||
    host.endsWith('kuula.co') ||
    host.endsWith('360cities.net')
  ) {
    return raw;
  }
  return null;
}

export function MediaViewer({ videoUrl, tour360Url }: MediaViewerProps) {
  if (!videoUrl && !tour360Url) return null;

  const videoSrc = videoUrl ? videoEmbedSrc(videoUrl) : null;
  const tourSrc = tour360Url ? tour360EmbedSrc(tour360Url) : null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Recorrido</h2>

      {videoUrl ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Play className="h-4 w-4" />
            Video
          </p>
          {videoSrc ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
              <iframe
                src={videoSrc}
                title="Video de la propiedad"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          ) : (
            <ExternalLinkCard href={videoUrl} label="Ver video" />
          )}
        </div>
      ) : null}

      {tour360Url ? (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Compass className="h-4 w-4" />
            Tour 360°
          </p>
          {tourSrc ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
              <iframe
                src={tourSrc}
                title="Tour 360 de la propiedad"
                allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
                allowFullScreen
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          ) : (
            <ExternalLinkCard href={tour360Url} label="Abrir tour 360" />
          )}
        </div>
      ) : null}
    </section>
  );
}

function ExternalLinkCard({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-3 text-sm hover:bg-muted"
    >
      <ExternalLink className="h-4 w-4" />
      {label}
    </a>
  );
}
