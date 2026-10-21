/**
 * Le format des pages d'un PDF, lu à l'envoi du fichier.
 *
 * Il sert à une seule chose : donner au cadre du document, sur la page
 * publique, les proportions de ses pages — un document à l'italienne n'a
 * pas à s'afficher dans un cadre taillé pour un A4 debout.
 *
 * Ce n'est pas un lecteur de PDF : on cherche les boîtes de page
 * (« /MediaBox », « /CropBox ») dans le fichier, et on garde la plus
 * fréquente — le format du document, même si sa couverture diffère. Les
 * PDF récents rangent leurs pages dans des « flux d'objets » compressés :
 * on en décompresse quelques-uns, avec un plafond, pour les y trouver.
 *
 * La recherche avance par `indexOf` sur les octets, et n'applique une
 * expression régulière qu'aux quelques dizaines d'octets qui suivent un
 * mot-clé trouvé : un PDF de 100 Mo se lit en une fraction de seconde.
 *
 * Au pire, on ne trouve rien et la fonction renvoie null : le cadre garde
 * alors le format A4. Une erreur ici n'empêche jamais l'envoi.
 */
import { inflateSync } from 'node:zlib';

const NOMBRE = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)`;
const BOITE = new RegExp(
  String.raw`^\s*\[\s*(${NOMBRE})\s+(${NOMBRE})\s+(${NOMBRE})\s+(${NOMBRE})\s*\]`
);

// Plafonds de la décompression : un flux d'objets piégé pourrait se
// déplier en gigaoctets.
const FLUX_MAX = 40;
const SORTIE_MAX = 4 * 1024 * 1024;

const MEDIA = Buffer.from('/MediaBox');
const CROP = Buffer.from('/CropBox');
const ROTATE = Buffer.from('/Rotate');
const TYPE = Buffer.from('/Type');
const OBJSTM = Buffer.from('/ObjStm');

/** Chaque position où `mot` apparaît dans `b`. */
function* positions(b, mot) {
  let i = b.indexOf(mot);
  while (i >= 0) {
    yield i;
    i = b.indexOf(mot, i + mot.length);
  }
}

const apres = (b, i, n = 120) => b.toString('latin1', i, Math.min(b.length, i + n));

/** Compte les boîtes, les rotations et les pages d'un morceau du fichier. */
function relever(b, bilan) {
  for (const [mot, table] of [
    [MEDIA, bilan.media],
    [CROP, bilan.crop],
  ]) {
    for (const i of positions(b, mot)) {
      const m = BOITE.exec(apres(b, i + mot.length));
      if (!m) continue;
      const [x0, y0, x1, y1] = m.slice(1).map(Number);
      const l = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (!(l >= 1 && h >= 1 && l < 1e6 && h < 1e6)) continue;
      const cle = `${Math.round(l)}x${Math.round(h)}`;
      table.set(cle, (table.get(cle) || 0) + 1);
    }
  }
  for (const i of positions(b, ROTATE)) {
    const m = /^\s+(-?\d+)/.exec(apres(b, i + ROTATE.length, 16));
    if (!m) continue;
    const r = ((Number(m[1]) % 360) + 360) % 360;
    if (r === 90 || r === 270) bilan.tournees++;
  }
  for (const i of positions(b, TYPE)) {
    if (/^\s*\/Page(?![A-Za-z])/.test(apres(b, i + TYPE.length, 16))) bilan.pages++;
  }
}

function plusFrequente(table) {
  let meilleure = null;
  let n = 0;
  for (const [cle, compte] of table) {
    if (compte > n) {
      meilleure = cle;
      n = compte;
    }
  }
  return meilleure;
}

/** Les flux d'objets compressés, où dorment les pages des PDF récents. */
function fluxDObjets(b) {
  const sortie = [];
  for (const i of positions(b, OBJSTM)) {
    if (sortie.length >= FLUX_MAX) break;
    const motStream = b.indexOf('stream', i);
    if (motStream < 0 || motStream - i > 2000) continue;
    const dict = b.toString('latin1', Math.max(0, i - 2000), motStream);
    if (!/\/FlateDecode/.test(dict.slice(dict.lastIndexOf('<<')))) continue;
    let debut = motStream + 6;
    if (b[debut] === 0x0d) debut++;
    if (b[debut] === 0x0a) debut++;
    const fin = b.indexOf('endstream', debut);
    if (fin < 0) continue;
    try {
      sortie.push(inflateSync(b.subarray(debut, fin), { maxOutputLength: SORTIE_MAX }));
    } catch {
      /* flux abîmé ou trop gros : on passe au suivant */
    }
  }
  return sortie;
}

/**
 * @param {Buffer} octets le fichier entier
 * @returns {{ largeur: number, hauteur: number } | null} en points
 */
export function formatPdf(octets) {
  try {
    const bilan = { media: new Map(), crop: new Map(), tournees: 0, pages: 0 };
    relever(octets, bilan);
    for (const clair of fluxDObjets(octets)) relever(clair, bilan);

    // Ce qu'affichent les lecteurs, c'est la CropBox quand elle existe.
    const cle = plusFrequente(bilan.crop.size ? bilan.crop : bilan.media);
    if (!cle) return null;
    let [largeur, hauteur] = cle.split('x').map(Number);
    // La plupart des pages tournées d'un quart de tour : on échange.
    if (bilan.pages > 0 && bilan.tournees * 2 >= bilan.pages) [largeur, hauteur] = [hauteur, largeur];
    return { largeur, hauteur };
  } catch {
    return null;
  }
}
