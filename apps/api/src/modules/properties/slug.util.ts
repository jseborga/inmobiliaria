import { randomBytes } from 'node:crypto';

/** Normaliza un título a kebab-case ASCII. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

export function randomSuffix(bytes = 3): string {
  return randomBytes(bytes).toString('hex');
}
