import '../src/lib/env.mjs';
import { mkdirSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { SCHEMA } from '../src/lib/schema.mjs';
import { migrationsEnAttente } from '../src/lib/migrations.mjs';

/**
 * Charge better-sqlite3 en expliquant clairement ce qui se passe s'il
 * manque son binaire natif — c'est la panne d'installation la plus
 * fréquente, et son message d'origine est illisible.
 */
async function chargerSqlite() {
  try {
    const { default: Database } = await import('better-sqlite3');
    return Database;
  } catch (e) {
    const msg = String(e?.message || e);
    console.error('\n─────────────────────────────────────────────────────────');
    console.error('  better-sqlite3 ne peut pas se charger.');
    console.error('─────────────────────────────────────────────────────────\n');
    if (/bindings file|NODE_MODULE_VERSION|was compiled against/i.test(msg)) {
      console.error(`  Node ${process.versions.node} (ABI ${process.versions.modules}) est installé,`);
      console.error('  mais le binaire de better-sqlite3 ne correspond pas.\n');
      console.error('  Réinstallez proprement :\n');
      console.error('    Windows : rmdir /s /q node_modules  &&  del package-lock.json');
      console.error('    macOS/Linux : rm -rf node_modules package-lock.json\n');
      console.error('    puis : npm install\n');
      console.error('  Le projet demande better-sqlite3 v13 ou plus, qui fournit');
      console.error('  un binaire unique valable pour toutes les versions de Node.');
      console.error('  Si vous aviez installé avec une version plus ancienne du');
      console.error('  package.json, la réinstallation ci-dessus suffit.\n');
    } else {
      console.error('  ' + msg + '\n');
    }
    process.exit(1);
  }
}

export async function ouvrir() {
  const Database = await chargerSqlite();
  const brut = process.env.DATA_DIR || './data';
  const dossier = isAbsolute(brut) ? brut : resolve(process.cwd(), brut);
  mkdirSync(dossier, { recursive: true });
  const db = new Database(join(dossier, 'kezak.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Le serveur attend cinq secondes qu'un verrou se libère ; les scripts
  // renonçaient à la première tentative. La sauvegarde nocturne échouait
  // donc sur « database is locked » dès qu'un visiteur envoyait un message
  // à cet instant précis.
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA);
  // Les scripts ouvraient la base sans jamais appliquer les migrations :
  // « npm run migrate » annonçait « Base prête » sur une base dont la forme
  // datait de la version précédente, et « npm run seed » écrivait ensuite
  // dans des colonnes qui n'existaient pas. Les scripts et le serveur
  // passent maintenant par le même chemin.
  for (const nom of migrationsEnAttente(db)) console.log(`  migration appliquée : ${nom}`);
  return { db, dossier };
}

export function demander(question, masque = false) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const entree = process.stdin;
    entree.resume();
    entree.setEncoding('utf8');
    if (masque && entree.isTTY) entree.setRawMode(true);
    let tampon = '';
    const onData = (c) => {
      if (masque && entree.isTTY) {
        if (c === '\r' || c === '\n' || c === '\u0004') {
          entree.setRawMode(false);
          entree.removeListener('data', onData);
          entree.pause();
          process.stdout.write('\n');
          resolve(tampon);
          return;
        }
        if (c === '\u0003') process.exit(1);
        if (c === '\u007F') {
          tampon = tampon.slice(0, -1);
          return;
        }
        tampon += c;
        process.stdout.write('*');
        return;
      }
      tampon += c;
      if (tampon.includes('\n')) {
        entree.removeListener('data', onData);
        entree.pause();
        resolve(tampon.replace(/\r?\n[\s\S]*$/, ''));
      }
    };
    entree.on('data', onData);
  });
}
