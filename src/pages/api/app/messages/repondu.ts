import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db';
import { json, refusApp } from '../../../../lib/api-app';

export const prerender = false;

/**
 * La seule écriture de l'API : noter qu'une réponse est partie.
 * Corps JSON : { "id": 12 }. Le message est aussi marqué comme lu.
 */
export const POST: APIRoute = ({ locals }) => {
  if (locals.appVerifiee !== true) return refusApp(401, 'Signature refusée');
  let id = 0;
  try {
    id = Number(JSON.parse(locals.corpsApp || '{}')?.id);
  } catch {
    id = 0;
  }
  if (!Number.isSafeInteger(id) || id <= 0) return refusApp(400, 'Identifiant invalide');
  const r = db
    .prepare("UPDATE messages SET repondu_le = datetime('now'), lu = 1 WHERE id = ?")
    .run(id);
  if (r.changes !== 1) return refusApp(404, 'Message introuvable');
  return json({ ok: true, id });
};
