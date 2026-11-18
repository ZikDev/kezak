import type { APIRoute } from 'astro';
import { json, refusApp } from '../../../lib/api-app';
import { resumeStatistiques } from '../../../lib/statistiques';

export const prerender = false;

/** Statistiques de fréquentation. `?jours=` entre 1 et 365 (30 par défaut). Lecture seule. */
export const GET: APIRoute = ({ locals, url }) => {
  if (locals.appVerifiee !== true) return refusApp(401, 'Signature refusée');
  const brut = Number(url.searchParams.get('jours') || 30);
  const jours = Number.isFinite(brut) ? Math.min(365, Math.max(1, Math.floor(brut))) : 30;
  return json(resumeStatistiques(jours));
};
