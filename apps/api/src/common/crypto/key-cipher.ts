import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Cifrado simétrico para secretos persistidos (API keys de IA).
 *
 * Algoritmo: AES-256-GCM (autenticado, IV único por valor).
 *
 * Master key: env var `AI_KEYS_SECRET` — string arbitrario, lo hasheamos a
 * 32 bytes con SHA-256 para uniformar la longitud. Recomendado:
 *
 *   openssl rand -base64 32
 *
 * Formato del ciphertext almacenado:  v1:<iv-base64>:<authTag-base64>:<ct-base64>
 *
 * Si AI_KEYS_SECRET no está configurada, las funciones lanzan. Esto es
 * intencional — fail-safe: preferimos que el deploy falle a guardar/leer
 * keys con un secreto temporal y "olvidarlas" después.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recomendado para GCM
const KEY_LENGTH = 32; // AES-256
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const raw = process.env.AI_KEYS_SECRET;
  if (!raw || raw.trim().length < 8) {
    throw new Error(
      'AI_KEYS_SECRET no configurada. Generala con `openssl rand -base64 32` y seteala en el env del API.',
    );
  }
  // Derivamos 32 bytes determinísticamente (cualquier longitud de input).
  return createHash('sha256').update(raw).digest();
}

/**
 * Encripta un string. Devuelve el ciphertext serializado con formato versionado.
 * Si plaintext es vacío/null, devuelve null (no almacenamos vacíos).
 */
export function encryptKey(plaintext: string | null | undefined): string | null {
  if (!plaintext || plaintext.length === 0) return null;
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/**
 * Desencripta. Devuelve null si el input es null o no está bien formado.
 * Lanza si la master key no puede leerse o si el authTag no valida (key
 * rotada o ciphertext corrupto).
 */
export function decryptKey(serialized: string | null | undefined): string | null {
  if (!serialized) return null;
  const parts = serialized.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Ciphertext con formato desconocido');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivB64!, 'base64');
  const authTag = Buffer.from(tagB64!, 'base64');
  const ct = Buffer.from(ctB64!, 'base64');
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('IV o authTag con longitud inválida');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Devuelve solo los primeros 4 y últimos 4 caracteres del key, ofuscando
 * el medio. Útil para mostrar en la UI sin exponer la key completa.
 *
 *   maskKey('sk-ant-api03-abc...XYZ') → 'sk-a••••XXYZ'
 */
export function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/** True si AI_KEYS_SECRET está disponible (las keys se pueden persistir). */
export function isCipherReady(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}
