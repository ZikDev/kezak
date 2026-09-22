/**
 * Contrôles statiques du projet — `npm run verif`.
 *
 * Ce n'est pas un remplaçant du build : c'est ce qui attrape en une seconde
 * les fautes qui se voient mal à la relecture. À lancer avant chaque
 * déploiement, et quand quelque chose ne marche pas sans raison apparente.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const racine = process.cwd();
const erreurs = [];
const avertissements = [];

const fichiers = [];
(function parcourir(d) {
  for (const nom of readdirSync(d)) {
    if (['node_modules', 'dist', '.astro', '.git', 'data', 'uploads'].includes(nom)) continue;
    const p = join(d, nom);
    if (statSync(p).isDirectory()) parcourir(p);
    else fichiers.push(p);
  }
})(racine);

const astro = fichiers.filter((f) => f.endsWith('.astro'));
const ts = fichiers.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
const code = [...astro, ...ts, ...fichiers.filter((f) => f.endsWith('.mjs'))];

/* 1. Les imports relatifs pointent vers un fichier qui existe ------- */
for (const f of code) {
  const texte = readFileSync(f, 'utf8');
  for (const m of texte.matchAll(/from\s+'(\.[^']+)'/g)) {
    const base = resolve(dirname(f), m[1]);
    const trouve = ['', '.ts', '.astro', '.mjs', '.js'].some((e) => existsSync(base + e));
    if (!trouve) erreurs.push(`${f} : import introuvable « ${m[1]} »`);
  }
}

/* 2. Tout formulaire POST porte un jeton anti-CSRF ------------------ */
for (const f of astro) {
  const texte = readFileSync(f, 'utf8');
  for (const m of texte.matchAll(/<form[^>]*method="post"[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!m[1].includes('name="csrf"')) erreurs.push(`${f} : formulaire POST sans jeton anti-CSRF`);
  }
}

/* 3. Toute route d'admin vérifie la session ------------------------- */
for (const f of ts.filter((f) => f.includes('admin') && f.includes('api'))) {
  if (f.includes('login') || f.includes('deconnexion')) continue;
  if (!readFileSync(f, 'utf8').includes('locals.utilisateur')) {
    erreurs.push(`${f} : route d'administration sans contrôle de session`);
  }
}

/* 4. Toute redirection depuis un champ de formulaire est filtrée ---- */
for (const f of ts.filter((f) => f.includes('admin/api'))) {
  const texte = readFileSync(f, 'utf8');
  if (texte.includes("f.get('retour')") && !texte.includes('cheminInterne')) {
    erreurs.push(`${f} : « retour » utilisé sans cheminInterne (redirection ouverte)`);
  }
}

/* 5. Aucune couleur hors de la palette ------------------------------ */
const tokens = new Set(
  [...readFileSync('src/styles/tokens.css', 'utf8').matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1])
);
const locales = new Set(['ratio', 'repli', 'degrade', 'voile', 'voile-etroit']);
for (const f of [...astro, ...fichiers.filter((f) => f.endsWith('.css'))]) {
  for (const m of readFileSync(f, 'utf8').matchAll(/var\(--([a-z0-9-]+)/g)) {
    if (!tokens.has(m[1]) && !locales.has(m[1])) {
      erreurs.push(`${f} : variable CSS inconnue « --${m[1]} »`);
    }
  }
}

/* 6. Aucun contenu de la base injecté en HTML brut ------------------ */
for (const f of astro) {
  if (readFileSync(f, 'utf8').includes('set:html')) {
    avertissements.push(`${f} : set:html — vérifier que la source n'est pas la base`);
  }
}

/* 7. Les polices attendues sont bien là ----------------------------- */
const polices = [
  'Lineal-Thin.woff2',
  'Lineal-Light.woff2',
  'Lineal-Regular.woff2',
  'Spectral-Light.woff2',
  'Spectral-LightItalic.woff2',
  'Spectral-Regular.woff2',
  'CutiveMono-Regular.woff2',
];
const manquantes = polices.filter((p) => !existsSync(join('public/fonts', p)));
if (manquantes.length) {
  avertissements.push(
    `public/fonts : ${manquantes.length} police(s) manquante(s) — le site tombera sur les polices système (${manquantes.join(', ')})`
  );
}

/* 8. Le .env local existe ------------------------------------------- */
if (!existsSync('.env')) {
  avertissements.push('.env absent — copiez .env.example et remplissez-le');
}

/* 9. Node et les modules natifs ------------------------------------- */
const majeure = Number(process.versions.node.split('.')[0]);
if (majeure < 20) {
  erreurs.push(`Node ${process.versions.node} est trop ancien — il faut 20.12 au minimum.`);
}

if (existsSync('node_modules')) {
  try {
    await import('better-sqlite3');
  } catch (e) {
    erreurs.push(
      `better-sqlite3 ne se charge pas sous Node ${process.versions.node} : ` +
        'supprimez node_modules et package-lock.json, puis relancez npm install.'
    );
  }
  try {
    await import('sharp');
  } catch {
    erreurs.push('sharp ne se charge pas — même remède : réinstallation propre.');
  }
} else {
  avertissements.push('node_modules absent — lancez npm install');
}

/* --- Rapport -------------------------------------------------------- */
console.log(`\n${code.length} fichiers analysés.\n`);
if (avertissements.length) {
  console.log('Avertissements :');
  for (const a of avertissements) console.log('  ·', a);
  console.log('');
}
if (erreurs.length) {
  console.log('Erreurs :');
  for (const e of erreurs) console.log('  ✗', e);
  console.log(`\n${erreurs.length} erreur(s).\n`);
  process.exit(1);
}
console.log('Aucune erreur.\n');
