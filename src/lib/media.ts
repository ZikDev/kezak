/**
 * Réception, vérification et traitement des médias.
 *
 * Deux règles non négociables :
 *  1. le type réel du fichier est déduit de ses premiers octets, jamais de
 *     son extension ni de l'en-tête envoyé par le navigateur ;
 *  2. rien n'est écrit dans le dossier web. Les fichiers sont servis par une
 *     route qui fixe elle-même le Content-Type.
 *
 * À l'upload d'une image, la bichromie cyanotype est appliquée
 * automatiquement et les variantes AVIF/WebP sont générées. C'est ce qui
 * garantit que la direction artistique tient quelle que soit l'image.
 */
import './env.mjs';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
export const dossierUploads = isAbsolute(UPLOADS_DIR)
  ? UPLOADS_DIR
  : resolve(process.cwd(), UPLOADS_DIR);
mkdirSync(dossierUploads, { recursive: true });

export const TAILLE_MAX_IMAGE = 15 * 1024 * 1024; // 15 Mo
export const TAILLE_MAX_VIDEO = 60 * 1024 * 1024; // 60 Mo par boucle de fond

/** Les seuls types acceptés, avec leur signature binaire. */
const SIGNATURES: { mime: string; ext: string; type: 'image' | 'video'; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', type: 'image', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    ext: 'png',
    type: 'image',
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    type: 'image',
    test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
  {
    mime: 'image/avif',
    ext: 'avif',
    type: 'image',
    test: (b) => b.subarray(4, 8).toString() === 'ftyp' && b.subarray(8, 12).toString().startsWith('avif'),
  },
  {
    mime: 'video/mp4',
    ext: 'mp4',
    type: 'video',
    test: (b) =>
      b.subarray(4, 8).toString() === 'ftyp' &&
      ['isom', 'mp42', 'mp41', 'avc1', 'iso2'].includes(b.subarray(8, 12).toString()),
  },
  {
    mime: 'video/webm',
    ext: 'webm',
    type: 'video',
    test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  },
];

export function reconnaitre(octets: Buffer) {
  return SIGNATURES.find((s) => {
    try {
      return s.test(octets);
    } catch {
      return false;
    }
  });
}

const nomAleatoire = (ext: string) => `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${ext}`;

/** Une largeur par usage : vignette, carte, pleine page, écran large. */
const LARGEURS = [400, 800, 1600, 2400];

/** Plafond de pixels à l'entrée de sharp — voir le commentaire à l'usage. */
const LIMITE_PIXELS = 50_000_000;

/**
 * Bichromie cyanotype : les ombres vont sur Abysse, les lumières sur Papier.
 * Une seule courbe, appliquée à toutes les images du site.
 */
const OMBRE = { r: 0x0a, g: 0x14, b: 0x28 };
const LUMIERE = { r: 0xe9, g: 0xed, b: 0xf2 };

export async function traiterImage(
  octets: Buffer,
  options: { bichromie?: boolean } = {}
): Promise<{
  fichier: string;
  mime: string;
  largeur: number;
  hauteur: number;
  octets: number;
  variantes: Record<string, string>;
}> {
  const { default: sharp } = await import('sharp');
  const bichromie = options.bichromie !== false;

  // Plafond de pixels explicite. Par défaut sharp accepte 268 millions de
  // pixels : une image de 16 000 × 16 000 tient dans les 15 Mo autorisés et
  // réclame alors près d'un gigaoctet à chaque décodage — et il y a un
  // décodage par largeur produite. 50 Mpx, c'est déjà 8600 × 5800.
  const base = sharp(octets, { failOn: 'error', limitInputPixels: LIMITE_PIXELS }).rotate();
  const meta = await base.metadata();
  const largeur = meta.width ?? 0;
  const hauteur = meta.height ?? 0;

  const racine = randomBytes(8).toString('hex');
  const variantes: Record<string, string> = {};

  for (const l of LARGEURS) {
    if (l > largeur * 1.5 && l !== LARGEURS[0]) continue;

    const redimensionne = sharp(octets, { limitInputPixels: LIMITE_PIXELS })
      .rotate()
      .resize({ width: Math.min(l, largeur), withoutEnlargement: true });

    let pipeline = redimensionne;

    if (bichromie) {
      // Niveaux de gris, remis explicitement sur trois canaux, puis
      // remappage linéaire de chacun entre Abysse (les ombres) et Papier
      // (les lumières). C'est la courbe unique de tout le site.
      //
      // `toColourspace('srgb')` n'est pas décoratif : sans lui, sharp peut
      // sortir une image à un seul canal, et `linear()` avec trois valeurs
      // échoue alors. Si la version de sharp installée se comporte
      // autrement, on retombe sur un noir et blanc simple plutôt que de
      // faire échouer tout le téléversement.
      try {
        pipeline = redimensionne
          .clone()
          .greyscale()
          .toColourspace('srgb')
          .linear(
            [(LUMIERE.r - OMBRE.r) / 255, (LUMIERE.g - OMBRE.g) / 255, (LUMIERE.b - OMBRE.b) / 255],
            [OMBRE.r, OMBRE.g, OMBRE.b]
          );
        await pipeline.clone().toBuffer(); // vérifie que la courbe passe
      } catch (e) {
        console.warn('[media] bichromie impossible, repli en noir et blanc :', (e as Error).message);
        pipeline = redimensionne.clone().greyscale();
      }
    }

    const avif = await pipeline.clone().avif({ quality: 55, effort: 4 }).toBuffer();
    const webp = await pipeline.clone().webp({ quality: 78 }).toBuffer();
    const nomAvif = `${racine}-${l}.avif`;
    const nomWebp = `${racine}-${l}.webp`;
    writeFileSync(join(dossierUploads, nomAvif), avif);
    writeFileSync(join(dossierUploads, nomWebp), webp);
    variantes[`avif${l}`] = nomAvif;
    variantes[`webp${l}`] = nomWebp;
  }

  // L'original est conservé, non traité, pour pouvoir tout regénérer
  // le jour où la courbe change.
  const nomOriginal = nomAleatoire(meta.format || 'bin');
  writeFileSync(join(dossierUploads, nomOriginal), octets);

  const principal = variantes['webp1600'] || variantes['webp800'] || variantes['webp400'];
  return {
    fichier: principal,
    mime: 'image/webp',
    largeur,
    hauteur,
    octets: octets.length,
    variantes: { ...variantes, original: nomOriginal },
  };
}

export function enregistrerVideo(octets: Buffer, ext: string, mime: string) {
  const nom = nomAleatoire(ext);
  writeFileSync(join(dossierUploads, nom), octets);
  return { fichier: nom, mime, octets: octets.length };
}

export function supprimerFichiers(noms: string[]) {
  for (const nom of noms) {
    // « .. » satisfait le motif ci-dessus : on l'écarte explicitement,
    // comme le fait déjà la route qui sert les médias.
    if (!/^[A-Za-z0-9._-]+$/.test(nom) || nom.includes('..')) continue;
    const chemin = join(dossierUploads, nom);
    if (existsSync(chemin)) {
      try {
        unlinkSync(chemin);
      } catch {
        /* le fichier a déjà disparu */
      }
    }
  }
}

/** Construit le srcset d'une image à partir de ses variantes. */
export function srcset(variantes: Record<string, string>, format: 'avif' | 'webp') {
  return LARGEURS.filter((l) => variantes[`${format}${l}`])
    .map((l) => `/media/${variantes[`${format}${l}`]} ${l}w`)
    .join(', ');
}
