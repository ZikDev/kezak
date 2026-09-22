import type { APIRoute } from 'astro';
import { majLigne, definirReglage, db } from '../../../lib/db';
import { champsAutorises, REGLAGES_AUTORISES, nettoyer, slugifier, cheminInterne, ancreSure, retourVers } from '../../../lib/admin';

export const prerender = false;

/**
 * Enregistre une ligne d'une table de contenu, ou un lot de réglages.
 * Le middleware a déjà vérifié la session, l'origine et le jeton anti-CSRF.
 */
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.utilisateur) return new Response('Non authentifié', { status: 401 });

  const f = await request.formData();
  const retour = cheminInterne(f.get('retour'), '/admin');
  const ancre = ancreSure(f.get('ancre'));
  const sur = (m: string) => redirect(retourVers(retour, m, ancre), 303);

  try {
    // Lot de réglages : tous les champs nommés r_<clé>.
    let reglages = 0;
    for (const [cle, valeur] of f.entries()) {
      if (!cle.startsWith('r_')) continue;
      const nom = cle.slice(2);
      if (!REGLAGES_AUTORISES.has(nom)) continue;
      definirReglage(nom, nettoyer(valeur, 4000));
      reglages++;
    }

    const table = String(f.get('table') ?? '');
    const id = Number(f.get('id') ?? 0);

    if (table && id) {
      const champs = champsAutorises(table, f);

      if (table === 'projets') {
        // Le slug est toujours normalisé, et reste unique.
        if (champs.slug !== undefined) {
          let base = slugifier(champs.slug || String(champs.titre ?? '')) || `projet-${id}`;
          let candidat = base;
          let n = 2;
          while (
            db.prepare('SELECT id FROM projets WHERE slug = ? AND id <> ?').get(candidat, id)
          ) {
            candidat = `${base}-${n++}`;
          }
          champs.slug = candidat;
        }
        if (champs.statut !== undefined && !['brouillon', 'publie'].includes(champs.statut)) {
          champs.statut = 'brouillon';
        }
        if (champs.youtube !== undefined) {
          // On accepte une URL collée et on n'en garde que l'identifiant.
          const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/.exec(champs.youtube);
          champs.youtube = m ? m[1] : /^[A-Za-z0-9_-]{6,20}$/.test(champs.youtube) ? champs.youtube : '';
        }
      }

      majLigne(table, id, champs);
    } else if (reglages === 0) {
      return sur('err=rien');
    }

    return sur('ok=1');
  } catch (e: any) {
    // Le message brut de SQLite reste dans le journal : il décrit le schéma,
    // il n'a rien à faire dans la barre d'adresse de l'administrateur.
    console.error('[admin] enregistrement impossible :', e);
    return sur('err=echec');
  }
};
