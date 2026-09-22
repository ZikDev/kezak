/**
 * Chargement du fichier .env au démarrage.
 *
 * C'est indispensable en production : Astro lit le .env à la CONSTRUCTION,
 * pas à l'exécution. Le serveur compilé (dist/server/entry.mjs) ne voit donc
 * que les variables réellement présentes dans l'environnement du processus.
 * Sans ce chargement, DATA_DIR, UPLOADS_DIR et le SMTP seraient vides une
 * fois en ligne — la base atterrirait dans le dossier déployé et serait
 * effacée à la première mise à jour.
 *
 * process.loadEnvFile existe depuis Node 20.12 / 22. Si l'hébergeur fournit
 * déjà les variables (panneau de configuration), le fichier est simplement
 * absent et on continue sans bruit.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let charge = false;

export function chargerEnv() {
  if (charge) return;
  charge = true;
  const chemin = resolve(process.cwd(), process.env.ENV_FILE || '.env');
  if (!existsSync(chemin)) return;
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(chemin);
    } else {
      // Repli pour les Node plus anciens : analyse minimale, suffisante
      // pour un fichier .env classique.
      const texte = readFileSync(chemin, 'utf8');
      for (const ligne of texte.split('\n')) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(ligne);
        if (!m) continue;
        const cle = m[1];
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[cle] === undefined) process.env[cle] = val;
      }
    }
  } catch (e) {
    console.warn('[env] .env illisible :', e.message);
  }
}

chargerEnv();
