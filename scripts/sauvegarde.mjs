/**
 * Sauvegarde la base et les médias. À lancer chaque nuit par une tâche
 * planifiée. Une base perdue, c'est tout le contenu du site perdu.
 *   npm run sauvegarde
 */
import { ouvrir } from './outils.mjs';
import { mkdirSync, readdirSync, copyFileSync, rmSync, statSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';

const RETENTION_JOURS = 30;

const { db, dossier } = await ouvrir();
const cible = join(dossier, 'sauvegardes');
mkdirSync(cible, { recursive: true });

const horodate = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const fichier = join(cible, `kezak-${horodate}.db`);

// La sauvegarde en ligne de SQLite : cohérente même si le site tourne.
await db.backup(fichier);
console.log(`Base sauvegardée : ${fichier}`);

// Les médias sont copiés tels quels, sans écraser ce qui existe déjà.
const brut = process.env.UPLOADS_DIR || './uploads';
const uploads = isAbsolute(brut) ? brut : resolve(process.cwd(), brut);
const miroir = join(cible, 'medias');
mkdirSync(miroir, { recursive: true });
let copies = 0;
for (const nom of readdirSync(uploads)) {
  const source = join(uploads, nom);
  const dest = join(miroir, nom);
  try {
    if (statSync(source).isFile()) {
      copyFileSync(source, dest, 1 /* COPYFILE_EXCL */);
      copies++;
    }
  } catch {
    /* déjà sauvegardé */
  }
}
console.log(`${copies} nouveau(x) média(s) sauvegardé(s).`);

// Purge des copies trop anciennes.
const limite = Date.now() - RETENTION_JOURS * 864e5;
for (const nom of readdirSync(cible)) {
  if (!nom.endsWith('.db')) continue;
  const chemin = join(cible, nom);
  if (statSync(chemin).mtimeMs < limite) {
    rmSync(chemin);
    console.log(`Ancienne sauvegarde supprimée : ${nom}`);
  }
}

db.close();
