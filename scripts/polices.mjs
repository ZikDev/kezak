/**
 * Convertit les polices en WOFF2 — `npm run polices`.
 *
 * Pourquoi ce script existe : la méthode habituelle passe par fonttools,
 * qui demande Python. Sur une machine Windows fraîche, Python n'est pas là,
 * et installer tout un langage pour convertir sept fichiers n'a pas de sens.
 * Ici, la conversion se fait avec Node, que vous avez déjà.
 *
 * Mode d'emploi :
 *   1. déposez vos .ttf ou .otf dans public/fonts/
 *   2. npm run polices
 *   3. les .woff2 apparaissent à côté, correctement nommés
 *
 * Les fichiers d'origine ne sont pas supprimés : vérifiez le résultat, puis
 * effacez-les vous-même (ils n'ont rien à faire en ligne, ils sont trois
 * fois plus lourds).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const DOSSIER = join(process.cwd(), 'public', 'fonts');

const ATTENDUS = [
  'Lineal-Thin.woff2',
  'Lineal-Light.woff2',
  'Lineal-Regular.woff2',
  'Spectral-Light.woff2',
  'Spectral-LightItalic.woff2',
  'Spectral-Regular.woff2',
  'CutiveMono-Regular.woff2',
];

/**
 * Les fonderies nomment leurs fichiers chacune à sa façon :
 * « Lineal_Thin », « Lineal Thin », « CutiveMono-Regular », « Cutive_Mono »…
 * On ramène tout vers les noms que le CSS attend.
 */
function normaliser(nom) {
  let n = basename(nom, extname(nom))
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Cutive Mono : la graisse est parfois absente du nom.
  if (/^cutive-?mono$/i.test(n)) n = 'CutiveMono-Regular';
  n = n.replace(/^cutive-mono/i, 'CutiveMono');

  // Remise en casse des familles connues.
  n = n.replace(/^lineal/i, 'Lineal').replace(/^spectral/i, 'Spectral');

  // Graisses et styles.
  n = n
    .replace(/-thin$/i, '-Thin')
    .replace(/-light$/i, '-Light')
    .replace(/-regular$/i, '-Regular')
    .replace(/-book$/i, '-Regular')
    .replace(/-lightitalic$/i, '-LightItalic')
    .replace(/-light-italic$/i, '-LightItalic');

  return n + '.woff2';
}

if (!existsSync(DOSSIER)) {
  console.error(`Dossier introuvable : ${DOSSIER}`);
  process.exit(1);
}

/**
 * wawoff2 est publié en CommonJS : selon la version de Node, l'export nommé
 * est reconnu ou non. On accepte les deux formes plutôt que de tomber sur un
 * « compress is not a function » incompréhensible.
 */
let compress;
try {
  const mod = await import('wawoff2');
  compress = typeof mod.compress === 'function' ? mod.compress : mod.default?.compress;
} catch {
  /* module absent — traité juste en dessous */
}

if (typeof compress !== 'function') {
  console.error('\n  Le convertisseur n’est pas installé. Une seule commande :\n');
  console.error('    npm install\n');
  console.error('  (il est déjà listé dans package.json, sous devDependencies)');
  console.error('  Puis relancez : npm run polices\n');
  console.error('  Sans rien installer, il y a aussi transfonter.org :');
  console.error('  déposez vos fichiers, cochez WOFF2 uniquement, téléchargez.\n');
  process.exit(1);
}

const sources = readdirSync(DOSSIER).filter((f) =>
  ['.ttf', '.otf'].includes(extname(f).toLowerCase())
);

if (sources.length === 0) {
  console.log(`\nAucun .ttf ni .otf dans ${DOSSIER}.`);
} else {
  console.log(`\n${sources.length} fichier(s) à convertir.\n`);
  for (const source of sources) {
    const cible = normaliser(source);
    const cheminCible = join(DOSSIER, cible);
    if (existsSync(cheminCible)) {
      console.log(`  · ${source} → ${cible} (existe déjà, ignoré)`);
      continue;
    }
    try {
      const entree = readFileSync(join(DOSSIER, source));
      const sortie = await compress(entree);
      writeFileSync(cheminCible, Buffer.from(sortie));
      const avant = Math.round(entree.length / 1024);
      const apres = Math.round(sortie.length / 1024);
      console.log(`  ✓ ${source} → ${cible}  (${avant} Ko → ${apres} Ko)`);
    } catch (e) {
      console.log(`  ✗ ${source} : ${e.message}`);
    }
  }
}

/* --- État des lieux -------------------------------------------------- */
console.log('\nPolices attendues par le site :\n');
let manquantes = 0;
for (const nom of ATTENDUS) {
  const chemin = join(DOSSIER, nom);
  if (existsSync(chemin)) {
    console.log(`  ✓ ${nom}  (${Math.round(statSync(chemin).size / 1024)} Ko)`);
  } else {
    console.log(`  ✗ ${nom}  — manquante`);
    manquantes++;
  }
}

if (manquantes) {
  console.log(`\n${manquantes} police(s) manquante(s).`);
  console.log('Le site fonctionnera, mais retombera sur les polices du système.\n');
} else {
  console.log('\nToutes les polices sont là.\n');
}
