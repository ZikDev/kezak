import type { APIRoute } from 'astro';
import { projetsPublies } from '../lib/db';

export const prerender = false;

/**
 * Le plan du site pour les moteurs de recherche.
 *
 * Il était annoncé dans robots.txt depuis la première version, mais
 * n'existait pas : Google recevait une 404 et devait trouver les pages
 * tout seul, lien par lien. Il est maintenant construit à chaque demande,
 * à partir des projets publiés — un projet passé en brouillon en sort.
 */
const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = ({ url }) => {
  const domaine = process.env.SITE_URL || url.origin;
  const adresse = (chemin: string) => echapper(new URL(chemin, domaine).href);
  const jour = (d: unknown) => {
    const t = String(d || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
  };

  const projets = projetsPublies();
  const dernier = projets.map((p) => jour(p.modifie_le)).filter(Boolean).sort().pop() || '';

  const pages: { loc: string; lastmod?: string }[] = [
    { loc: '/', lastmod: dernier },
    { loc: '/projets', lastmod: dernier },
    { loc: '/studio' },
    { loc: '/contact' },
    ...projets
      .filter((p) => /^[a-z0-9-]+$/.test(String(p.slug)))
      .map((p) => ({ loc: `/projets/${p.slug}`, lastmod: jour(p.modifie_le) })),
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages
      .map(
        (p) =>
          `  <url><loc>${adresse(p.loc)}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`
      )
      .join('\n') +
    '\n</urlset>\n';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
