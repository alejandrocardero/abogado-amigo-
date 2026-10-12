/**
 * Utilidades de hashing con Web Crypto.
 *
 * Centraliza el derivado de contraseñas (registro/login de cuentas) y el
 * hashing de contenido (detección de versiones de documentos indexados).
 * Todo usa `crypto.subtle`, disponible en navegadores y Node 18.19+.
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32; // 256 bits
const PBKDF2_ALGORITHM = 'PBKDF2';

/** Genera una sal aleatoria de 16 bytes como hex en minúsculas (32 chars). */
export function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deriva una clave usando PBKDF2-HMAC-SHA256.
 * Cumple con OWASP/ASVS para almacenamiento de contraseñas (mínimo 100k iteraciones).
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: PBKDF2_ALGORITHM },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: PBKDF2_ALGORITHM,
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );

  return Array.from(new Uint8Array(derivedBits), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Calcula el SHA-256 del texto UTF-8 y lo devuelve como hex en minúsculas. */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Indica si el entorno expone Web Crypto (`crypto.subtle`). */
export function secureContextAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}
