/**
 * Crée le compte d'administration, ou change son mot de passe.
 *   npm run compte
 *
 * C'est le seul moyen de créer un compte : il n'y a aucune inscription sur
 * le site, et aucune réinitialisation par courriel. Un attaquant ne peut
 * donc pas s'inscrire, ni détourner une procédure d'oubli de mot de passe.
 */
import { ouvrir, demander } from './outils.mjs';
import { hacher } from '../src/lib/motdepasse.mjs';

const { db } = await ouvrir();

const email = (await demander('Adresse e-mail : ')).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
  console.error('Adresse invalide.');
  process.exit(1);
}

const mdp = await demander('Mot de passe (12 caractères minimum) : ', true);
if (mdp.length < 12) {
  console.error('Trop court : 12 caractères au minimum.');
  process.exit(1);
}
const confirmation = await demander('Confirmer : ', true);
if (mdp !== confirmation) {
  console.error('Les deux saisies diffèrent.');
  process.exit(1);
}

const hache = await hacher(mdp);
const existant = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existant) {
  db.prepare('UPDATE users SET mot_de_passe = ? WHERE id = ?').run(hache, existant.id);
  // Un changement de mot de passe ferme toutes les sessions ouvertes.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existant.id);
  console.log(`Mot de passe mis à jour pour ${email}. Toutes les sessions ont été fermées.`);
} else {
  db.prepare('INSERT INTO users (email, mot_de_passe) VALUES (?, ?)').run(email, hache);
  console.log(`Compte créé : ${email}`);
}

db.close();
process.exit(0);
