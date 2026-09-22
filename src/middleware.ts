import { defineMiddleware } from 'astro:middleware';
import './lib/env.mjs';
import {
  COOKIE_SESSION,
  COOKIE_CSRF,
  utilisateurDeSession,
  nouveauJetonCsrf,
  csrfValide,
} from './lib/auth';

/**
 * Middleware global : en-têtes de sécurité, session, garde de l'admin.
 * Il s'exécute avant chaque page et chaque route d'API.
 */

const EN_PROD = import.meta.env.PROD;
const COOKIES_SECURISES = EN_PROD && process.env.DEV_INSECURE_COOKIES !== '1';

/**
 * Politique de sécurité du contenu.
 *
 * En production, elle est stricte : aucun script externe, aucune iframe sauf
 * youtube-nocookie, et seulement après un clic de l'internaute.
 *
 * En développement, Astro injecte ses propres scripts en ligne et ouvre un
 * WebSocket pour le rechargement à chaud. Une CSP stricte casserait
 * `npm run dev` sans rien protéger — la version de développement est donc
 * desserrée juste ce qu'il faut, et elle n'est jamais envoyée en ligne.
 */
const CSP_PROD = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // « blob: » sert à l'aperçu du fichier qu'on vient de choisir dans
  // l'admin, avant tout envoi. Sans lui, cet aperçu fonctionnait en
  // développement et restait vide une fois le site en ligne.
  "img-src 'self' data: blob: https://i.ytimg.com",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const CSP_DEV = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "frame-src https://www.youtube-nocookie.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

/**
 * Taille maximale d'un corps de requête.
 *
 * Le contrôle anti-CSRF ci-dessous lit le corps pour y trouver le jeton,
 * et il le fait avant même de savoir qui envoie. Sans plafond, un corps
 * d'un gigaoctet était mis en mémoire puis refusé : quelques requêtes
 * simultanées suffisaient à faire tomber le serveur. Le plafond est lu sur
 * l'en-tête « Content-Length », que tout navigateur envoie.
 *
 * Réserve honnête : une requête en « chunked » n'annonce pas sa taille et
 * passe donc ce contrôle. Le plafond définitif est celui du serveur placé
 * devant l'application — d'où la consigne de mise en ligne (étape 7).
 */
const LIMITE_CORPS = 512 * 1024;
const LIMITE_TELEVERSEMENT = 80 * 1024 * 1024;

/**
 * Page d'erreur autonome, pour les refus qu'un humain peut rencontrer en
 * naviguant — aujourd'hui, le jeton anti-CSRF périmé. Les refus qui ne
 * concernent qu'un client automatisé (413, origine refusée, 401 sur une
 * route d'API) restent en texte brut : personne ne les lit dans un
 * navigateur.
 */
function pageErreur(titre: string, texte: string, statut: number, retour = '/admin') {
  const echapper = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Les styles sont en ligne : cette réponse ne passe pas par Astro, elle
  // doit tenir toute seule même si rien d'autre ne se charge. La CSP
  // autorise « style-src 'unsafe-inline' », nécessaire de toute façon aux
  // styles de composants d'Astro.
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${echapper(titre)} — Kezak</title>
<style>
 :root{color-scheme:light}
 body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;
  background:#e9edf2;color:#0a1428;font:400 1rem/1.7 Georgia,'Times New Roman',serif}
 main{max-width:34rem;border:1px solid #c3cbd8;background:#fff;padding:2rem}
 .m{margin:0 0 1.5rem;font:400 .75rem/1 ui-monospace,'Courier New',monospace;
  letter-spacing:.18em;text-transform:uppercase;color:#46566f}
 h1{margin:0 0 .75rem;font:300 1.6rem/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.03em}
 p.t{margin:0 0 1.75rem;color:#46566f}
 a{display:inline-flex;align-items:center;min-height:44px;padding:.6rem 1.5rem;
  border:1px solid #0f6b55;color:#0f6b55;text-decoration:none;
  font:400 .75rem/1 ui-monospace,'Courier New',monospace;letter-spacing:.18em;text-transform:uppercase}
 a:hover,a:focus-visible{background:#0f6b55;color:#e9edf2}
</style></head>
<body><main>
<p class="m">Kezak</p><h1>${echapper(titre)}</h1>
<p class="t">${echapper(texte)}</p>
<a href="${echapper(retour)}">Revenir à l'administration</a>
</main></body></html>`;
  return new Response(html, {
    status: statut,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Les en-têtes de sécurité, posés sur toute réponse — y compris les refus. */
function enTetesSecurite(reponse: Response, versAdmin: boolean, enProd: boolean) {
  const h = reponse.headers;
  h.set('Content-Security-Policy', enProd ? CSP_PROD : CSP_DEV);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('X-Frame-Options', 'DENY');
  if (COOKIES_SECURISES) {
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (versAdmin) {
    h.set('Cache-Control', 'no-store, must-revalidate');
    h.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return reponse;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, request, url, locals, redirect } = context;
  const versAdmin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
  // Toute sortie anticipée passe par là : une réponse refusée doit porter
  // les mêmes en-têtes qu'une réponse servie. La page d'erreur du jeton
  // périmé, qui est du HTML, partait sans politique de sécurité du
  // contenu et sans « frame-ancestors ».
  const refus = (r: Response) => enTetesSecurite(r, versAdmin, EN_PROD);

  /* --- Un seul nom de domaine -------------------------------------
     « www.kezak.ch » et « kezak.ch » servent le même site : pour un
     moteur de recherche c'est du contenu dupliqué, et pour un visiteur
     ce sont deux sessions distinctes — se connecter à l'admin sur l'une
     ne connecte pas sur l'autre. On choisit donc une adresse, celle sans
     « www », et l'autre y renvoie définitivement.

     La règle ne regarde que le préfixe et garde le reste de l'adresse
     tel quel : l'URL de prévisualisation de l'hébergeur, le domaine de
     test et le développement local ne sont pas concernés, et le chemin
     comme les paramètres sont préservés.

     Seules les requêtes de lecture sont redirigées. Un 301 sur un envoi
     de formulaire le transformerait en simple lecture et en perdrait le
     contenu — de toute façon le formulaire n'est atteint qu'après une
     page, donc déjà sur la bonne adresse. */
  if ((request.method === 'GET' || request.method === 'HEAD') && url.hostname.startsWith('www.')) {
    const cible = new URL(url);
    cible.hostname = url.hostname.slice(4);
    // Réponse construite à la main : « Response.redirect » rend ses
    // en-têtes immuables, et on n'y ajouterait plus rien.
    return refus(
      new Response(null, {
        status: 301,
        headers: { Location: cible.href, 'Cache-Control': 'no-store' },
      })
    );
  }

  /* --- Session ---------------------------------------------------- */
  const jeton = cookies.get(COOKIE_SESSION)?.value;
  locals.utilisateur = utilisateurDeSession(jeton);

  /* --- Jeton anti-CSRF -------------------------------------------- */
  let csrf = cookies.get(COOKIE_CSRF)?.value;
  const csrfNeuf = !csrf;
  if (!csrf) csrf = nouveauJetonCsrf();
  locals.csrf = csrf;

  const poserCookieCsrf = () =>
    cookies.set(COOKIE_CSRF, csrf!, {
      path: '/',
      httpOnly: false, // lu par les formulaires ; sa valeur n'ouvre aucun accès
      sameSite: 'lax',
      secure: COOKIES_SECURISES,
      // Trente jours, et surtout : reposé à chaque page. Il durait douze
      // heures et n'était jamais renouvelé, alors que la session dure une
      // semaine. Un onglet d'admin laissé ouvert la veille rejetait donc
      // l'enregistrement du lendemain — et le texte saisi était perdu.
      maxAge: 60 * 60 * 24 * 30,
    });

  // Reposé sur toute page, pas seulement quand il est neuf. Les fichiers
  // servis (médias, ressources compilées) sont exclus sans exception —
  // y compris pour un tout premier visiteur : leur réponse porte un cache
  // d'un an, et un « Set-Cookie » dessus la rendrait incachable. La page
  // suivante posera le cookie.
  const routeDeContenu =
    !url.pathname.startsWith('/media/') &&
    !url.pathname.startsWith('/_astro/') &&
    !/\.[a-z0-9]{2,5}$/i.test(url.pathname);
  if (routeDeContenu) poserCookieCsrf();

  /* --- Vérifications sur les requêtes mutantes -------------------- */
  const mutante = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (mutante) {
    // Plafond de taille AVANT toute lecture du corps.
    const annonce = Number(request.headers.get('content-length') || 0);
    const plafond =
      url.pathname === '/admin/api/televerser' ? LIMITE_TELEVERSEMENT : LIMITE_CORPS;
    if (annonce > plafond) {
      return refus(
        new Response('Requête trop volumineuse.', {
          status: 413,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      );
    }

    /**
     * Origine : une requête venue d'un autre site est rejetée d'emblée.
     *
     * On compare le nom d'hôte seul, jamais le protocole. Derrière un proxy
     * qui termine le HTTPS, l'application reçoit la requête en clair : le
     * navigateur annonce « https://kezak.ch » et l'application se croit sur
     * « http://kezak.ch ». Comparer les deux en entier refuserait tous les
     * envois de formulaire du site — c'est exactement ce que faisait la
     * protection intégrée d'Astro, désactivée dans astro.config.mjs.
     *
     * Et on accepte deux hôtes : celui de la requête, et celui du domaine
     * configuré. Le second couvre le cas où le proxy présente à
     * l'application un hôte interne plutôt que le vrai.
     */
    const origine = request.headers.get('origin');
    if (origine) {
      const hotesAutorises = new Set([url.host]);
      try {
        if (process.env.SITE_URL) hotesAutorises.add(new URL(process.env.SITE_URL).host);
      } catch {
        /* SITE_URL mal formée : on s'en tient à l'hôte de la requête */
      }
      let hoteOrigine = '';
      try {
        hoteOrigine = new URL(origine).host;
      } catch {
        hoteOrigine = '';
      }
      if (!hoteOrigine || !hotesAutorises.has(hoteOrigine)) {
        return refus(new Response('Origine refusée', { status: 403 }));
      }
    }

    const type = request.headers.get('content-type') || '';

    if (type.includes('multipart/form-data')) {
      // Téléversement : on ne relit pas le corps ici, un fichier de plusieurs
      // dizaines de méga-octets serait mis deux fois en mémoire. L'en-tête
      // Origin, envoyé par tous les navigateurs sur un POST, suffit — et il
      // devient obligatoire dans ce cas précis.
      if (!origine) return refus(new Response('Origine absente', { status: 403 }));
    } else if (type.includes('form') || type.includes('json')) {
      // Double soumission du jeton anti-CSRF.
      const clone = request.clone();
      let envoye: string | null = null;
      try {
        if (type.includes('json')) {
          envoye = ((await clone.json()) as any)?.csrf ?? null;
        } else {
          envoye = String((await clone.formData()).get('csrf') ?? '');
        }
      } catch {
        envoye = null;
      }
      if (csrfNeuf || !csrfValide(csrf, envoye)) {
        return refus(
          pageErreur(
            'Page trop ancienne',
            "Le jeton de sécurité de cette page n'est plus valide — la page était sans doute ouverte depuis longtemps. Rien n'a été enregistré. Rouvrez la page et refaites la modification.",
            403,
            versAdmin ? '/admin' : '/'
          )
        );
      }
    }
  }

  /* --- Garde de l'admin ------------------------------------------- */
  const pageLibre = url.pathname === '/admin/login' || url.pathname === '/admin/api/login';
  if (versAdmin && !pageLibre && !locals.utilisateur) {
    if (url.pathname.startsWith('/admin/api/')) {
      return refus(new Response('Non authentifié', { status: 401 }));
    }
    // context.redirect plutôt que Response.redirect : c'est ce qui garantit
    // que le cookie anti-CSRF posé plus haut part bien avec la réponse.
    const suite = encodeURIComponent(url.pathname + url.search);
    return redirect(`/admin/login?suite=${suite}`, 303);
  }

  /* --- Réponse et en-têtes ---------------------------------------- */
  const reponse = enTetesSecurite(await next(), versAdmin, EN_PROD);
  const h = reponse.headers;
  // L'admin n'est jamais mise en cache : c'est déjà posé ci-dessus.
  if (!versAdmin && !h.has('Cache-Control') && (h.get('Content-Type') || '').includes('text/html')) {
    /**
     * Les pages publiques portent le jeton anti-CSRF du visiteur, et la page
     * de contact porte en plus l'horodatage de son ouverture. Sans consigne,
     * un proxy ou un CDN placé devant l'application peut décider tout seul
     * de garder une page en cache — et servir alors le jeton d'un visiteur
     * à un autre. On le lui interdit, tout en autorisant la revalidation
     * par ETag, qui ne coûte rien.
     *
     * Les images, les vidéos et les fichiers statiques ne sont pas
     * concernés : ils gardent leur cache d'un an, posé par leur propre
     * route.
     */
    h.set('Cache-Control', 'private, no-cache, must-revalidate');
    h.append('Vary', 'Cookie');
  }
  return reponse;
});
