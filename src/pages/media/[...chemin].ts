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
};

export const prerender = false;

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
    'Content-Disposition': 'inline',
    'Accept-Ranges': 'bytes',
  };

  // Lecture partielle, indispensable pour que les vidéos se lisent et se
  // déplacent dans la timeline.
  const plage = request.headers.get('range');
  if (plage && type.startsWith('video/')) {
    const m = /bytes=(\d*)-(\d*)/.exec(plage);
    if (m) {
      const debut = m[1] ? Number(m[1]) : 0;
      const fin = m[2] ? Number(m[2]) : infos.size - 1;
      if (
        Number.isNaN(debut) ||
        Number.isNaN(fin) ||
        debut >= infos.size ||
        fin >= infos.size ||
        debut > fin
      ) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${infos.size}` },
        });
      }
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
