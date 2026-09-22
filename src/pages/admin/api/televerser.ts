import type { APIRoute } from 'astro';
import { db, insererLigne, prochainePosition } from '../../../lib/db';
import {
  reconnaitre,
  traiterImage,
  enregistrerVideo,
  TAILLE_MAX_IMAGE,
  TAILLE_MAX_VIDEO,
} from '../../../lib/media';
import { nettoyer, cheminInterne, ancreSure, retourVers } from '../../../lib/admin';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.utilisateur) return new Response('Non authentifié', { status: 401 });

  const f = await request.formData();
  const retour = cheminInterne(f.get('retour'), '/admin/medias');
  const ancre = ancreSure(f.get('ancre'));
  const sur = (m: string) => redirect(retourVers(retour, m, ancre), 303);

  const fichier = f.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) return sur('err=fichier');

  // Deuxième plafond. Le premier est dans le middleware, sur l'en-tête
  // « Content-Length », et lui seul évite vraiment de charger 500 Mo en
  // mémoire : à ce stade-ci, `formData()` a déjà tout lu. Celui-ci
  // applique la limite métier, fichier par fichier.
  if (fichier.size > TAILLE_MAX_VIDEO) {
    return sur('err=lourd');
  }

  const octets = Buffer.from(await fichier.arrayBuffer());

  // Le type est déduit des premiers octets, jamais de l'extension ni de
  // l'en-tête envoyé par le navigateur.
  const signature = reconnaitre(octets);
  if (!signature) {
    return sur('err=format');
  }

  const limite = signature.type === 'image' ? TAILLE_MAX_IMAGE : TAILLE_MAX_VIDEO;
  if (octets.length > limite) {
    return sur('err=lourd');
  }

  try {
    const alt = nettoyer(f.get('alt'), 300);
    const legende = nettoyer(f.get('legende'), 300);
    const bichromie = f.get('sans_bichromie') ? 0 : 1;

    let mediaId: number;

    if (signature.type === 'image') {
      const r = await traiterImage(octets, { bichromie: bichromie === 1 });
      mediaId = Number(
        db
          .prepare(
            `INSERT INTO medias (type, fichier, mime, largeur, hauteur, octets, alt, legende, variantes, bichromie)
             VALUES ('image', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            r.fichier,
            r.mime,
            r.largeur,
            r.hauteur,
            r.octets,
            alt,
            legende,
            JSON.stringify(r.variantes),
            bichromie
          ).lastInsertRowid
      );
    } else {
      const r = enregistrerVideo(octets, signature.ext, signature.mime);
      mediaId = Number(
        db
          .prepare(
            `INSERT INTO medias (type, fichier, mime, octets, alt, legende, variantes, bichromie)
             VALUES ('video', ?, ?, ?, ?, ?, '{}', 0)`
          )
          .run(r.fichier, r.mime, r.octets, alt, legende).lastInsertRowid
      );
    }

    // Rattachement immédiat, quand l'envoi vient d'une fiche projet.
    const rattacher = String(f.get('rattacher') ?? '');
    const projetId = Number(f.get('projet_id') ?? 0);
    if (projetId) {
      if (rattacher === 'hero') {
        db.prepare('UPDATE projets SET hero_id = ? WHERE id = ?').run(mediaId, projetId);
      } else if (rattacher === 'video_fond') {
        db.prepare('UPDATE projets SET video_fond_id = ? WHERE id = ?').run(mediaId, projetId);
      } else if (rattacher === 'galerie') {
        insererLigne('projet_medias', {
          projet_id: projetId,
          media_id: mediaId,
          position: prochainePosition('projet_medias', 'WHERE projet_id = ?', projetId),
          legende,
        });
      }
    }

    const ecranId = Number(f.get('ecran_id') ?? 0);
    if (ecranId) {
      const colonne = signature.type === 'video' ? 'video_id' : 'media_id';
      db.prepare(`UPDATE accueil_ecrans SET ${colonne} = ? WHERE id = ?`).run(mediaId, ecranId);
    }

    if (f.get('portrait') === '1') {
      db.prepare(
        "INSERT INTO reglages (cle, valeur) VALUES ('portrait_id', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur"
      ).run(String(mediaId));
    }

    return sur('ok=1');
  } catch (e: any) {
    console.error('[admin] téléversement impossible :', e);
    return sur('err=media');
  }
};
