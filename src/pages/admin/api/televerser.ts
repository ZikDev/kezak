import type { APIRoute } from 'astro';
import { db, insererLigne, prochainePosition } from '../../../lib/db';
import {
  reconnaitre,
  traiterImage,
  enregistrerFichier,
  tailleMax,
  TAILLE_MAX_VIDEO,
  type GenreMedia,
} from '../../../lib/media';
import { nettoyer, nettoyerLigne, cheminInterne, ancreSure, retourVers } from '../../../lib/admin';

export const prerender = false;

/**
 * Où un fichier peut être rattaché, selon ce qu'il est.
 *
 * Le contrôle se fait AVANT l'enregistrement. Il n'existait pas : une image
 * envoyée avec « rattacher à la boucle vidéo » devenait la boucle vidéo du
 * projet, et la page publique affichait un lecteur vide. Avec les PDF, ce
 * serait pire — un document posé en héros ou dans la galerie.
 */
// Une « Map » et non un objet : avec un objet, « rattacher=constructor »
// renvoyait le constructeur d'Object au lieu d'une liste, et la route
// tombait en erreur 500.
const ACCEPTE = new Map<string, readonly GenreMedia[]>([
  ['hero', ['image']],
  ['video_fond', ['video']],
  ['galerie', ['image', 'video']],
  ['pdf', ['pdf']],
]);


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

  if (octets.length > tailleMax(signature.type)) {
    return sur('err=lourd');
  }

  // --- Où va-t-il ? Vérifié avant d'écrire quoi que ce soit sur le disque.
  const rattacher = String(f.get('rattacher') ?? '');
  const projetId = Number(f.get('projet_id') ?? 0);
  const ecranId = Number(f.get('ecran_id') ?? 0);
  const portrait = f.get('portrait') === '1';

  const permis = ACCEPTE.get(rattacher);
  if (projetId && rattacher && permis && !permis.includes(signature.type)) {
    return sur('err=genre');
  }
  // Un écran d'accueil prend une image ou une vidéo ; le portrait, une image.
  if (ecranId && signature.type === 'pdf') return sur('err=genre');
  if (portrait && signature.type !== 'image') return sur('err=genre');

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
      // Vidéo ou PDF : le fichier est gardé tel quel, sous un nom aléatoire.
      const r = enregistrerFichier(octets, signature.ext, signature.mime);
      mediaId = Number(
        db
          .prepare(
            `INSERT INTO medias (type, fichier, mime, octets, alt, legende, variantes, bichromie)
             VALUES (?, ?, ?, ?, ?, ?, '{}', 0)`
          )
          .run(signature.type, r.fichier, r.mime, r.octets, alt, legende).lastInsertRowid
      );
    }

    // Rattachement immédiat, quand l'envoi vient d'une fiche projet.
    if (projetId) {
      if (rattacher === 'hero') {
        db.prepare('UPDATE projets SET hero_id = ? WHERE id = ?').run(mediaId, projetId);
      } else if (rattacher === 'video_fond') {
        db.prepare('UPDATE projets SET video_fond_id = ? WHERE id = ?').run(mediaId, projetId);
      } else if (rattacher === 'pdf') {
        db.prepare('UPDATE projets SET pdf_id = ? WHERE id = ?').run(mediaId, projetId);
        // Le titre de la section peut être donné en même temps que le
        // fichier ; vide, il ne remplace pas celui qui existe déjà.
        const titre = nettoyerLigne(f.get('pdf_titre'), 80);
        if (titre) db.prepare('UPDATE projets SET pdf_titre = ? WHERE id = ?').run(titre, projetId);
      } else if (rattacher === 'galerie') {
        insererLigne('projet_medias', {
          projet_id: projetId,
          media_id: mediaId,
          position: prochainePosition('projet_medias', 'WHERE projet_id = ?', projetId),
          legende,
        });
      }
    }

    if (ecranId) {
      const colonne = signature.type === 'video' ? 'video_id' : 'media_id';
      db.prepare(`UPDATE accueil_ecrans SET ${colonne} = ? WHERE id = ?`).run(mediaId, ecranId);
    }

    if (portrait) {
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
