import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
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
