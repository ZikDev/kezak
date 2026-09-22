/**
 * Crée ou met à jour le schéma. Sans danger : on peut le relancer autant de
 * fois qu'on veut, il ne touche à aucune donnée existante.
 *   npm run migrate
 */
import { ouvrir } from './outils.mjs';

const { db, dossier } = await ouvrir();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((l) => l.name);
console.log(`Base prête dans ${dossier} — ${tables.length} tables.`);
db.close();
