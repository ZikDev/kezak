import type { APIRoute } from 'astro';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { dossierUploads } from '../../lib/media';

/**
 * Sert les fichiers téléversés.
 *
 * Ils sont stockés hors du dossier web : c'est cette route, et elle seule,
 * qui décide du Content-Type. Un fichier ne peut donc jamais être interprété
 * comme du code par le serveur, quoi qu'il contienne.
 */

const TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
};

/** Les types lus par morceaux : les vidéos, et les PDF que pdf.js lit page à page. */
const PAR_PLAGES = (type: string) => type.startsWith('video/') || type === 'application/pdf';

export const prerender = false;

/**
 * Une plage d'octets, lue selon la norme HTTP (RFC 9110, § 14.1.2).
 *
 * L'ancienne lecture prenait « bytes=-500 » pour « du début à 500 » — ce
 * sont les 500 DERNIERS octets —, refusait « bytes=0-5000 » sur un fichier
 * de 1000 octets au lieu de le tronquer, et acceptait « xbytes=… ». Aucun
 * client du site n'en souffrait encore ; un lecteur vidéo plus pointilleux
 * l'aurait fait.
 *
 * Renvoie les bornes incluses, « hors » pour une plage impossible (416),
 * ou « ignorer » pour ce qu'on ne sert pas par morceaux (plusieurs plages).
 */
function lirePlage(entete: string, taille: number): [number, number] | 'hors' | 'ignorer' {
  const m = /^bytes=(\d*)-(\d*)$/.exec(entete.trim());
  if (!m) return 'ignorer';
  const [, a, b] = m;
  if (a === '' && b === '') return 'ignorer';
  if (a === '') {
    // Suffixe : les N derniers octets.
    const n = Number(b);
    if (!Number.isSafeInteger(n) || n === 0 || taille === 0) return 'hors';
    return [Math.max(0, taille - n), taille - 1];
  }
  const debut = Number(a);
  if (!Number.isSafeInteger(debut) || debut >= taille) return 'hors';
  const fin = b === '' ? taille - 1 : Math.min(Number(b), taille - 1);
  if (!Number.isSafeInteger(fin) || fin < debut) return 'hors';
  return [debut, fin];
}

/**
 * Un flux Node n'est pas un corps de Response valide au sens du standard :
 * il faut le convertir en ReadableStream du Web. Sans cette conversion, la
 * route renvoie un corps vide ou lève une erreur selon la version de Node.
 */
const flux = (chemin: string, options?: { start: number; end: number }) =>
  Readable.toWeb(createReadStream(chemin, options)) as unknown as ReadableStream;

export const GET: APIRoute = ({ params, request }) => {
  const nom = String(params.chemin || '');

  // Un nom de fichier, rien d'autre : pas de sous-dossier, pas de « .. ».
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(nom) || nom.includes('..')) {
    return new Response('Introuvable', { status: 404 });
  }

  const ext = nom.split('.').pop()!.toLowerCase();
  const type = TYPES[ext];
  if (!type) return new Response('Introuvable', { status: 404 });

  const chemin = join(dossierUploads, nom);
  if (!existsSync(chemin)) return new Response('Introuvable', { status: 404 });

  const infos = statSync(chemin);
  if (!infos.isFile()) return new Response('Introuvable', { status: 404 });

  const etag = `"${infos.size.toString(36)}-${Math.floor(infos.mtimeMs).toString(36)}"`;

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const enTetes: Record<string, string> = {
    'Content-Type': type,
    // Les noms de fichiers sont aléatoires et leur contenu ne change jamais.
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    // Les images et vidéos du studio ne sont pas une banque d'images :
    // elles ne s'intègrent que depuis le site lui-même.
    'Cross-Origin-Resource-Policy': 'same-site',
    // Un PDF n'est jamais ouvert dans l'onglet : il est enregistré. Le site
    // le lit avec son propre lecteur ; ouvert directement, il passait par
    // celui du navigateur, sous l'adresse du domaine — et ce qu'il contient
    // n'a pas été écrit par nous. « attachment » ne gêne pas pdf.js, qui
    // lit le fichier par une requête, pas par une navigation.
    'Content-Disposition': type === 'application/pdf' ? 'attachment' : 'inline',
    'Accept-Ranges': 'bytes',
  };

  // Lecture partielle, indispensable pour que les vidéos se lisent et se
  // déplacent dans la timeline.
  const plage = request.headers.get('range');
  // pdf.js demande lui aussi des plages d'octets dès que le serveur annonce
  // « Accept-Ranges » — ce qu'il fait pour tous les fichiers. Sans cette
  // ligne, chaque demande d'un morceau recevait le fichier entier.
  if (plage && PAR_PLAGES(type)) {
    const bornes = lirePlage(plage, infos.size);
    if (bornes === 'ignorer') {
      // Plusieurs plages, ou une syntaxe inconnue : la norme permet de
      // répondre par le fichier entier, et c'est ce qu'on fait plus bas.
    } else {
      if (bornes === 'hors') {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${infos.size}` },
        });
      }
      const [debut, fin] = bornes;
      return new Response(flux(chemin, { start: debut, end: fin }), {
        status: 206,
        headers: {
          ...enTetes,
          'Content-Length': String(fin - debut + 1),
          'Content-Range': `bytes ${debut}-${fin}/${infos.size}`,
        },
      });
    }
  }

  return new Response(flux(chemin), {
    headers: { ...enTetes, 'Content-Length': String(infos.size) },
  });
};

/**
 * HEAD : les lecteurs vidéo l'appellent avant chaque demande de plage
 * d'octets. On ne peut donc pas se contenter d'appeler GET et de jeter le
 * corps : chaque appel ouvrirait un flux de lecture que personne ne
 * consomme et que rien ne referme. Sur une page qui lit trois boucles
 * vidéo, le serveur finit par manquer de descripteurs de fichiers.
 * On annule donc explicitement le flux.
 */
export const HEAD: APIRoute = async (contexte) => {
  const reponse = (await GET(contexte)) as Response;
  if (reponse.body) {
    try {
      await reponse.body.cancel();
    } catch {
      /* déjà fermé */
    }
  }
  return new Response(null, { status: reponse.status, headers: reponse.headers });
};
