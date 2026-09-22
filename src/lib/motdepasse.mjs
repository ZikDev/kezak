/**
 * Hachage de mot de passe — scrypt de la bibliothèque standard.
 *
 * Pas d'Argon2 : c'est un module natif de plus à compiler, et c'est
 * exactement ce qui casse sur un hébergement mutualisé. scrypt est une
 * fonction à coût mémoire recommandée par l'OWASP, et elle est déjà là.
 *
 * Fichier en .mjs pour être importable à la fois par l'application et par
 * les scripts de maintenance lancés en Node pur.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// N = 2^16, r = 8, p = 1 — environ 64 Mo de mémoire par calcul.
export const PARAMS = { N: 65536, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };

export async function hacher(motDePasse) {
  const sel = randomBytes(16);
  const cle = await scryptAsync(String(motDePasse).normalize('NFKC'), sel, 64, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    sel.toString('base64'),
    cle.toString('base64'),
  ].join('$');
}

export async function verifier(motDePasse, stocke) {
  try {
    const [algo, N, r, p, selB64, cleB64] = String(stocke).split('$');
    if (algo !== 'scrypt') return false;
    const sel = Buffer.from(selB64, 'base64');
    const attendu = Buffer.from(cleB64, 'base64');
    const calcule = await scryptAsync(String(motDePasse).normalize('NFKC'), sel, attendu.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 160 * 1024 * 1024,
    });
    return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
  } catch {
    return false;
  }
}
