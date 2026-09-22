import type { APIRoute } from 'astro';
import {
  COOKIE_SESSION,
  COOKIE_CSRF,
  nouveauJetonCsrf,
  utilisateurParEmail,
  verifierMotDePasse,
  creerSession,
  marquerConnexion,
  tropDeTentatives,
  noterTentative,
  effacerTentatives,
  nettoyerSessions,
} from '../../../lib/auth';
import { cheminInterne } from '../../../lib/admin';

export const prerender = false;

const COOKIES_SECURISES = import.meta.env.PROD && process.env.DEV_INSECURE_COOKIES !== '1';

/** Un délai fixe minimal : le temps de réponse ne dit pas si le compte existe. */
const DELAI_MINIMUM = 600;

export const POST: APIRoute = async ({ request, cookies, clientAddress, redirect, url }) => {
  const debut = Date.now();
  const f = await request.formData();
  const email = String(f.get('email') ?? '').trim().toLowerCase().slice(0, 160);
  const motDePasse = String(f.get('mot_de_passe') ?? '');
  const suite = cheminInterne(f.get('suite'), '/admin');

  const ip = clientAddress || 'inconnue';
  const cleIp = `login-ip:${ip}`;
  const cleCompte = `login-compte:${email}`;

  const attendre = async () => {
    const reste = DELAI_MINIMUM - (Date.now() - debut);
    if (reste > 0) await new Promise((r) => setTimeout(r, reste));
  };

  // Trois compteurs : par adresse, par compte visé, et un compteur global.
  //
  // Le compteur global est le seul qui tienne si l'adresse d'origine n'est
  // pas fiable — derrière un proxy mal configuré, « X-Forwarded-For » est
  // ce que l'appelant veut. Sans lui, faire varier l'adresse annoncée et
  // l'adresse e-mail visée permettait un nombre illimité de calculs scrypt,
  // à 64 Mo de mémoire chacun : de quoi épuiser le serveur sans jamais
  // essayer de deviner un mot de passe. Le seuil est haut : une seule
  // personne se connecte à ce site, cent échecs par quart d'heure ne
  // peuvent pas venir d'elle.
  if (
    tropDeTentatives(cleIp, 5, 900) ||
    tropDeTentatives(cleCompte, 10, 900) ||
    tropDeTentatives('login-global', 100, 900)
  ) {
    await attendre();
    return redirect('/admin/login?err=trop', 303);
  }

  /**
   * La tentative est comptée AVANT le calcul, pas après.
   *
   * Elle l'était après, et c'était un trou : cent requêtes parties dans la
   * même milliseconde franchissaient toutes le contrôle ci-dessus — le
   * compteur valait encore zéro — puis enchaînaient cent scrypt à 64 Mo
   * chacun. Ces calculs occupent le même petit pool de threads que les
   * lectures de fichiers : pendant toute la file, le site ne servait plus
   * une seule image. Sans qu'un mot de passe ait été approché.
   *
   * Comptée d'abord, elle est effacée plus bas en cas de succès : une
   * connexion réussie ne laisse donc aucune trace dans les compteurs.
   */
  noterTentative(cleIp);
  noterTentative(cleCompte);
  noterTentative('login-global');

  const utilisateur = utilisateurParEmail(email);
  const hache =
    utilisateur?.mot_de_passe ??
    // Empreinte factice : on calcule quand même, pour ne pas révéler par le
    // temps de réponse que le compte n'existe pas.
    'scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  const bon = await verifierMotDePasse(motDePasse, hache);

  if (!utilisateur || !bon) {
    await attendre();
    return redirect(`/admin/login?err=identifiants&suite=${encodeURIComponent(suite)}`, 303);
  }

  effacerTentatives(cleIp);
  effacerTentatives(cleCompte);
  effacerTentatives('login-global');
  nettoyerSessions();

  const { jeton, maxAge } = creerSession(
    utilisateur.id,
    ip,
    request.headers.get('user-agent') || ''
  );
  marquerConnexion(utilisateur.id);

  cookies.set(COOKIE_SESSION, jeton, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIES_SECURISES,
    maxAge,
  });

  // Jeton anti-CSRF renouvelé au passage : celui d'avant la connexion ne
  // traverse pas le changement de privilège.
  cookies.set(COOKIE_CSRF, nouveauJetonCsrf(), {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: COOKIES_SECURISES,
    maxAge: 60 * 60 * 24 * 30,
  });

  await attendre();
  // On ne renvoie que vers l'administration : jamais vers un autre site,
  // ni vers une page publique qui pourrait servir d'appât.
  return redirect(suite.startsWith('/admin') ? suite : '/admin', 303);
};
