/**
 * Les changements de structure sur une base déjà remplie.
 *
 * `schema.mjs` crée les tables quand elles n'existent pas. Il ne les modifie
 * jamais : « CREATE TABLE IF NOT EXISTS » ne touche pas une table déjà là.
 * C'est ce fichier qui s'occupe des bases existantes — celles où il y a
 * déjà vos textes, vos projets et vos images.
 *
 * Trois règles, et elles ne se négocient pas :
 *
 *   — l'état est tenu par un NUMÉRO DE VERSION rangé dans la base elle-même
 *     (`PRAGMA user_version`), et non déduit de la forme des tables. Déduire
 *     l'état de la forme répond à « ça ressemble à l'après », pas à « ça a
 *     été fait » — et ces deux questions se séparent dès qu'une migration
 *     est rejouée sur une base déjà migrée ;
 *   — la lecture de ce numéro et l'écriture qui suit sont dans LA MÊME
 *     transaction, ouverte en écriture immédiate. Deux processus qui
 *     démarrent ensemble — une grappe, un redémarrage où l'ancien processus
 *     n'est pas encore tombé, un `npm run migrate` pendant que le serveur
 *     tourne — ne peuvent donc pas migrer tous les deux ;
 *   — rien n'est supprimé avant que le remplacement ne soit constitué et
 *     vérifié : en cas de coupure au mauvais moment, la base reste dans son
 *     état d'avant.
 *
 * La première version a été livrée sans numéro. Les bases d'alors sont donc
 * en version 0, et `versionInitiale()` regarde une fois leur forme pour
 * savoir où elles en sont réellement. C'est le seul endroit où l'on déduit
 * l'état d'une colonne, et il ne s'exécute qu'une fois.
 */

import { NOTE_CREDITS, ANCIENNE_NOTE_GENERIQUE } from './textes.mjs';

/** Les colonnes d'une table, par leur nom. */
function colonnes(db, table) {
  // SQLite n'accepte pas de paramètre lié dans un PRAGMA, d'où
  // l'interpolation — et d'où le contrôle du nom juste avant. Aujourd'hui
  // l'appelant est unique et littéral ; cette fonction est faite pour être
  // réutilisée par les migrations suivantes, et c'est à ce moment-là que
  // l'oubli coûterait cher.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error(`nom de table refusé : ${table}`);
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

/**
 * Galerie : accueillir une vidéo YouTube à côté des fichiers du site.
 *
 * Il faut pour cela une colonne `youtube`, et surtout un `media_id`
 * facultatif — une entrée YouTube ne référence aucun fichier. Or SQLite ne
 * sait pas retirer une contrainte « NOT NULL » d'une colonne existante : la
 * seule voie est de reconstruire la table, d'y recopier les lignes, puis de
 * substituer l'une à l'autre. C'est la procédure que recommande SQLite
 * lui-même, mise en sommeil des clés étrangères comprise.
 */
function galerieAccepteYoutube(db) {
  db.exec(`
    CREATE TABLE projet_medias_nouveau (
      id        INTEGER PRIMARY KEY,
      projet_id INTEGER NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
      media_id  INTEGER REFERENCES medias(id) ON DELETE CASCADE,
      youtube   TEXT NOT NULL DEFAULT '',
      position  INTEGER NOT NULL,
      legende   TEXT NOT NULL DEFAULT '',
      large     INTEGER NOT NULL DEFAULT 0
    );

    INSERT INTO projet_medias_nouveau (id, projet_id, media_id, youtube, position, legende, large)
    SELECT id, projet_id, media_id, '', position, legende, large FROM projet_medias;

    DROP TABLE projet_medias;
    ALTER TABLE projet_medias_nouveau RENAME TO projet_medias;
  `);

  // Contrôle avant de valider : si une ligne pointait vers un projet ou un
  // média disparu, on s'en aperçoit maintenant et on renonce à tout.
  const orphelines = db.pragma('foreign_key_check(projet_medias)');
  if (orphelines.length > 0) {
    throw new Error(`galerie : ${orphelines.length} ligne(s) orpheline(s), migration annulée`);
  }
}

/**
 * Le générique devient les crédits, et un crédit peut porter un lien.
 *
 * Deux gestes, et aucune table à reconstruire : ajouter une colonne est
 * l'une des rares modifications que SQLite sait faire en place.
 *
 * Le second geste touche un réglage, pas une table. Le texte affiché en
 * marge des crédits était rangé sous la clé « generique_note », et sa
 * valeur d'origine parlait du générique d'un film — ce qui ne veut rien
 * dire pour un site web ou une série de photographies. La valeur est
 * déplacée sous « credits_note » ; et si elle n'a jamais été retouchée,
 * elle est remplacée par une formulation qui vaut pour tous les projets.
 * Une phrase que l'on a écrite soi-même, elle, est conservée telle quelle :
 * une migration n'efface pas le travail de quelqu'un.
 */
function creditsEtLiens(db) {
  if (!colonnes(db, 'projet_credits').has('url')) {
    db.exec("ALTER TABLE projet_credits ADD COLUMN url TEXT NOT NULL DEFAULT ''");
  }

  const ancienne = db.prepare("SELECT valeur FROM reglages WHERE cle = 'generique_note'").get();
  if (ancienne) {
    const valeur =
      ancienne.valeur.trim() === ANCIENNE_NOTE_GENERIQUE ? NOTE_CREDITS : ancienne.valeur;
    // « INSERT OR IGNORE » : si « credits_note » existe déjà — parce que la
    // migration a été interrompue après l'insertion et avant la suppression —
    // c'est la valeur déjà en place qui gagne, et non l'ancienne qui
    // reviendrait l'écraser.
    db.prepare("INSERT OR IGNORE INTO reglages (cle, valeur) VALUES ('credits_note', ?)").run(valeur);
    db.prepare("DELETE FROM reglages WHERE cle = 'generique_note'").run();
  }
}

/** Numéro de version → ce qu'il faut faire pour l'atteindre. */
const MIGRATIONS = [
  { version: 1, nom: 'galerie : accepte les vidéos YouTube', appliquer: galerieAccepteYoutube },
  { version: 2, nom: 'crédits : un lien par nom, et la note renommée', appliquer: creditsEtLiens },
];

export const VERSION_CIBLE = MIGRATIONS[MIGRATIONS.length - 1].version;

/**
 * Le numéro de version d'une base qui n'en porte pas encore.
 *
 * Une base créée à l'instant est déjà au dernier schéma : rien à faire.
 * Une base antérieure au numérotage est reconnue à sa forme.
 */
function versionInitiale(db) {
  const cols = colonnes(db, 'projet_medias');
  if (cols.size === 0) return VERSION_CIBLE; // table absente : schema.mjs vient de la créer au bon format
  if (!cols.has('youtube')) return 0;
  if (!colonnes(db, 'projet_credits').has('url')) return 1;
  // La colonne est là, mais la migration 2 fait deux choses : la colonne
  // ET le renommage du réglage. Une base restaurée par morceaux peut avoir
  // l'une sans l'autre, et déclarer « c'est fait » ferait disparaître le
  // texte affiché en marge des crédits. On ne déclare l'étape faite que
  // lorsque ses deux moitiés le sont.
  const reste = db.prepare("SELECT 1 FROM reglages WHERE cle = 'generique_note'").get();
  return reste ? 1 : 2;
}

/** Applique ce qui manque. Renvoie la liste de ce qui a été fait. */
export function migrationsEnAttente(db) {
  const faites = [];

  // Coup d'œil AVANT d'ouvrir quoi que ce soit. Sans lui, chaque démarrage
  // et chaque script ouvraient une transaction en écriture immédiate pour
  // constater qu'il n'y avait rien à faire — donc réclamaient le verrou
  // d'écriture de la base. Une sauvegarde nocturne lancée pendant qu'un
  // visiteur envoie un message échouait sur « database is locked », et le
  // serveur refusait de démarrer si un script tenait le verrou.
  // La lecture est faite hors transaction : elle peut être périmée d'un
  // instant, mais elle ne peut l'être que dans un sens — une autre
  // migration vient de passer — et ce cas est repris dans la transaction,
  // qui relit le numéro avant d'agir.
  const version = db.pragma('user_version', { simple: true });
  if (version >= VERSION_CIBLE) return faites;

  // « immediate » plutôt que le mode différé par défaut : la transaction
  // prend le verrou d'écriture dès son ouverture, donc AVANT la lecture du
  // numéro de version. C'est ce qui sérialise deux processus concurrents —
  // le second attend, lit un numéro déjà à jour, et ne fait rien.
  const executer = db.transaction(() => {
    let version = db.pragma('user_version', { simple: true });
    if (version === 0) {
      version = versionInitiale(db);
      db.pragma(`user_version = ${version}`);
    }

    for (const m of MIGRATIONS) {
      if (version >= m.version) continue;
      m.appliquer(db);
      db.pragma(`user_version = ${m.version}`);
      version = m.version;
      faites.push(m.nom);
    }
  });

  // Les clés étrangères ne peuvent pas être désactivées à l'intérieur d'une
  // transaction : le réglage se pose ici, et le `finally` le rétablit quoi
  // qu'il arrive — y compris si une migration lève une exception.
  db.pragma('foreign_keys = OFF');
  try {
    executer.immediate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
  return faites;
}
