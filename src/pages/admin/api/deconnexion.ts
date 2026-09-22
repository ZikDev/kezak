import type { APIRoute } from 'astro';
import { COOKIE_SESSION, COOKIE_CSRF, detruireSession } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = ({ cookies, redirect }) => {
  detruireSession(cookies.get(COOKIE_SESSION)?.value);
  cookies.delete(COOKIE_SESSION, { path: '/' });
  // Le jeton anti-CSRF part aussi : il survivait à la déconnexion, et un
  // jeton qui traverse un changement de privilège n'a rien à y gagner.
  cookies.delete(COOKIE_CSRF, { path: '/' });
  return redirect('/admin/login?err=deconnecte', 303);
};
