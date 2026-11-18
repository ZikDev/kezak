import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { json, refusApp } from '../../../lib/api-app';

export const prerender = false;

/** Test de connexion de l'application, et nombre de messages non lus. */
export const GET: APIRoute = ({ locals }) => {
  if (locals.appVerifiee !== true) return refusApp(401, 'Signature refusée');
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE lu = 0').get() as { n: number };
  return json({ ok: true, api: 1, nonLus: n, heure: new Date().toISOString() });
};
