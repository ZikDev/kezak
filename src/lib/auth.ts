/**
 * Authentification et sessions.
 *
 * Choix : scrypt de node:crypto plutôt qu'Argon2. C'est une fonction de
 * dérivation à coût mémoire, recommandée par l'OWASP, et elle est dans la
 * bibliothèque standard — donc aucun module natif supplémentaire à compiler
 * sur l'hébergement mutualisé, qui est là où ces paquets cassent.
 *
 * Le jeton de session n'est jamais stocké : seule son empreinte SHA-256 va
 * en base. Un vol de la base ne permet donc pas d'ouvrir une session.
 */
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { db } from './db';
import { hacher, verifier } from './motdepasse.mjs';

export const hacherMotDePasse = (mdp: string): Promise<string> => hacher(mdp);
export const verifierMotDePasse = (mdp: string, stocke: string): Promise<boolean> =>
  verifier(mdp, stocke);

export const COOKIE_SESSION = 'kezak_session';
const DUREE_GLISSANTE_JOURS = 7;
const DUREE_ABSOLUE_JOURS = 30;

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex');

export function creerSession(userId: number, ip: string, agent: string) {
  const jeton = randomBytes(32).toString('base64url');
  const maintenant = Date.now();
  db.prepare(
    `INSERT INTO sessions (id, user_id, expire_le, absolu_le, ip, agent)
     VALUES (?, ?, datetime(?, 'unixepoch'), datetime(?, 'unixepoch'), ?, ?)`
  ).run(
    empreinte(jeton),
    userId,
    Math.floor((maintenant + DUREE_GLISSANTE_JOURS * 864e5) / 1000),
    Math.floor((maintenant + DUREE_ABSOLUE_JOURS * 864e5) / 1000),
    ip.slice(0, 64),
    agent.slice(0, 255)
  );
  return { jeton, maxAge: DUREE_ABSOLUE_JOURS * 86400 };
}

export function utilisateurDeSession(jeton: string | undefined) {
  if (!jeton) return null;
  const ligne = db
    .prepare(
      `SELECT s.id, s.user_id, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expire_le > datetime('now') AND s.absolu_le > datetime('now')`
    )
    .get(empreinte(jeton)) as { id: string; user_id: number; email: string } | undefined;
  if (!ligne) return null;

  // Expiration glissante : chaque requête authentifiée repousse l'échéance,
  // sans jamais dépasser l'échéance absolue.
  db.prepare(
    `UPDATE sessions SET expire_le = MIN(datetime('now', '+${DUREE_GLISSANTE_JOURS} days'), absolu_le) WHERE id = ?`
  ).run(ligne.id);

  return { id: ligne.user_id, email: ligne.email };
}

export function detruireSession(jeton: string | undefined) {
  if (!jeton) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(empreinte(jeton));
}

export function detruireToutesLesSessions(userId: number) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function nettoyerSessions() {
  db.prepare("DELETE FROM sessions WHERE expire_le <= datetime('now') OR absolu_le <= datetime('now')").run();
}

export function utilisateurParEmail(email: string) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as
    | { id: number; email: string; mot_de_passe: string }
    | undefined;
}

export function marquerConnexion(userId: number) {
  db.prepare("UPDATE users SET vu_le = datetime('now') WHERE id = ?").run(userId);
}

/* --- Limitation de débit ------------------------------------------ */

export function tropDeTentatives(cle: string, max: number, fenetreSecondes: number): boolean {
  const depuis = Date.now() - fenetreSecondes * 1000;
  db.prepare('DELETE FROM tentatives WHERE horodate < ?').run(Date.now() - 86400_000);
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM tentatives WHERE cle = ? AND horodate > ?')
    .get(cle, depuis) as { n: number };
  return n >= max;
}

export function noterTentative(cle: string) {
  db.prepare('INSERT INTO tentatives (cle, horodate) VALUES (?, ?)').run(cle, Date.now());
}

export function effacerTentatives(cle: string) {
  db.prepare('DELETE FROM tentatives WHERE cle = ?').run(cle);
}

/* --- Anti-CSRF ----------------------------------------------------- */

export const COOKIE_CSRF = 'kezak_csrf';

export function nouveauJetonCsrf() {
  return randomBytes(24).toString('base64url');
}

export function csrfValide(cookie: string | undefined, envoye: unknown): boolean {
  if (!cookie || typeof envoye !== 'string' || envoye.length < 16) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(envoye);
  return a.length === b.length && timingSafeEqual(a, b);
}
