import type { APIRoute } from 'astro';
import { majLigne, definirReglage, db } from '../../../lib/db';
import {
  champsAutorises,
  REGLAGES_AUTORISES,
  nettoyer,
  slugifier,
  cheminInterne,
  ancreSure,
  retourVers,
  identifiantYoutube,
  lienSur,
  REGLAGES_LIENS,
  COLONNES_LIEN,
  CATEGORIES,
} from '../../../lib/admin';

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
      if (REGLAGES_LIENS.has(nom)) {
        const propre = lienSur(valeur);
        if (propre === '' && String(valeur ?? '').trim() !== '') return sur('err=lien');
        definirReglage(nom, propre);
      } else {
        definirReglage(nom, nettoyer(valeur, 4000));
      }
      reglages++;
    }

    const table = String(f.get('table') ?? '');
    const id = Number(f.get('id') ?? 0);

    if (table && id) {
      const champs = champsAutorises(table, f);

      // Une adresse refusée est vidée par le filtre. Sans ce contrôle, on
      // cliquait « Enregistrer », on lisait « Modifications enregistrées »,
      // et le champ revenait vide sans un mot — ce qui donne l'impression
      // que le site a perdu la saisie. On refuse l'enregistrement entier et
      // on le dit : rien n'est écrit, la saisie est encore dans la page.
      //
      // Le contrôle porte sur TOUTES les colonnes-adresses, et non sur la
      // seule « url » : « lien_url », celle d'un écran d'accueil, se
      // vidait en silence — le défaut même que ces lignes corrigent.
      for (const col of COLONNES_LIEN) {
        if (champs[col] === '' && String(f.get(`c_${col}`) ?? '').trim() !== '') {
          return sur('err=lien');
        }
      }

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
        // Même raison qu'à la création : la catégorie sert de filtre, elle
        // ne peut valoir que l'une des six.
        if (champs.categorie !== undefined && !CATEGORIES.some((c) => c.valeur === champs.categorie)) {
          champs.categorie = 'autre';
        }
        if (champs.youtube !== undefined) {
          // On accepte une adresse collée et on n'en garde que
          // l'identifiant. Le contrôle de l'hôte est celui de la galerie :
          // il était écrit ici en plus court, et acceptait n'importe quel
          // site contenant « v= » dans son adresse.
          const avant = String(champs.youtube ?? '').trim();
          champs.youtube = identifiantYoutube(avant);
          if (avant !== '' && champs.youtube === '') return sur('err=youtube');
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
