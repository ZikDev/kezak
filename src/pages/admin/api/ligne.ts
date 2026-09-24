import type { APIRoute } from 'astro';
import {
  db,
  insererLigne,
  supprimerLigne,
  prochainePosition,
  TABLES_ADMIN,
} from '../../../lib/db';
import { CHAMPS, cheminInterne, ancreSure, retourVers } from '../../../lib/admin';

export const prerender = false;

/** Ajoute, supprime ou déplace une ligne d'une liste ordonnée. */
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.utilisateur) return new Response('Non authentifié', { status: 401 });

  const f = await request.formData();
  const retour = cheminInterne(f.get('retour'), '/admin');
  const table = String(f.get('table') ?? '');
  const action = String(f.get('action') ?? '');
  const id = Number(f.get('id') ?? 0);
  const projetId = Number(f.get('projet_id') ?? 0) || null;

  const ancre = ancreSure(f.get('ancre'));
  const sur = (m: string) => redirect(retourVers(retour, m, ancre), 303);

  if (!TABLES_ADMIN.has(table) || !CHAMPS[table]) return sur('err=table');

  try {
    if (action === 'ajouter') {
      // La galerie ne se remplit plus par une ligne vide : depuis que
      // « media_id » est facultatif, plus rien n'empêchait d'en créer une
      // qui ne référence ni fichier ni vidéo — invisible partout, et donc
      // impossible à supprimer. Elle passe par sa route dédiée.
      if (table === 'projet_medias') return sur('err=action');
      const champs: Record<string, any> = {};
      if (projetId) champs.projet_id = projetId;
      champs.position = projetId
        ? prochainePosition(table, 'WHERE projet_id = ?', projetId)
        : prochainePosition(table);
      insererLigne(table, champs);
    } else if (action === 'supprimer' && id) {
      // Un média n'est pas qu'une ligne : ce sont aussi quatre fichiers sur
      // le disque. Cette route générique les laissait derrière elle, et
      // seule la route dédiée faisait le ménage — la médiathèque se vidait
      // à l'écran pendant que le dossier « uploads » continuait de grossir.
      if (table === 'medias') return sur('err=action');
      supprimerLigne(table, id);
    } else if ((action === 'monter' || action === 'descendre') && id) {
      const ligne = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as any;
      if (!ligne) return sur('err=introuvable');
      const sens = action === 'monter' ? '<' : '>';
      const ordre = action === 'monter' ? 'DESC' : 'ASC';
      // Le projet auquel appartient la ligne est lu SUR LA LIGNE, et non
      // repris du formulaire. En se fiant au champ envoyé, on cherchait la
      // voisine dans le projet indiqué par l'appelant : un identifiant
      // forgé faisait échanger la position d'une ligne avec celle d'une
      // ligne d'un autre projet, et désordonnait les deux. Un champ caché
      // décrit ce que l'on regarde, il ne décide pas de ce que l'on touche.
      const sonProjet = ligne.projet_id ?? null;
      const filtre = sonProjet === null ? '' : 'AND projet_id = ?';
      const voisine = db
        .prepare(
          `SELECT * FROM ${table}
           WHERE (position ${sens} ? OR (position = ? AND id ${sens} ?)) ${filtre}
           ORDER BY position ${ordre}, id ${ordre} LIMIT 1`
        )
        .get(ligne.position, ligne.position, ligne.id, ...(sonProjet === null ? [] : [sonProjet])) as any;
      if (voisine) {
        const maj = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
        db.transaction(() => {
          maj.run(voisine.position, ligne.id);
          maj.run(ligne.position, voisine.id);
        })();
      }
    } else {
      return sur('err=action');
    }
    return sur('ok=1');
  } catch (e: any) {
    console.error('[admin] action sur une ligne impossible :', e);
    return sur('err=echec');
  }
};
