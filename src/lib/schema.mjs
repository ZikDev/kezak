/**
 * Le schéma, en un seul endroit.
 * Importé par src/lib/db.ts (l'application) et par les scripts de
 * maintenance, qui tournent en Node pur.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  mot_de_passe  TEXT NOT NULL,
  totp_secret   TEXT,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  vu_le         TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id        TEXT PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expire_le TEXT NOT NULL,
  absolu_le TEXT NOT NULL,
  ip        TEXT,
  agent     TEXT,
  cree_le   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS tentatives (
  cle      TEXT NOT NULL,
  horodate INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tentatives_cle ON tentatives(cle, horodate);

CREATE TABLE IF NOT EXISTS reglages (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medias (
  id        INTEGER PRIMARY KEY,
  type      TEXT NOT NULL,
  fichier   TEXT NOT NULL,
  mime      TEXT NOT NULL,
  largeur   INTEGER,
  hauteur   INTEGER,
  octets    INTEGER,
  alt       TEXT NOT NULL DEFAULT '',
  legende   TEXT NOT NULL DEFAULT '',
  variantes TEXT NOT NULL DEFAULT '{}',
  bichromie INTEGER NOT NULL DEFAULT 1,
  poster_id INTEGER REFERENCES medias(id) ON DELETE SET NULL,
  cree_le   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projets (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  titre         TEXT NOT NULL,
  categorie     TEXT NOT NULL DEFAULT '',
  categorie_txt TEXT NOT NULL DEFAULT '',
  annee         TEXT NOT NULL DEFAULT '',
  resume        TEXT NOT NULL DEFAULT '',
  chapeau       TEXT NOT NULL DEFAULT '',
  hero_id       INTEGER REFERENCES medias(id) ON DELETE SET NULL,
  video_fond_id INTEGER REFERENCES medias(id) ON DELETE SET NULL,
  youtube       TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT '',
  realisation   TEXT NOT NULL DEFAULT '',
  production    TEXT NOT NULL DEFAULT '',
  diffusion     TEXT NOT NULL DEFAULT '',
  citation      TEXT NOT NULL DEFAULT '',
  citation_qui  TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  statut        TEXT NOT NULL DEFAULT 'brouillon',
  position      INTEGER NOT NULL DEFAULT 0,
  en_avant      INTEGER NOT NULL DEFAULT 0,
  cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
  modifie_le    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projets_statut ON projets(statut, position);

CREATE TABLE IF NOT EXISTS accueil_ecrans (
  id           INTEGER PRIMARY KEY,
  position     INTEGER NOT NULL,
  genre        TEXT NOT NULL,
  surtitre     TEXT NOT NULL DEFAULT '',
  titre        TEXT NOT NULL DEFAULT '',
  texte        TEXT NOT NULL DEFAULT '',
  media_id     INTEGER REFERENCES medias(id) ON DELETE SET NULL,
  video_id     INTEGER REFERENCES medias(id) ON DELETE SET NULL,
  projet_id    INTEGER REFERENCES projets(id) ON DELETE SET NULL,
  lien_libelle TEXT NOT NULL DEFAULT '',
  lien_url     TEXT NOT NULL DEFAULT '',
  actif        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS projet_sections (
  id        INTEGER PRIMARY KEY,
  projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  titre     TEXT NOT NULL DEFAULT '',
  corps     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS projet_faits (
  id        INTEGER PRIMARY KEY,
  projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  etiquette TEXT NOT NULL DEFAULT '',
  valeur    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS projet_credits (
  id        INTEGER PRIMARY KEY,
  projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  poste     TEXT NOT NULL DEFAULT '',
  noms      TEXT NOT NULL DEFAULT '',
  cest_moi  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projet_medias (
  id        INTEGER PRIMARY KEY,
  projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  media_id  INTEGER NOT NULL REFERENCES medias(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  legende   TEXT NOT NULL DEFAULT '',
  large     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prestations (
  id       INTEGER PRIMARY KEY,
  position INTEGER NOT NULL,
  titre    TEXT NOT NULL DEFAULT '',
  meta     TEXT NOT NULL DEFAULT '',
  corps    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS methode (
  id       INTEGER PRIMARY KEY,
  position INTEGER NOT NULL,
  titre    TEXT NOT NULL DEFAULT '',
  corps    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS faq (
  id       INTEGER PRIMARY KEY,
  position INTEGER NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  reponse  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS parcours (
  id       INTEGER PRIMARY KEY,
  position INTEGER NOT NULL,
  periode  TEXT NOT NULL DEFAULT '',
  texte    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS etapes_contact (
  id       INTEGER PRIMARY KEY,
  position INTEGER NOT NULL,
  texte    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS messages (
  id       INTEGER PRIMARY KEY,
  nom      TEXT NOT NULL DEFAULT '',
  orga     TEXT NOT NULL DEFAULT '',
  email    TEXT NOT NULL DEFAULT '',
  tel      TEXT NOT NULL DEFAULT '',
  besoins  TEXT NOT NULL DEFAULT '',
  echeance TEXT NOT NULL DEFAULT '',
  budget   TEXT NOT NULL DEFAULT '',
  corps    TEXT NOT NULL DEFAULT '',
  lu       INTEGER NOT NULL DEFAULT 0,
  cree_le  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
