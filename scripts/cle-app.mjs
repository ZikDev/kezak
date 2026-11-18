/**
 * Tire une clé pour l'API de l'application Kezak (APP_API_CLE).
 * 48 octets aléatoires, encodés en base64url : 64 caractères.
 *
 *   npm run cle-app
 *
 * La clé s'affiche une fois, ici, et n'est écrite nulle part : copiez-la
 * dans le .env du serveur ET dans l'application. Ne la mettez jamais dans
 * le dépôt Git.
 */
import { randomBytes } from 'node:crypto';

console.log('\nNouvelle clé pour APP_API_CLE :\n');
console.log(randomBytes(48).toString('base64url'));
console.log("\nÀ coller dans le .env du serveur (APP_API_CLE=...) et dans l'application Kezak.\n");
