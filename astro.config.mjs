import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),

  /**
   * Protection anti-CSRF : la nôtre, pas celle d'Astro.
   *
   * Astro 5 active `checkOrigin` par défaut. Son contrôle compare l'en-tête
   * « Origin » à l'URL complète de la requête, protocole compris — et c'est
   * précisément ce qui casse derrière un proxy qui termine le HTTPS, comme
   * celui d'Infomaniak : le navigateur annonce « https://kezak.ch »,
   * l'application reçoit la requête en clair et se croit sur
   * « http://kezak.ch ». Tout envoi de formulaire est alors refusé, avec un
   * message anglais sur une page blanche.
   *
   * On le désactive donc, mais on ne se retrouve pas sans protection, parce
   * que `src/middleware.ts` en fait davantage :
   *
   *   — un jeton à double soumission (cookie + champ caché), comparé en
   *     temps constant, sur toutes les méthodes mutantes ;
   *   — un contrôle de l'en-tête « Origin » sur le nom d'hôte seul, donc
   *     insensible au protocole vu par l'application, et comparé au domaine
   *     du site autant qu'à celui de la requête ;
   *   — des cookies en « SameSite=Lax », qu'un envoi venu d'un autre site
   *     n'emporte de toute façon pas.
   *
   * Notre contrôle couvre en outre toutes les méthodes mutantes, là où celui
   * d'Astro ne regarde que trois types de contenu.
   *
   * La contrepartie assumée : ignorer le protocole accepterait une requête
   * venue de « http://kezak.ch ». Il faudrait pour cela être déjà en
   * position d'intercepter le trafic — et la redirection HTTPS plus l'en-tête
   * HSTS ferment cette porte.
   */
  security: {
    checkOrigin: false,
  },

  site: process.env.SITE_URL || 'https://kezak.ch',
  server: {
    port: Number(process.env.PORT) || 4321,
    host: process.env.HOST || '0.0.0.0',
  },
  build: {
    // Les assets sont servis par Astro lui-même en mode standalone.
    assets: '_astro',
  },
  vite: {
    // better-sqlite3 et sharp sont des modules natifs : ils restent externes.
    ssr: { external: ['better-sqlite3', 'sharp', 'nodemailer'] },
  },
});
