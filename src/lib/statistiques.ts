/**
 * Statistiques de fréquentation, sans cookie et sans donnée personnelle.
 *
 * Le comptage se fait côté serveur, au moment où une page est servie :
 * aucun script n'est ajouté au site, rien n'est déposé chez le visiteur, et
 * aucune bannière de consentement n'est nécessaire.
 *
 * Ce qui est gardé, par jour : le nombre de pages vues, le nombre de
 * visiteurs distincts, les pages les plus vues, les sites d'où l'on vient
 * (le nom de domaine seul) et le type d'appareil.
 *
 * Ce qui n'est JAMAIS gardé : l'adresse IP, le navigateur exact, une
 * adresse de page complète venue d'ailleurs, un identifiant durable.
 * Pour reconnaître un même visiteur dans la journée, on calcule une
 * empreinte (SHA-256 de l'IP + du navigateur + d'un sel tiré au hasard
 * chaque jour). Le sel ne vit qu'en mémoire et change à minuit : passé
 * la journée, plus personne — nous compris — ne peut relier une empreinte
 * à une IP, ni deux jours entre eux. Les empreintes sont effacées après
 * deux jours.
 *
 * Ne sont pas comptés : l'admin, les routes d'API et de médias, les robots,
 * les préchargements, les visiteurs qui demandent à ne pas être suivis
 * (« Do Not Track » ou « Global Privacy Control »), et l'administrateur
 * connecté.
 */
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

const ROBOTS = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|whatsapp|telegram|discord|preview|monitor|uptime|curl|wget|python|httpclient|go-http|java\/|headless|lighthouse|pagespeed/i;

let selJour = '';
let sel = randomBytes(32);

const jourUtc = () => new Date().toISOString().slice(0, 10);

function selDuJour(jour: string) {
  if (jour !== selJour) {
    selJour = jour;
    sel = randomBytes(32);
    // Ménage : empreintes de plus de deux jours, statistiques de plus de deux ans
    try {
      db.prepare("DELETE FROM stats_empreintes WHERE jour < date('now', '-2 days')").run();
      db.prepare("DELETE FROM stats_pages WHERE jour < date('now', '-730 days')").run();
      db.prepare("DELETE FROM stats_referents WHERE jour < date('now', '-730 days')").run();
      db.prepare("DELETE FROM stats_jours WHERE jour < date('now', '-730 days')").run();
    } catch {
      /* jamais bloquant */
    }
  }
  return sel;
}

/** Le chemin, sans paramètres, borné et normalisé. */
function cheminPropre(pathname: string) {
  let p = pathname.replace(/\/+$/, '') || '/';
  if (p.length > 200) p = p.slice(0, 200);
  return p;
}

/** Le domaine d'où l'on vient, s'il est extérieur au site. Jamais l'adresse complète. */
function domaineReferent(referer: string | null, hoteSite: string) {
  if (!referer) return '';
  try {
    const h = new URL(referer).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || h === hoteSite.replace(/^www\./, '').toLowerCase()) return '';
    return h.slice(0, 100);
  } catch {
    return '';
  }
}

export function compterVisite(opts: {
  request: Request;
  url: URL;
  ip: string;
  statut: number;
  typeContenu: string;
  connecte: boolean;
}) {
  try {
    const { request, url, ip, statut, typeContenu, connecte } = opts;
    if (request.method !== 'GET' || statut !== 200 || !typeContenu.includes('text/html')) return;
    if (connecte) return;
    const p = url.pathname;
    if (p.startsWith('/admin') || p.startsWith('/api/') || p.startsWith('/media/') || p.startsWith('/_astro/')) return;
    const h = request.headers;
    const ua = h.get('user-agent') || '';
    if (!ua || ROBOTS.test(ua)) return;
    if (h.get('dnt') === '1' || h.get('sec-gpc') === '1') return;
    const purpose = (h.get('sec-purpose') || h.get('purpose') || '').toLowerCase();
    if (purpose.includes('prefetch') || purpose.includes('prerender')) return;

    const jour = jourUtc();
    const empreinte = createHash('sha256').update(selDuJour(jour)).update(ip).update('\n').update(ua).digest('hex').slice(0, 32);
    const mobile = /mobi|android|iphone|ipad/i.test(ua) ? 1 : 0;
    const chemin = cheminPropre(p);
    const referent = domaineReferent(h.get('referer'), url.hostname);

    const ecrire = db.transaction(() => {
      const nouveau = db
        .prepare('INSERT OR IGNORE INTO stats_empreintes (jour, empreinte) VALUES (?, ?)')
        .run(jour, empreinte).changes === 1;
      db.prepare(
        `INSERT INTO stats_jours (jour, vues, visiteurs, mobiles) VALUES (?, 1, ?, ?)
         ON CONFLICT(jour) DO UPDATE SET vues = vues + 1, visiteurs = visiteurs + excluded.visiteurs, mobiles = mobiles + excluded.mobiles`
      ).run(jour, nouveau ? 1 : 0, nouveau ? mobile : 0);
      db.prepare(
        `INSERT INTO stats_pages (jour, chemin, vues) VALUES (?, ?, 1)
         ON CONFLICT(jour, chemin) DO UPDATE SET vues = vues + 1`
      ).run(jour, chemin);
      if (referent && nouveau) {
        db.prepare(
          `INSERT INTO stats_referents (jour, domaine, visites) VALUES (?, ?, 1)
           ON CONFLICT(jour, domaine) DO UPDATE SET visites = visites + 1`
        ).run(jour, referent);
      }
    });
    ecrire();
  } catch {
    /* le comptage ne doit jamais faire échouer une page */
  }
}

/** Le résumé lu par l'application Kezak. */
export function resumeStatistiques(jours: number) {
  const depuis = `-${jours - 1} days`;
  const parJour = db
    .prepare("SELECT jour, vues, visiteurs, mobiles FROM stats_jours WHERE jour >= date('now', ?) ORDER BY jour")
    .all(depuis) as { jour: string; vues: number; visiteurs: number; mobiles: number }[];
  const pages = db
    .prepare("SELECT chemin, SUM(vues) AS vues FROM stats_pages WHERE jour >= date('now', ?) GROUP BY chemin ORDER BY vues DESC LIMIT 20")
    .all(depuis);
  const referents = db
    .prepare("SELECT domaine, SUM(visites) AS visites FROM stats_referents WHERE jour >= date('now', ?) GROUP BY domaine ORDER BY visites DESC LIMIT 15")
    .all(depuis);
  // Titres des projets, pour afficher « Projet X » plutôt que /projets/x
  let titres: Record<string, string> = {};
  try {
    const projets = db.prepare('SELECT slug, titre FROM projets').all() as { slug: string; titre: string }[];
    titres = Object.fromEntries(projets.map((p) => [`/projets/${p.slug}`, p.titre]));
  } catch {
    /* table ou colonnes différentes : on garde les chemins */
  }
  return { jours, parJour, pages, referents, titres, depuis: parJour[0]?.jour || null };
}
