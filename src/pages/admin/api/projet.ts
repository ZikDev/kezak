import type { APIRoute } from 'astro';
import { db, prochainePosition } from '../../../lib/db';
import { nettoyer, slugifier, CATEGORIES } from '../../../lib/admin';

export const prerender = false;

/**
 * Crée un projet à partir du gabarit défini avec la direction artistique :
 * les quatre temps de l'étude de cas et une première ligne de générique sont
 * déjà là. On remplit, on ne construit pas la structure à chaque fois.
 */
const SECTIONS = ['Le contexte', 'Le problème', "Ce que j'ai fait", 'Le résultat'];

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  if (!locals.utilisateur) return new Response('Non authentifié', { status: 401 });

  const f = await request.formData();
  const titre = nettoyer(f.get('titre'), 160);
  if (!titre) return redirect('/admin/projets/nouveau?err=titre', 303);

  let base = slugifier(titre) || 'projet';
  let slug = base;
  let n = 2;
  while (db.prepare('SELECT id FROM projets WHERE slug = ?').get(slug)) slug = `${base}-${n++}`;

  // La catégorie n'est pas un texte libre : c'est elle qui sert de filtre
  // sur la page des projets. Une valeur inconnue y créait un bouton
  // fantôme, ou pire, rangeait le projet dans une catégorie qui
  // n'existait nulle part ailleurs.
  const categorieBrute = nettoyer(f.get('categorie'), 30);
  const categorie = CATEGORIES.some((c) => c.valeur === categorieBrute) ? categorieBrute : 'autre';
  const annee = nettoyer(f.get('annee'), 20);
  const categorieTxt = nettoyer(f.get('categorie_txt'), 80);
  const avecGabarit = f.get('gabarit') === '1';

  const id = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO projets (slug, titre, categorie, categorie_txt, annee, statut, position)
         VALUES (?, ?, ?, ?, ?, 'brouillon', ?)`
      )
      .run(slug, titre, categorie, categorieTxt, annee, prochainePosition('projets'));
    const projetId = Number(res.lastInsertRowid);

    if (avecGabarit) {
      const s = db.prepare(
        'INSERT INTO projet_sections (projet_id, position, titre, corps) VALUES (?, ?, ?, ?)'
      );
      SECTIONS.forEach((titreSection, i) => s.run(projetId, i, titreSection, ''));

      db.prepare(
        'INSERT INTO projet_faits (projet_id, position, etiquette, valeur) VALUES (?, 0, ?, ?)'
      ).run(projetId, 'Année', annee);

      db.prepare(
        'INSERT INTO projet_credits (projet_id, position, poste, noms, cest_moi) VALUES (?, 0, ?, ?, 1)'
      ).run(projetId, 'Mon rôle', 'Victor Bertschy');
    }
    return projetId;
  })();

  return redirect(`/admin/projets/${id}?ok=1`, 303);
};
