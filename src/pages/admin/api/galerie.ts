import type { APIRoute } from 'astro';
import { db, insererLigne, prochainePosition } from '../../../lib/db';
import { cheminInterne, ancreSure, retourVers, nettoyer, identifiantYoutube } from '../../../lib/admin';

export const prerender = false;

/**
 * Alimenter la galerie d'un projet sans passer par la médiathèque.
 *
 * L'envoi d'un fichier reste traité par `televerser.ts`, qui sait découper
 * une image en quatre tailles. Cette route-ci couvre les deux autres
 * façons d'ajouter une vue : reprendre un fichier déjà présent sur le site,
 * ou coller un lien YouTube.
 *
 * On accepte l'adresse complète autant que l'identifiant seul : personne
 * ne copie un identifiant YouTube à la main, on copie la barre d'adresse.
 */
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.utilisateur) return new Response('Non authentifié', { status: 401 });

  const f = await request.formData();
  const retour = cheminInterne(f.get('retour'), '/admin/projets');
  const ancre = ancreSure(f.get('ancre'));
  const sur = (m: string) => redirect(retourVers(retour, m, ancre), 303);

  const projetId = Number(f.get('projet_id') ?? 0);
  if (!projetId) return sur('err=action');

  // Le projet doit exister : sans ce contrôle, la clé étrangère
  // refuserait l'insertion avec un message illisible.
  const projet = db.prepare('SELECT id FROM projets WHERE id = ?').get(projetId);
  if (!projet) return sur('err=introuvable');

  const action = String(f.get('action') ?? '');
  const legende = nettoyer(f.get('legende'), 300);
  const position = prochainePosition('projet_medias', 'WHERE projet_id = ?', projetId);

  try {
    if (action === 'media') {
      const mediaId = Number(f.get('media_id') ?? 0);
      if (!mediaId) return sur('err=action');
      // Le média doit exister, et c'est vérifié ici plutôt que laissé à la
      // clé étrangère : on veut un message compréhensible, pas une
      // exception SQLite.
      const existe = db.prepare('SELECT id FROM medias WHERE id = ?').get(mediaId);
      if (!existe) return sur('err=introuvable');
      insererLigne('projet_medias', { projet_id: projetId, media_id: mediaId, position, legende });
      return sur('ok=1');
    }

    if (action === 'youtube') {
      const id = identifiantYoutube(String(f.get('youtube') ?? ''));
      if (!id) return sur('err=youtube');
      insererLigne('projet_medias', {
        projet_id: projetId,
        media_id: null,
        youtube: id,
        position,
        legende,
      });
      return sur('ok=1');
    }

    return sur('err=action');
  } catch (e) {
    console.error('[admin] ajout à la galerie impossible :', e);
    return sur('err=echec');
  }
};
