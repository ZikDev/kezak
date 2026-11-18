/**
 * API privée de l'application Kezak (Windows).
 *
 * Elle permet à l'application de lire les messages du formulaire de contact
 * et de noter qu'une réponse est partie. Rien d'autre : pas d'écriture
 * publique, pas de suppression, pas d'accès aux projets ni aux réglages.
 *
 * Authentification : chaque requête est SIGNÉE, aucune clé ne circule.
 *
 *   — une clé secrète partagée, `APP_API_CLE`, dans le .env du serveur et
 *     dans l'application (chiffrée par Windows). Elle n'est jamais envoyée :
 *     elle sert seulement à calculer la signature ;
 *   — la signature est un HMAC-SHA256 de la méthode, du chemin, de
 *     l'horodatage, d'un nonce et de l'empreinte du corps. Modifier l'un de
 *     ces éléments invalide la signature ;
 *   — l'horodatage doit être à moins de cinq minutes de l'heure du serveur,
 *     et chaque nonce n'est accepté qu'une fois : une requête interceptée ne
 *     peut pas être rejouée ;
 *   — les échecs sont comptés par adresse IP et au total, avec les mêmes
 *     compteurs que la page de connexion ; au-delà, refus sans examen ;
 *   — sans clé configurée (ou trop courte), l'API n'existe pas : 404.
 *
 * Cette API ne touche ni aux cookies ni à la session de l'admin. Elle
 * n'ouvre aucun accès à /admin.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './db';
import { tropDeTentatives, noterTentative } from './auth';

export const PREFIXE_API_APP = '/api/app/';

/** Fenêtre de validité d'une requête signée, en secondes, dans les deux sens. */
const FENETRE = 300;
/** Corps maximal accepté : l'API ne reçoit que de petits JSON. */
export const LIMITE_CORPS_APP = 16 * 1024;
/** Une clé de moins de 32 octets encodés en base64url (43 caractères) est refusée. */
const LONGUEUR_MIN_CLE = 43;

const ENTETE_HORODATAGE = 'x-kezak-horodatage';
const ENTETE_NONCE = 'x-kezak-nonce';
const ENTETE_SIGNATURE = 'x-kezak-signature';

export function cleApp(): string | null {
  const cle = (process.env.APP_API_CLE || '').trim();
  return cle.length >= LONGUEUR_MIN_CLE ? cle : null;
}

const sha256hex = (texte: string) => createHash('sha256').update(texte, 'utf8').digest('hex');

/** Le texte signé. Le client (main/portfolio.js dans l'application) construit exactement le même. */
export function texteASigner(
  methode: string,
  chemin: string,
  horodatage: string,
  nonce: string,
  corps: string
) {
  return ['KEZAK-APP-1', methode.toUpperCase(), chemin, horodatage, nonce, sha256hex(corps)].join(
    '\n'
  );
}

export function signer(cle: string, texte: string) {
  return createHmac('sha256', cle).update(texte, 'utf8').digest('hex');
}

export type Verdict =
  | { ok: true }
  | { ok: false; statut: number; raison: string };

/**
 * Vérifie une requête signée. N'écrit en base que le nonce (si tout est
 * valide) et les tentatives échouées.
 */
export function verifierRequeteApp(
  request: Request,
  url: URL,
  corps: string,
  ip: string
): Verdict {
  const cle = cleApp();
  if (!cle) return { ok: false, statut: 404, raison: 'Introuvable' };

  const cleIp = `app-ip:${ip}`;
  if (tropDeTentatives(cleIp, 10, 900) || tropDeTentatives('app-global', 100, 900)) {
    return { ok: false, statut: 429, raison: 'Trop de tentatives, réessayez plus tard.' };
  }

  const echec = (statut = 401, raison = 'Signature refusée'): Verdict => {
    noterTentative(cleIp);
    noterTentative('app-global');
    return { ok: false, statut, raison };
  };

  const horodatage = request.headers.get(ENTETE_HORODATAGE) || '';
  const nonce = request.headers.get(ENTETE_NONCE) || '';
  const signature = request.headers.get(ENTETE_SIGNATURE) || '';

  if (!/^\d{9,11}$/.test(horodatage)) return echec();
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(nonce)) return echec();
  if (!/^[0-9a-f]{64}$/.test(signature)) return echec();

  const ecart = Math.abs(Math.floor(Date.now() / 1000) - Number(horodatage));
  if (ecart > FENETRE) return echec(401, 'Horloge décalée ou requête périmée');

  const attendue = signer(cle, texteASigner(request.method, url.pathname + url.search, horodatage, nonce, corps));
  const a = Buffer.from(attendue, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return echec();

  // Le nonce n'est enregistré qu'après une signature valide : un inconnu ne
  // peut pas remplir la table. Rejoué, il heurte la clé primaire.
  const maintenant = Date.now();
  db.prepare('DELETE FROM app_nonces WHERE horodate < ?').run(maintenant - 2 * FENETRE * 1000);
  const r = db
    .prepare('INSERT OR IGNORE INTO app_nonces (nonce, horodate) VALUES (?, ?)')
    .run(nonce, maintenant);
  if (r.changes !== 1) return echec(401, 'Requête déjà utilisée');

  return { ok: true };
}

/** Réponse JSON de l'API : jamais mise en cache, jamais indexée. */
export function json(donnees: unknown, statut = 200) {
  return new Response(JSON.stringify(donnees), {
    status: statut,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

/** Message d'erreur en texte brut. */
export function refusApp(statut: number, raison: string) {
  return new Response(raison, {
    status: statut,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
