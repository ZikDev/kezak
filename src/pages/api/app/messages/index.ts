import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { json, refusApp } from '../../../../lib/api-app';

export const prerender = false;

/**
 * Les messages du formulaire de contact, du plus récent au plus ancien.
 * Lecture seule. `?limite=` entre 1 et 200 (100 par défaut).
 */
export const GET: APIRoute = ({ locals, url }) => {
  if (locals.appVerifiee !== true) return refusApp(401, 'Signature refusée');
  const brute = Number(url.searchParams.get('limite') || 100);
  const limite = Number.isFinite(brute) ? Math.min(200, Math.max(1, Math.floor(brute))) : 100;
  const messages = db
    .prepare(
      `SELECT id, nom, orga, email, tel, besoins, echeance, budget, corps, lu, cree_le, repondu_le
       FROM messages ORDER BY id DESC LIMIT ?`
    )
    .all(limite) as any[];
  return json({
    messages: messages.map((m) => ({
      ...m,
      lu: !!m.lu,
      // Les dates SQLite sont en UTC sans fuseau : on le précise.
      cree_le: m.cree_le ? m.cree_le.replace(' ', 'T') + 'Z' : '',
      repondu_le: m.repondu_le ? m.repondu_le.replace(' ', 'T') + 'Z' : '',
    })),
  });
};
