/**
 * Couche d'accès aux données.
 *
 * Tout passe par ce fichier. Si l'hébergement impose un jour MariaDB
 * plutôt que SQLite, c'est le seul fichier à réécrire : le reste du site
 * n'appelle que les fonctions exportées ici.
 */
import './env.mjs'; // charge le .env avant toute lecture de process.env
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { SCHEMA } from './schema.mjs';
import { migrationsEnAttente } from './migrations.mjs';

const DATA_DIR = process.env.DATA_DIR || './data';
const dataDir = isAbsolute(DATA_DIR) ? DATA_DIR : resolve(process.cwd(), DATA_DIR);
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, 'kezak.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/* ------------------------------------------------------------------ */
/* Schéma                                                              */
/* ------------------------------------------------------------------ */

export function migrer() {
  // D'abord les tables manquantes, ensuite les changements de structure sur
  // une base déjà remplie — « CREATE TABLE IF NOT EXISTS » ne modifie jamais
  // une table existante, c'est migrations.mjs qui s'en charge.
  db.exec(SCHEMA);
  const faites = migrationsEnAttente(db);
  for (const nom of faites) console.log(`[base] migration appliquée — ${nom}`);
}

/* ------------------------------------------------------------------ */
/* Réglages (singletons de texte : coordonnées, SEO, en-têtes de page) */
/* ------------------------------------------------------------------ */

export function reglage(cle: string, defaut = ''): string {
  const l = db.prepare('SELECT valeur FROM reglages WHERE cle = ?').get(cle) as
    | { valeur: string }
    | undefined;
  return l ? l.valeur : defaut;
}

export function tousReglages(): Record<string, string> {
  const lignes = db.prepare('SELECT cle, valeur FROM reglages').all() as {
    cle: string;
    valeur: string;
  }[];
  return Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]));
}

export function definirReglage(cle: string, valeur: string) {
  db.prepare(
    'INSERT INTO reglages (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur'
  ).run(cle, valeur);
}

/* ------------------------------------------------------------------ */
/* Lectures pour le site public                                        */
/* ------------------------------------------------------------------ */

export type Projet = Record<string, any>;

export function projetsPublies(): Projet[] {
  return db
    .prepare("SELECT * FROM projets WHERE statut = 'publie' ORDER BY position ASC, id ASC")
    .all() as Projet[];
}

export function projetsEnAvant(limite = 3): Projet[] {
  return db
    .prepare(
      "SELECT * FROM projets WHERE statut = 'publie' AND en_avant = 1 ORDER BY position ASC, id ASC LIMIT ?"
    )
    .all(limite) as Projet[];
}

export function projetParSlug(slug: string): Projet | undefined {
  return db.prepare('SELECT * FROM projets WHERE slug = ?').get(slug) as Projet | undefined;
}

export function projetParId(id: number): Projet | undefined {
  return db.prepare('SELECT * FROM projets WHERE id = ?').get(id) as Projet | undefined;
}

export function projetSuivant(projet: Projet): Projet | undefined {
  return (
    (db
      .prepare(
        "SELECT * FROM projets WHERE statut = 'publie' AND (position > ? OR (position = ? AND id > ?)) ORDER BY position ASC, id ASC LIMIT 1"
      )
      .get(projet.position, projet.position, projet.id) as Projet | undefined) ??
    (db
      .prepare("SELECT * FROM projets WHERE statut = 'publie' ORDER BY position ASC, id ASC LIMIT 1")
      .get() as Projet | undefined)
  );
}

const listeOrdonnee = (table: string) => (where = '', ...params: any[]) =>
  db
    .prepare(`SELECT * FROM ${table} ${where} ORDER BY position ASC, id ASC`)
    .all(...params) as Record<string, any>[];

export const sectionsDuProjet = (id: number) =>
  listeOrdonnee('projet_sections')('WHERE projet_id = ?', id);
export const faitsDuProjet = (id: number) =>
  listeOrdonnee('projet_faits')('WHERE projet_id = ?', id);
export const creditsDuProjet = (id: number) =>
  listeOrdonnee('projet_credits')('WHERE projet_id = ?', id);

/**
 * Le contenu de la galerie d'un projet.
 *
 * Jointure ouverte (« LEFT JOIN ») et non fermée : une entrée YouTube ne
 * référence aucun fichier du site, et une jointure fermée l'aurait
 * silencieusement écartée du résultat.
 */
export function mediasDuProjet(id: number) {
  return db
    .prepare(
      `SELECT pm.*, m.fichier, m.alt, m.largeur, m.hauteur, m.variantes, m.type, m.bichromie
       FROM projet_medias pm LEFT JOIN medias m ON m.id = pm.media_id
       WHERE pm.projet_id = ? AND (pm.media_id IS NOT NULL OR pm.youtube <> '')
       ORDER BY pm.position ASC, pm.id ASC`
    )
    .all(id) as Record<string, any>[];
}

export const prestations = () => listeOrdonnee('prestations')();
export const methode = () => listeOrdonnee('methode')();
export const faq = () => listeOrdonnee('faq')();
export const parcours = () => listeOrdonnee('parcours')();
export const etapesContact = () => listeOrdonnee('etapes_contact')();

export function ecransAccueil() {
  return db
    .prepare('SELECT * FROM accueil_ecrans WHERE actif = 1 ORDER BY position ASC, id ASC')
    .all() as Record<string, any>[];
}

export function media(id: number | null | undefined) {
  if (!id) return undefined;
  return db.prepare('SELECT * FROM medias WHERE id = ?').get(id) as Record<string, any> | undefined;
}

/* ------------------------------------------------------------------ */
/* Écritures génériques utilisées par l'admin                          */
/* ------------------------------------------------------------------ */

/** Tables que l'admin a le droit de modifier par le formulaire générique. */
export const TABLES_ADMIN = new Set([
  'accueil_ecrans',
  'projets',
  'projet_sections',
  'projet_faits',
  'projet_credits',
  'projet_medias',
  'prestations',
  'methode',
  'faq',
  'parcours',
  'etapes_contact',
  'medias',
]);

export function majLigne(table: string, id: number, champs: Record<string, any>) {
  if (!TABLES_ADMIN.has(table)) throw new Error('Table non autorisée');
  const cles = Object.keys(champs);
  if (cles.length === 0) return;
  const set = cles.map((c) => `"${c}" = ?`).join(', ');
  db.prepare(`UPDATE ${table} SET ${set} WHERE id = ?`).run(...cles.map((c) => champs[c]), id);
  if (table === 'projets') toucherProjet(id);
}

export function insererLigne(table: string, champs: Record<string, any>): number {
  if (!TABLES_ADMIN.has(table)) throw new Error('Table non autorisée');
  const cles = Object.keys(champs);
  const res = db
    .prepare(
      `INSERT INTO ${table} (${cles.map((c) => `"${c}"`).join(', ')})
       VALUES (${cles.map(() => '?').join(', ')})`
    )
    .run(...cles.map((c) => champs[c]));
  return Number(res.lastInsertRowid);
}

export function supprimerLigne(table: string, id: number) {
  if (!TABLES_ADMIN.has(table)) throw new Error('Table non autorisée');
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

export function reordonner(table: string, ids: number[]) {
  if (!TABLES_ADMIN.has(table)) throw new Error('Table non autorisée');
  const maj = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
  db.transaction(() => ids.forEach((id, i) => maj.run(i, id)))();
}

export function prochainePosition(table: string, where = '', ...params: any[]): number {
  const l = db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM ${table} ${where}`)
    .get(...params) as { p: number };
  return l.p;
}

function toucherProjet(id: number) {
  db.prepare("UPDATE projets SET modifie_le = datetime('now') WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */

migrer();
