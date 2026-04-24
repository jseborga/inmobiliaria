/**
 * Contrato común para todos los drivers de storage (R2 real o mock local).
 * Expone dos responsabilidades mínimas:
 *   - emitir una URL presigned para que el cliente suba el archivo directamente.
 *   - devolver la URL pública final a persistir en la DB.
 */
export interface PresignedUpload {
  /** URL donde el cliente hace PUT con el body del archivo. */
  uploadUrl: string;
  /** Método HTTP a usar para la subida (casi siempre PUT). */
  method: 'PUT';
  /** Headers que el cliente debe enviar exactamente como se devuelven. */
  headers: Record<string, string>;
  /** Expira en segundos. */
  expiresIn: number;
  /** Key interna en el bucket (la misma que se persiste en DB). */
  r2Key: string;
  /** URL pública donde se servirá la imagen una vez subida. */
  publicUrl: string;
}

export interface PresignRequest {
  tenantId: string;
  propertyId: string;
  contentType: string;
  contentLength: number;
}
